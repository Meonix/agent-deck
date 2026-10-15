use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::JoinHandle;
use std::time::Duration;

use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Manager, State};

use crate::commands::AppState;
use crate::launcher::{find_in_path, login_shell_path_with, session_env};
use crate::panes::{OpenError, PaneId, SessionId, Spawner, close_in_parallel};
use crate::pty::{OutputSink, PaneProcess, ProcessKiller, PtySession, SpawnSpec};
use crate::session_title::{UNTITLED, session_title};
use crate::workspace::{DiskProbe, WorkspaceId};

/// Upper bound on waiting for panes to close when the app quits.
const EXIT_CLOSE_LIMIT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedPane {
    pub pane_id: PaneId,
    pub session_id: SessionId,
    pub started: bool,
}

#[tauri::command]
pub async fn open_pane(
    workspace_id: String,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
    app: AppHandle,
) -> Result<OpenedPane, String> {
    // Blocking work (waiting for the login-shell lookup, spawning) stays off
    // the main thread and the async workers.
    tauri::async_runtime::spawn_blocking(move || {
        open_blocking(&app, WorkspaceId(workspace_id), cols, rows, output)
    })
    .await
    .map_err(|e| e.to_string())?
}

// The pane commands below only enqueue work (see `QueuedProcess`), so they may
// run on the main thread, which also keeps keystrokes in order.

#[tauri::command]
pub fn pane_write(pane_id: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut panes = state.panes.lock().unwrap();
    panes
        .write(&PaneId(pane_id), data.as_bytes())
        .map_err(io_error)
}

#[tauri::command]
pub fn pane_resize(
    pane_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut panes = state.panes.lock().unwrap();
    panes.resize(&PaneId(pane_id), cols, rows).map_err(io_error)
}

#[tauri::command]
pub fn pane_title(pane_id: String, app: AppHandle, state: State<'_, AppState>) -> String {
    // Copy the id out and release the lock before touching the disk.
    let session = state.panes.lock().unwrap().session_of(&PaneId(pane_id));
    let (Some(session), Ok(home)) = (session, app.path().home_dir()) else {
        return UNTITLED.to_string();
    };
    session_title(&home.join(".claude").join("projects"), &session.0)
}

#[tauri::command]
pub fn close_pane(pane_id: String, state: State<'_, AppState>) {
    let process = state.panes.lock().unwrap().take(&PaneId(pane_id));
    if let Some(mut process) = process {
        std::thread::spawn(move || process.close());
    }
}

pub fn close_all_on_exit(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let processes = state.panes.lock().unwrap().take_all();
    if processes.is_empty() {
        return;
    }
    // A pane whose writer is stuck cannot close; do not hang the quit on it.
    let (done_tx, done_rx) = mpsc::channel();
    std::thread::spawn(move || {
        close_in_parallel(processes);
        let _ = done_tx.send(());
    });
    let _ = done_rx.recv_timeout(EXIT_CLOSE_LIMIT);
}

fn open_blocking(
    app: &AppHandle,
    id: WorkspaceId,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
) -> Result<OpenedPane, String> {
    let state = app.state::<AppState>();
    let spawner = PtySpawner {
        launch: state.launch.get(),
        cols,
        rows,
    };
    let sink = ChannelSink(output);
    let opened = {
        // Holding `list` keeps the workspace from being removed until the pane is registered.
        let list = state.list.lock().unwrap();
        let workspace = list
            .entries(&DiskProbe)
            .into_iter()
            .find(|w| w.id == id)
            .ok_or(OpenError::WorkspaceNotFound)
            .map_err(open_error)?;
        let mut panes = state.panes.lock().unwrap();
        panes
            .open(&workspace, &spawner, Box::new(sink))
            .map_err(open_error)?
    };
    Ok(OpenedPane {
        pane_id: opened.pane_id,
        session_id: opened.session_id,
        started: opened.started,
    })
}

fn open_error(e: OpenError) -> String {
    match e {
        OpenError::WorkspaceMissing => "folder_missing",
        OpenError::WorkspaceNotFound => "not_found",
    }
    .to_string()
}

fn io_error(e: io::Error) -> String {
    match e.kind() {
        io::ErrorKind::NotFound => "not_found".to_string(),
        io::ErrorKind::NotConnected => "not_started".to_string(),
        _ => e.to_string(),
    }
}

/// Where `claude` lives and the PATH sessions get, resolved once in the
/// background because the login shell can take up to 3 s.
pub struct LaunchLookup {
    resolved: OnceLock<Launch>,
    pending: Mutex<Option<JoinHandle<Launch>>>,
}

pub struct Launch {
    pub claude: Option<PathBuf>,
    pub path: String,
}

impl LaunchLookup {
    pub fn start() -> Self {
        LaunchLookup {
            resolved: OnceLock::new(),
            pending: Mutex::new(Some(std::thread::spawn(resolve_launch))),
        }
    }

    /// Blocks until the lookup has finished.
    pub fn get(&self) -> &Launch {
        self.resolved.get_or_init(|| {
            let handle = self.pending.lock().unwrap().take();
            handle
                .and_then(|h| h.join().ok())
                .unwrap_or_else(|| launch_for(env_path()))
        })
    }
}

fn resolve_launch() -> Launch {
    launch_for(login_shell_path_with(user_shell().as_deref(), &env_path()))
}

fn launch_for(path: String) -> Launch {
    Launch {
        claude: find_in_path("claude", &path),
        path,
    }
}

fn env_path() -> String {
    std::env::var("PATH").unwrap_or_default()
}

/// `$SHELL` is unset when the app is started from Finder; the passwd entry is not.
fn user_shell() -> Option<String> {
    std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(passwd_shell)
}

#[cfg(unix)]
fn passwd_shell() -> Option<String> {
    use std::ffi::CStr;
    let mut entry: libc::passwd = unsafe { std::mem::zeroed() };
    let mut buf = vec![0 as libc::c_char; 16 * 1024];
    let mut found: *mut libc::passwd = std::ptr::null_mut();
    let rc = unsafe {
        libc::getpwuid_r(
            libc::getuid(),
            &mut entry,
            buf.as_mut_ptr(),
            buf.len(),
            &mut found,
        )
    };
    if rc != 0 || found.is_null() || entry.pw_shell.is_null() {
        return None;
    }
    let shell = unsafe { CStr::from_ptr(entry.pw_shell) }
        .to_string_lossy()
        .into_owned();
    (!shell.is_empty()).then_some(shell)
}

#[cfg(not(unix))]
fn passwd_shell() -> Option<String> {
    None
}

struct PtySpawner<'a> {
    launch: &'a Launch,
    cols: u16,
    rows: u16,
}

impl Spawner for PtySpawner<'_> {
    fn spawn(
        &self,
        cwd: &Path,
        session_id: &SessionId,
        sink: Box<dyn OutputSink>,
    ) -> Option<Box<dyn PaneProcess>> {
        let base: Vec<(String, String)> = std::env::vars_os()
            .filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?)))
            .collect();
        let spec = SpawnSpec {
            program: self.launch.claude.clone()?,
            args: vec!["--session-id".into(), session_id.0.clone()],
            cwd: cwd.to_path_buf(),
            env: session_env(&base, &self.launch.path),
            cols: self.cols,
            rows: self.rows,
        };
        match PtySession::spawn(spec, sink) {
            Ok(session) => {
                let killer = session.killer();
                Some(Box::new(QueuedProcess::new(
                    Box::new(session),
                    Some(killer),
                )))
            }
            Err(e) => {
                eprintln!("claude could not be started: {e}");
                None
            }
        }
    }
}

/// Output as raw bytes, then the exit as the last message, `{"exited": code}`,
/// on the same channel so it can neither be missed nor overtake output.
struct ChannelSink(Channel<InvokeResponseBody>);

impl OutputSink for ChannelSink {
    fn output(&self, chunk: Vec<u8>) {
        let _ = self.0.send(InvokeResponseBody::Raw(chunk));
    }

    fn exited(&self, code: Option<i32>) {
        let _ = self.0.send(exit_message(code));
    }
}

fn exit_message(code: Option<i32>) -> InvokeResponseBody {
    InvokeResponseBody::Json(serde_json::json!({ "exited": code }).to_string())
}

enum Op {
    Write(Vec<u8>),
    Resize(u16, u16),
}

/// Runs a process's writes and resizes on its own thread, in order, so a child
/// that stops reading input blocks only that thread and never the caller.
pub struct QueuedProcess {
    ops: Option<Sender<Op>>,
    worker: Option<JoinHandle<()>>,
    /// Ends the processes even while the worker is stuck in a write.
    killer: Option<ProcessKiller>,
    closing: Arc<AtomicBool>,
}

impl QueuedProcess {
    pub fn new(mut process: Box<dyn PaneProcess>, killer: Option<ProcessKiller>) -> Self {
        let (ops, rx) = mpsc::channel();
        let closing = Arc::new(AtomicBool::new(false));
        let skip = closing.clone();
        let worker = std::thread::spawn(move || {
            let mut logged = false;
            for op in rx {
                if skip.load(Ordering::SeqCst) {
                    continue;
                }
                let result = match op {
                    Op::Write(data) => process.write(&data),
                    Op::Resize(cols, rows) => process.resize(cols, rows),
                };
                if let Err(e) = result
                    && !logged
                {
                    eprintln!("pane input failed: {e}");
                    logged = true;
                }
            }
            process.close();
        });
        QueuedProcess {
            ops: Some(ops),
            worker: Some(worker),
            killer,
            closing,
        }
    }

    fn send(&self, op: Op) -> io::Result<()> {
        self.ops
            .as_ref()
            .and_then(|ops| ops.send(op).ok())
            .ok_or_else(|| io::Error::new(io::ErrorKind::BrokenPipe, "pane is closed"))
    }
}

impl PaneProcess for QueuedProcess {
    fn write(&mut self, data: &[u8]) -> io::Result<()> {
        self.send(Op::Write(data.to_vec()))
    }

    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        self.send(Op::Resize(cols, rows))
    }

    /// Ends the processes, drops queued work and waits for the worker.
    fn close(&mut self) {
        self.closing.store(true, Ordering::SeqCst);
        if let Some(killer) = &self.killer {
            killer.end();
        }
        self.ops = None;
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl Drop for QueuedProcess {
    fn drop(&mut self) {
        self.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[derive(Debug, PartialEq)]
    enum Call {
        Write(Vec<u8>),
        Resize(u16, u16),
        Close,
    }

    struct Recorder(Arc<Mutex<Vec<Call>>>);

    impl PaneProcess for Recorder {
        fn write(&mut self, data: &[u8]) -> io::Result<()> {
            self.0.lock().unwrap().push(Call::Write(data.to_vec()));
            Ok(())
        }
        fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
            self.0.lock().unwrap().push(Call::Resize(cols, rows));
            Ok(())
        }
        fn close(&mut self) {
            self.0.lock().unwrap().push(Call::Close);
        }
    }

    #[test]
    fn queued_process_keeps_order_and_closes_the_process() {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let mut queued = QueuedProcess::new(Box::new(Recorder(calls.clone())), None);

        queued.write(b"a").unwrap();
        queued.resize(100, 30).unwrap();
        queued.write(b"b").unwrap();
        let end = Instant::now() + Duration::from_secs(3);
        while calls.lock().unwrap().len() < 3 && Instant::now() < end {
            std::thread::sleep(Duration::from_millis(1));
        }
        queued.close();

        assert_eq!(
            *calls.lock().unwrap(),
            [
                Call::Write(b"a".to_vec()),
                Call::Resize(100, 30),
                Call::Write(b"b".to_vec()),
                Call::Close
            ]
        );
        assert_eq!(
            queued.write(b"c").unwrap_err().kind(),
            io::ErrorKind::BrokenPipe
        );
        queued.close();
        assert_eq!(calls.lock().unwrap().len(), 4);
    }

    #[cfg(unix)]
    #[test]
    fn pty_spawner_runs_claude_with_the_session_id_in_the_workspace() {
        use std::os::unix::fs::PermissionsExt;
        use std::sync::mpsc::Receiver;

        struct Sink(Arc<Mutex<Vec<u8>>>, Mutex<Sender<Option<i32>>>);
        impl OutputSink for Sink {
            fn output(&self, chunk: Vec<u8>) {
                self.0.lock().unwrap().extend(chunk);
            }
            fn exited(&self, code: Option<i32>) {
                let _ = self.1.lock().unwrap().send(code);
            }
        }

        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let claude = bin.path().join("claude");
        std::fs::write(
            &claude,
            "#!/bin/sh\nprintf '<%s|%s|%s|%s>' \"$1\" \"$2\" \"$PWD\" \"$PATH\"\nread line\nexit 7\n",
        )
        .unwrap();
        std::fs::set_permissions(&claude, std::fs::Permissions::from_mode(0o755)).unwrap();
        let launch = launch_for(format!("{}:/usr/bin:/bin", bin.path().display()));
        assert_eq!(launch.claude.as_deref(), Some(claude.as_path()));

        let out = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx): (_, Receiver<Option<i32>>) = mpsc::channel();
        let spawner = PtySpawner {
            launch: &launch,
            cols: 80,
            rows: 24,
        };
        let session = SessionId("sid-1".into());
        let mut process = spawner
            .spawn(
                cwd.path(),
                &session,
                Box::new(Sink(out.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        process.write(b"\n").unwrap();

        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(7));
        let text = String::from_utf8_lossy(&out.lock().unwrap()).into_owned();
        let pwd = dunce::canonicalize(cwd.path()).unwrap();
        let expected = format!("<--session-id|sid-1|{}|{}>", pwd.display(), launch.path);
        assert!(text.contains(&expected), "{text:?} lacks {expected:?}");
        process.close();
    }

    #[test]
    fn pty_spawner_without_claude_starts_nothing() {
        let launch = Launch {
            claude: None,
            path: String::new(),
        };
        let spawner = PtySpawner {
            launch: &launch,
            cols: 80,
            rows: 24,
        };
        struct Null;
        impl OutputSink for Null {
            fn output(&self, _chunk: Vec<u8>) {}
            fn exited(&self, _code: Option<i32>) {}
        }
        let dir = tempfile::tempdir().unwrap();
        assert!(
            spawner
                .spawn(dir.path(), &SessionId("s".into()), Box::new(Null))
                .is_none()
        );
    }

    #[test]
    fn exit_message_is_json_with_the_code() {
        for (code, json) in [(Some(7), r#"{"exited":7}"#), (None, r#"{"exited":null}"#)] {
            match exit_message(code) {
                InvokeResponseBody::Json(s) => assert_eq!(s, json),
                InvokeResponseBody::Raw(_) => panic!("exit must be JSON"),
            }
        }
    }

    /// FR-029: a child that stops reading input must not keep close from ending it.
    #[cfg(unix)]
    #[test]
    fn close_ends_a_session_whose_writer_is_stuck() {
        struct Sink(Arc<Mutex<Vec<u8>>>);
        impl OutputSink for Sink {
            fn output(&self, chunk: Vec<u8>) {
                self.0.lock().unwrap().extend(chunk);
            }
            fn exited(&self, _code: Option<i32>) {}
        }

        let dir = tempfile::tempdir().unwrap();
        let out = Arc::new(Mutex::new(Vec::new()));
        let spec = SpawnSpec {
            program: "/bin/sh".into(),
            args: vec![
                "-c".into(),
                "stty raw -echo; printf 'pid=%s;' $$; exec sleep 1000".into(),
            ],
            cwd: dir.path().into(),
            env: vec![],
            cols: 80,
            rows: 24,
        };
        let session = PtySession::spawn(spec, Box::new(Sink(out.clone()))).unwrap();
        let killer = session.killer();
        let mut queued = QueuedProcess::new(Box::new(session), Some(killer));

        let pgid = {
            let end = Instant::now() + Duration::from_secs(3);
            loop {
                let text = String::from_utf8_lossy(&out.lock().unwrap()).into_owned();
                if let Some(pid) = text
                    .split_once("pid=")
                    .and_then(|(_, rest)| rest.split_once(';'))
                    .and_then(|(pid, _)| pid.parse::<libc::pid_t>().ok())
                {
                    break pid;
                }
                assert!(Instant::now() < end, "no pid in {text:?}");
                std::thread::sleep(Duration::from_millis(5));
            }
        };
        queued.write(&vec![b'x'; 256 * 1024]).unwrap();
        queued.write(b"more").unwrap();
        std::thread::sleep(Duration::from_millis(200));

        let start = Instant::now();
        queued.close();

        assert!(
            start.elapsed() < Duration::from_secs(3),
            "{:?}",
            start.elapsed()
        );
        let rc = unsafe { libc::kill(-pgid, 0) };
        assert_eq!(rc, -1, "group {pgid} still alive");
        assert_eq!(io::Error::last_os_error().raw_os_error(), Some(libc::ESRCH));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn passwd_shell_is_an_absolute_path() {
        let shell = passwd_shell().expect("current user has a login shell");
        assert!(shell.starts_with('/'), "{shell}");
    }
}
