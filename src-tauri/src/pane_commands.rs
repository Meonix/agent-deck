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

use crate::activity::{PaneActivity, StatusLineSink};
use crate::commands::AppState;
use crate::hooks::{HookServer, HookSink, hook_settings};
use crate::launcher::{find_claude, login_shell_path_with, session_env};
use crate::pane_chat::PaneChat;
use crate::pane_status::{StatusOut, StatusTracker, exit_json, now_ms};
use crate::panes::{OpenError, PaneId, SessionId, Spawner, Start, close_in_parallel, resume_id};
use crate::pty::{OutputSink, PaneProcess, ProcessKiller, PtySession, SpawnSpec};
use crate::session_title::{UNTITLED, session_title};
use crate::shell::{Activity, ShellError, ShellProcess, ShellSpawner, spawn_shell};
use crate::status_line::user_status_line;
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
    resume_session_id: Option<String>,
    output: Channel<InvokeResponseBody>,
    app: AppHandle,
) -> Result<OpenedPane, String> {
    let start = match resume_session_id {
        Some(raw) => Start::Resume(resume_id(&raw).map_err(|_| "invalid_session".to_string())?),
        None => Start::New,
    };
    // Blocking work (waiting for the login-shell lookup, spawning) stays off
    // the main thread and the async workers.
    tauri::async_runtime::spawn_blocking(move || {
        open_blocking(&app, WorkspaceId(workspace_id), start, cols, rows, output)
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
pub async fn pane_title(pane_id: String, app: AppHandle) -> String {
    // Copy the id out and release the lock before touching the disk.
    let session = app
        .state::<AppState>()
        .panes
        .lock()
        .unwrap()
        .session_of(&PaneId(pane_id));
    let (Some(session), Ok(home)) = (session, app.path().home_dir()) else {
        return UNTITLED.to_string();
    };
    tauri::async_runtime::spawn_blocking(move || {
        session_title(&home.join(".claude").join("projects"), &session.0)
    })
    .await
    .unwrap_or_else(|_| UNTITLED.to_string())
}

#[tauri::command]
pub fn close_pane(pane_id: String, state: State<'_, AppState>) {
    let pane = PaneId(pane_id.clone());
    let (process, shell) = {
        // Taken under `panes`, so an `open_shell` for this pane has either registered its
        // shell already or will not find the pane.
        let mut panes = state.panes.lock().unwrap();
        let process = panes.take(&pane);
        (process, state.shells.lock().unwrap().take(&pane))
    };
    let processes: Vec<Box<dyn PaneProcess>> = process
        .into_iter()
        .chain(shell.map(|s| s as Box<dyn PaneProcess>))
        .collect();
    for pid in processes.iter().filter_map(|p| p.pid()) {
        crate::diag_commands::check_survivor(pane_id.clone(), pid);
    }
    if !processes.is_empty() {
        std::thread::spawn(move || close_in_parallel(processes));
    }
}

/// A reloaded page has lost the channels and ids of its panes, so their
/// sessions could never be used or closed again.
pub fn close_all_on_reload(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let processes = take_all_processes(&state);
    for pid in processes.iter().filter_map(|p| p.pid()) {
        crate::diag_commands::check_survivor("(reload)".into(), pid);
    }
    if !processes.is_empty() {
        std::thread::spawn(move || close_in_parallel(processes));
    }
}

pub fn close_all_on_exit(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let processes = take_all_processes(&state);
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

/// Every session and shell process, taken out of the registries under `panes`, like `close_pane`.
fn take_all_processes(state: &AppState) -> Vec<Box<dyn PaneProcess>> {
    let mut panes = state.panes.lock().unwrap();
    let mut processes = panes.take_all();
    let shells = state.shells.lock().unwrap().take_all();
    drop(panes);
    processes.extend(shells.into_iter().map(|s| s as Box<dyn PaneProcess>));
    processes
}

#[tauri::command]
pub async fn open_shell(
    pane_id: String,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
    app: AppHandle,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        open_shell_blocking(&app, PaneId(pane_id), cols, rows, output)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn shell_write(
    pane_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut shells = state.shells.lock().unwrap();
    shells
        .write(&PaneId(pane_id), data.as_bytes())
        .map_err(io_error)
}

#[tauri::command]
pub fn shell_resize(
    pane_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut shells = state.shells.lock().unwrap();
    shells
        .resize(&PaneId(pane_id), cols, rows)
        .map_err(io_error)
}

#[tauri::command]
pub fn shell_activity(pane_id: String, state: State<'_, AppState>) -> Result<Activity, String> {
    let shells = state.shells.lock().unwrap();
    shells.activity(&PaneId(pane_id)).map_err(io_error)
}

fn open_shell_blocking(
    app: &AppHandle,
    pane: PaneId,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let spawner = PtyShellSpawner {
        env: session_env(&inherited_env(), &state.launch.get().path, None),
        cols,
        rows,
    };
    let replaced = {
        // Holding `panes` keeps the pane from closing until its shell is registered.
        let list = state.list.lock().unwrap();
        let panes = state.panes.lock().unwrap();
        let workspace = panes.workspace_of(&pane).ok_or("not_found")?;
        let folder = list
            .entries(&DiskProbe)
            .into_iter()
            .find(|w| w.id == workspace && !w.missing)
            .ok_or("folder_missing")?
            .path;
        let mut shells = state.shells.lock().unwrap();
        shells
            .open(pane, &folder, &spawner, Box::new(ShellChannelSink(output)))
            .map_err(shell_error)?
    };
    if let Some(mut exited) = replaced {
        exited.close();
    }
    Ok(())
}

fn shell_error(e: ShellError) -> String {
    match e {
        ShellError::AlreadyOpen => "already_open",
        ShellError::ShellFailed => "shell_failed",
    }
    .to_string()
}

fn open_blocking(
    app: &AppHandle,
    id: WorkspaceId,
    start: Start,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
) -> Result<OpenedPane, String> {
    let state = app.state::<AppState>();
    let launch = state.launch.get();
    let env = inherited_env();
    let opened = {
        // Holding `list` keeps the workspace from being removed until the pane is registered.
        let list = state.list.lock().unwrap();
        let workspace = list
            .entries(&DiskProbe)
            .into_iter()
            .find(|w| w.id == id)
            .ok_or(OpenError::WorkspaceNotFound)
            .map_err(open_error)?;
        let tracker = Arc::new(StatusTracker::new(
            workspace.path.clone(),
            Box::new(ChannelStatus(output.clone())),
            now_ms(),
        ));
        let spawner = PtySpawner {
            launch,
            env,
            cols,
            rows,
            tracker: tracker.clone(),
            hooks: state.hooks.clone(),
            session_out: Arc::new(ChannelStatus(output.clone())),
            projects_dir: crate::session_commands::projects_dir(app).ok(),
            home: app.path().home_dir().ok(),
        };
        let sink = ChannelSink {
            channel: output,
            tracker,
        };
        let mut panes = state.panes.lock().unwrap();
        panes
            .open(&workspace, start, &spawner, Box::new(sink))
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
        OpenError::AlreadyOpen(_) => "already_open",
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
    let home = std::env::var_os("HOME").map(PathBuf::from);
    Launch {
        claude: find_claude(&path, home.as_deref()),
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

/// The app's own environment as UTF-8 pairs; `session_env` filters it per session.
fn inherited_env() -> Vec<(String, String)> {
    std::env::vars_os()
        .filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?)))
        .collect()
}

struct PtySpawner<'a> {
    launch: &'a Launch,
    env: Vec<(String, String)>,
    cols: u16,
    rows: u16,
    tracker: Arc<StatusTracker>,
    /// None when the listener could not start: spawn without hooks (D2, D5).
    hooks: Option<Arc<HookServer>>,
    session_out: Arc<dyn StatusOut>,
    /// None: the pane has no Chat feed.
    projects_dir: Option<PathBuf>,
    /// Where the user's own status line is looked up last; None skips that file.
    home: Option<PathBuf>,
}

impl Spawner for PtySpawner<'_> {
    fn spawn(
        &self,
        cwd: &Path,
        session_id: &SessionId,
        resume: bool,
        sink: Box<dyn OutputSink>,
    ) -> Option<Box<dyn PaneProcess>> {
        let program = self.launch.claude.clone()?;
        let mut args = Vec::new();
        let follower = Arc::new(SessionFollower::new(
            session_id.0.clone(),
            self.session_out.clone(),
        ));
        let chat = self.projects_dir.as_ref().map(|projects| {
            Arc::new(PaneChat::new(
                projects,
                cwd,
                &session_id.0,
                self.session_out.clone(),
            ))
        });
        let user_line = self
            .hooks
            .as_ref()
            .and_then(|_| user_status_line(cwd, self.home.as_deref()));
        // Registered before the spawn so the first hook cannot miss its sink.
        let hook = self.hooks.as_ref().map(|server| {
            let activity = Arc::new(PaneActivity::new(cwd, self.session_out.clone()));
            let token = uuid::Uuid::new_v4().to_string();
            let sink = PaneHooks {
                tracker: self.tracker.clone(),
                follower: follower.clone(),
                chat: chat.clone(),
                activity: activity.clone(),
            };
            server.register(&token, Arc::new(sink));
            let status_token = uuid::Uuid::new_v4().to_string();
            server.register(&status_token, Arc::new(StatusLineSink(activity)));
            args.push("--settings".into());
            args.push(hook_settings(
                &server.url_for(&token),
                &server.url_for(&status_token),
                user_line.as_ref(),
            ));
            (server.clone(), [token, status_token])
        });
        args.push(if resume { "--resume" } else { "--session-id" }.into());
        args.push(session_id.0.clone());
        let spec = SpawnSpec {
            program,
            args,
            cwd: cwd.to_path_buf(),
            env: session_env(
                &self.env,
                &self.launch.path,
                user_line.as_ref().map(|l| l.command.as_str()),
            ),
            cols: self.cols,
            rows: self.rows,
        };
        match PtySession::spawn(spec, sink) {
            Ok(session) => {
                let killer = session.killer();
                match &chat {
                    Some(chat) => chat.start(),
                    None => self
                        .session_out
                        .send_json(serde_json::json!({"chat": {"unreadable": true}}).to_string()),
                }
                Some(Box::new(TrackedProcess {
                    inner: QueuedProcess::new(Box::new(session), Some(killer)),
                    tracker: self.tracker.clone(),
                    follower,
                    hook,
                    chat,
                }))
            }
            Err(e) => {
                crate::diag::error("pane", &format!("claude could not be started: {e}"));
                if let Some((server, tokens)) = hook {
                    tokens.iter().for_each(|t| server.unregister(t));
                }
                None
            }
        }
    }
}

/// The user's login shell, so rc files and the prompt are their own; PowerShell on Windows.
struct PtyShellSpawner {
    env: Vec<(String, String)>,
    cols: u16,
    rows: u16,
}

impl ShellSpawner for PtyShellSpawner {
    fn spawn(&self, cwd: &Path, sink: Box<dyn OutputSink>) -> Option<Box<dyn ShellProcess>> {
        #[cfg(unix)]
        let (program, flag) = (user_shell().unwrap_or_else(|| "/bin/sh".into()), "-l");
        #[cfg(windows)]
        let (program, flag) = ("powershell.exe".to_string(), "-NoLogo");
        let spec = SpawnSpec {
            program: program.into(),
            args: vec![flag.into()],
            cwd: cwd.to_path_buf(),
            env: self.env.clone(),
            cols: self.cols,
            rows: self.rows,
        };
        match spawn_shell(spec, sink) {
            Ok(shell) => Some(Box::new(shell)),
            Err(e) => {
                crate::diag::error("shell", &format!("shell could not be started: {e}"));
                None
            }
        }
    }
}

/// Output as raw bytes, then `{"exited": code}` as the last message; a shell has no status.
struct ShellChannelSink(Channel<InvokeResponseBody>);

impl OutputSink for ShellChannelSink {
    fn output(&self, chunk: Vec<u8>) {
        let _ = self.0.send(InvokeResponseBody::Raw(chunk));
    }

    fn exited(&self, code: Option<i32>) {
        let _ = self.0.send(InvokeResponseBody::Json(exit_json(code)));
    }
}

/// Output as raw bytes; the exit goes through the tracker, which sends the final
/// status and then `{"exited": code}` as the last message on the same channel,
/// so it can neither be missed nor overtake output.
struct ChannelSink {
    channel: Channel<InvokeResponseBody>,
    tracker: Arc<StatusTracker>,
}

impl OutputSink for ChannelSink {
    fn output(&self, chunk: Vec<u8>) {
        let _ = self.channel.send(InvokeResponseBody::Raw(chunk));
    }

    fn exited(&self, code: Option<i32>) {
        self.tracker.exited(code, now_ms());
    }
}

/// Status and exit messages share the pane's channel with its output (D6).
struct ChannelStatus(Channel<InvokeResponseBody>);

impl StatusOut for ChannelStatus {
    fn send_json(&self, json: String) {
        let _ = self.0.send(InvokeResponseBody::Json(json));
    }
}

/// The pane's hook sink: the tracker sees the event first, so status timing is as before.
struct PaneHooks {
    tracker: Arc<StatusTracker>,
    follower: Arc<SessionFollower>,
    chat: Option<Arc<PaneChat>>,
    activity: Arc<PaneActivity>,
}

impl HookSink for PaneHooks {
    fn hook(&self, event: serde_json::Value) {
        self.tracker.hook(event.clone());
        self.follower.follow(&event);
        if let Some(chat) = &self.chat {
            chat.follow(&event);
        }
        self.activity.hook(&event);
    }
}

/// The session a pane's Claude Code is in: `/clear` moves it to a new one, and the
/// pane must remember and resume that one, not the session it was opened with
/// (SRS-FR-084). The UI learns of a move from `{"session": id}`.
struct SessionFollower {
    current: Mutex<String>,
    out: Arc<dyn StatusOut>,
}

impl SessionFollower {
    fn new(session_id: String, out: Arc<dyn StatusOut>) -> Self {
        SessionFollower {
            current: Mutex::new(session_id),
            out,
        }
    }

    /// A `SessionEnd` names the session being left and can arrive after the next one started.
    fn follow(&self, event: &serde_json::Value) {
        if event["hook_event_name"] == "SessionEnd" {
            return;
        }
        let Some(id) = event["session_id"].as_str().filter(|id| !id.is_empty()) else {
            return;
        };
        let mut current = self.current.lock().unwrap();
        if *current != id {
            *current = id.to_string();
            self.out
                .send_json(serde_json::json!({ "session": id }).to_string());
        }
    }

    fn current(&self) -> String {
        self.current.lock().unwrap().clone()
    }
}

/// A pane process that tells its tracker about input and a close by the user, and
/// drops its hook and status line tokens and stops its Chat feed when it closes.
struct TrackedProcess {
    inner: QueuedProcess,
    tracker: Arc<StatusTracker>,
    /// Same follower as the pane's hook sink; it tells the registry the live session.
    follower: Arc<SessionFollower>,
    /// None when the pane was spawned without a listener.
    hook: Option<(Arc<HookServer>, [String; 2])>,
    chat: Option<Arc<PaneChat>>,
}

impl TrackedProcess {
    fn release(&self) {
        if let Some((server, tokens)) = &self.hook {
            tokens.iter().for_each(|t| server.unregister(t));
        }
        if let Some(chat) = &self.chat {
            chat.stop();
        }
    }
}

impl PaneProcess for TrackedProcess {
    fn write(&mut self, data: &[u8]) -> io::Result<()> {
        self.tracker.user_input(data, now_ms());
        self.inner.write(data)
    }

    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        self.inner.resize(cols, rows)
    }

    fn close(&mut self) {
        self.tracker.close_by_user();
        self.release();
        self.inner.close();
    }

    fn pid(&self) -> Option<u32> {
        self.inner.pid()
    }

    fn session(&self) -> Option<String> {
        Some(self.follower.current())
    }
}

impl Drop for TrackedProcess {
    fn drop(&mut self) {
        self.release();
    }
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
                    crate::diag::error("pane", &format!("pane input failed: {e}"));
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

    fn pid(&self) -> Option<u32> {
        self.killer.as_ref().and_then(ProcessKiller::pid)
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

    struct ExitSink(Arc<Mutex<Vec<u8>>>, Mutex<Sender<Option<i32>>>);

    impl OutputSink for ExitSink {
        fn output(&self, chunk: Vec<u8>) {
            self.0.lock().unwrap().extend(chunk);
        }
        fn exited(&self, code: Option<i32>) {
            let _ = self.1.lock().unwrap().send(code);
        }
    }

    #[derive(Clone, Default)]
    struct Outbox(Arc<Mutex<Vec<String>>>);

    impl StatusOut for Outbox {
        fn send_json(&self, json: String) {
            self.0.lock().unwrap().push(json);
        }
    }

    #[test]
    fn follower_moves_to_the_session_claude_code_reports() {
        use serde_json::{Value, json};
        let out = Outbox::default();
        let follower = SessionFollower::new("s1".into(), Arc::new(out.clone()));
        follower.follow(&json!({"hook_event_name": "SessionStart", "session_id": "s1"}));
        assert_eq!(follower.current(), "s1");
        assert!(out.0.lock().unwrap().is_empty(), "the opened session is not news");

        // `/clear` ends s1 and starts s2; the late SessionEnd of s1 must not move it back.
        follower.follow(&json!({"hook_event_name": "SessionStart", "session_id": "s2", "source": "clear"}));
        follower.follow(&json!({"hook_event_name": "SessionEnd", "session_id": "s1"}));
        follower.follow(&json!({"hook_event_name": "UserPromptSubmit", "session_id": "s2"}));
        follower.follow(&json!({"hook_event_name": "Stop"}));
        assert_eq!(follower.current(), "s2");
        let sent: Vec<Value> = out.0.lock().unwrap().iter().map(|j| serde_json::from_str(j).unwrap()).collect();
        assert_eq!(sent, vec![json!({"session": "s2"})]);
    }

    fn tracker(out: &Outbox) -> Arc<StatusTracker> {
        Arc::new(StatusTracker::new("/w".into(), Box::new(out.clone()), 1))
    }

    fn spawner<'a>(
        launch: &'a Launch,
        env: Vec<(String, String)>,
        tracker: Arc<StatusTracker>,
        hooks: Option<Arc<HookServer>>,
    ) -> PtySpawner<'a> {
        PtySpawner {
            launch,
            env,
            cols: 200,
            rows: 24,
            tracker,
            hooks,
            session_out: Arc::new(Outbox::default()),
            projects_dir: None,
            home: None,
        }
    }

    /// A `claude` that runs `print`, reads one line, then exits with `code`.
    #[cfg(unix)]
    fn fake_claude(bin: &Path, print: &str, code: i32) -> Launch {
        use std::os::unix::fs::PermissionsExt;
        let claude = bin.join("claude");
        std::fs::write(
            &claude,
            format!("#!/bin/sh\n{print}\nread line\nexit {code}\n"),
        )
        .unwrap();
        std::fs::set_permissions(&claude, std::fs::Permissions::from_mode(0o755)).unwrap();
        let launch = launch_for(format!("{}:/usr/bin:/bin", bin.display()));
        assert_eq!(launch.claude.as_deref(), Some(claude.as_path()));
        launch
    }

    #[cfg(unix)]
    /// The URL `event`'s command hook posts to.
    fn hook_url(settings: &serde_json::Value, event: &str) -> String {
        let command = settings["hooks"][event][0]["hooks"][0]["command"]
            .as_str()
            .expect("command hook");
        let url = command.split_whitespace().find(|w| w.starts_with("http://"));
        url.expect("hook url").trim_end_matches(';').to_string()
    }

    /// Waits until the process has printed a full `\x01…\x02` record of `\x1f`-separated
    /// fields; control characters, as the settings JSON holds `<`, `|` and `>`.
    fn printed_fields(out: &Mutex<Vec<u8>>) -> Vec<String> {
        let end = Instant::now() + Duration::from_secs(3);
        loop {
            let text = String::from_utf8_lossy(&out.lock().unwrap()).into_owned();
            if let Some(record) = text
                .split_once('\x01')
                .and_then(|(_, rest)| rest.split_once('\x02'))
                .map(|(record, _)| record.to_string())
            {
                return record.split('\x1f').map(String::from).collect();
            }
            assert!(Instant::now() < end, "no record in {text:?}");
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    #[cfg(unix)]
    #[test]
    fn pty_spawner_without_a_listener_runs_claude_with_only_the_session_id() {
        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let launch = fake_claude(
            bin.path(),
            r#"printf '\001%s\037%s\037%s\037%s\037%s\002' "$#" "$1" "$2" "$PWD" "$PATH""#,
            7,
        );
        let out = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();
        let spawner = spawner(&launch, inherited_env(), tracker(&Outbox::default()), None);

        let mut process = spawner
            .spawn(
                cwd.path(),
                &SessionId("sid-1".into()),
                false,
                Box::new(ExitSink(out.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        let fields = printed_fields(&out);
        process.write(b"\n").unwrap();

        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(7));
        let pwd = dunce::canonicalize(cwd.path()).unwrap();
        assert_eq!(
            fields,
            [
                "2".to_string(),
                "--session-id".into(),
                "sid-1".into(),
                pwd.display().to_string(),
                launch.path.clone()
            ]
        );
        process.close();
    }

    #[cfg(unix)]
    #[test]
    fn pty_spawner_resume_runs_claude_with_resume_and_no_session_id() {
        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let launch = fake_claude(
            bin.path(),
            r#"printf '\001%s\037%s\037%s\002' "$#" "$1" "$2""#,
            0,
        );
        let out = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();
        let spawner = spawner(&launch, inherited_env(), tracker(&Outbox::default()), None);

        let mut process = spawner
            .spawn(
                cwd.path(),
                &SessionId("sid-1".into()),
                true,
                Box::new(ExitSink(out.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        let fields = printed_fields(&out);
        process.write(b"\n").unwrap();

        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(0));
        assert_eq!(fields, ["2", "--resume", "sid-1"]);
        process.close();
    }

    /// SRS-NFR-006: hooks travel inline on the command line; nothing lands in HOME.
    #[cfg(unix)]
    #[test]
    fn pty_spawner_passes_inline_hook_settings_and_writes_nothing_under_home() {
        use crate::hooks::test_client::post_url;

        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        let launch = fake_claude(
            bin.path(),
            r#"printf '\001%s\037%s\037%s\037%s\037%s\037%s\002' "$#" "$1" "$2" "$3" "$4" "$HOME""#,
            0,
        );
        let server = Arc::new(HookServer::start().unwrap());
        let statuses = Outbox::default();
        let env = vec![("HOME".to_string(), home.path().display().to_string())];
        let spawner = spawner(&launch, env, tracker(&statuses), Some(server.clone()));
        let out = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();

        let mut process = spawner
            .spawn(
                cwd.path(),
                &SessionId("sid-1".into()),
                false,
                Box::new(ExitSink(out.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        let fields = printed_fields(&out);

        assert_eq!(fields.len(), 6, "{fields:?}");
        assert_eq!(
            [&fields[0], &fields[1], &fields[3], &fields[4], &fields[5]],
            [
                "4",
                "--settings",
                "--session-id",
                "sid-1",
                &home.path().display().to_string()
            ]
        );
        let settings: serde_json::Value = serde_json::from_str(&fields[2]).unwrap();
        let url = hook_url(&settings, "Stop");
        assert!(url.starts_with(&server.url_for("")), "{url}");
        assert!(!url.ends_with("sid-1"), "token must not be the session id");
        assert!(fields[2].contains(&format!("'@-' {url}")), "{}", fields[2]);

        // The token in the settings reaches this pane's tracker.
        let response = post_url(&url, r#"{"hook_event_name":"SessionStart"}"#);
        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        let end = Instant::now() + Duration::from_secs(3);
        while statuses.0.lock().unwrap().is_empty() && Instant::now() < end {
            std::thread::sleep(Duration::from_millis(1));
        }
        assert_eq!(
            *statuses.0.lock().unwrap(),
            [r#"{"status":{"state":"Idle","since":1,"reason":null,"tracked":true}}"#]
        );

        process.write(b"\n").unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(0));
        process.close();

        let response = post_url(&url, r#"{"hook_event_name":"Stop"}"#);
        assert!(response.starts_with("HTTP/1.1 404"), "{response}");
        assert_eq!(server.registered(), 0);
        assert_eq!(std::fs::read_dir(home.path()).unwrap().count(), 0);
        // Nor in the workspace, e.g. `.claude/settings.local.json`.
        assert_eq!(std::fs::read_dir(cwd.path()).unwrap().count(), 0);
    }

    /// The URL the status line command posts its input to.
    #[cfg(unix)]
    fn status_url(settings: &serde_json::Value) -> String {
        let command = settings["statusLine"]["command"]
            .as_str()
            .expect("status line");
        let url = command
            .split_whitespace()
            .find(|w| w.starts_with("http://"));
        url.expect("status url").to_string()
    }

    #[cfg(unix)]
    fn activity_messages(out: &Outbox, n: usize) -> Vec<serde_json::Value> {
        let end = Instant::now() + Duration::from_secs(3);
        loop {
            let sent: Vec<serde_json::Value> = out
                .0
                .lock()
                .unwrap()
                .iter()
                .map(|j| serde_json::from_str::<serde_json::Value>(j).unwrap())
                .filter(|m| m.get("activity").is_some())
                .collect();
            if sent.len() >= n || Instant::now() >= end {
                return sent;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    /// SRS-FR-152: hooks and the status line input reach the pane's Activity Bar.
    #[cfg(unix)]
    #[test]
    fn pane_hooks_and_status_line_send_activity_until_the_pane_closes() {
        use crate::hooks::test_client::post_url;
        use serde_json::json;

        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let launch = fake_claude(bin.path(), r#"printf '\001%s\002' "$2""#, 0);
        let server = Arc::new(HookServer::start().unwrap());
        let out = Outbox::default();
        let mut spawner = spawner(
            &launch,
            vec![],
            tracker(&Outbox::default()),
            Some(server.clone()),
        );
        spawner.session_out = Arc::new(out.clone());
        let printed = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();

        let mut process = spawner
            .spawn(
                cwd.path(),
                &SessionId("sid-1".into()),
                false,
                Box::new(ExitSink(printed.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        let fields = printed_fields(&printed);
        let settings: serde_json::Value = serde_json::from_str(&fields[0]).unwrap();
        let (hooks, status) = (hook_url(&settings, "PreToolUse"), status_url(&settings));
        assert_ne!(hooks, status);
        assert_eq!(server.registered(), 2);

        let pre = json!({"hook_event_name": "PreToolUse", "session_id": "sid-1", "tool_name": "Bash",
            "tool_input": {"command": "npm test"}, "tool_use_id": "toolu_1"});
        post_url(&hooks, &pre.to_string());
        post_url(&status, r#"{"context_window":{"used_percentage":41.6}}"#);
        let activity = |context: serde_json::Value| json!({"activity": {"tool": "Bash", "arg": "npm test", "context": context, "shells": 0, "subagents": 0}});
        assert_eq!(
            activity_messages(&out, 2),
            [activity(serde_json::Value::Null), activity(json!(42))]
        );

        process.write(b"\n").unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(0));
        process.close();
        assert_eq!(server.registered(), 0);
        let response = post_url(&status, r#"{"context_window":{"used_percentage":50}}"#);
        assert!(response.starts_with("HTTP/1.1 404"), "{response}");
    }

    /// status-board › SRS-NFR-006: the user's status line is read, passed on, and left as it was.
    #[cfg(unix)]
    #[test]
    fn pty_spawner_passes_the_users_status_line_in_the_env() {
        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let settings_file = cwd.path().join(".claude/settings.json");
        std::fs::create_dir_all(settings_file.parent().unwrap()).unwrap();
        let text =
            r#"{"statusLine":{"type":"command","command":"echo 'main · 3 files'","padding":1}}"#;
        std::fs::write(&settings_file, text).unwrap();
        let modified = std::fs::metadata(&settings_file)
            .unwrap()
            .modified()
            .unwrap();
        let launch = fake_claude(
            bin.path(),
            r#"printf '\001%s\037%s\002' "$2" "$AGENT_DECK_STATUSLINE""#,
            0,
        );
        let server = Arc::new(HookServer::start().unwrap());
        let spawner = spawner(&launch, vec![], tracker(&Outbox::default()), Some(server));
        let printed = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();

        let mut process = spawner
            .spawn(
                cwd.path(),
                &SessionId("sid-1".into()),
                false,
                Box::new(ExitSink(printed.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        let fields = printed_fields(&printed);
        process.write(b"\n").unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(0));
        process.close();

        let settings: serde_json::Value = serde_json::from_str(&fields[0]).unwrap();
        assert_eq!(settings["statusLine"]["padding"], 1);
        assert_eq!(fields[1], "echo 'main · 3 files'");
        assert_eq!(std::fs::read_to_string(&settings_file).unwrap(), text);
        assert_eq!(
            std::fs::metadata(&settings_file)
                .unwrap()
                .modified()
                .unwrap(),
            modified
        );
    }

    #[cfg(unix)]
    #[test]
    fn pane_hook_url_adds_nothing_to_prompts() {
        use crate::hooks::test_client::post_url;

        let bin = tempfile::tempdir().unwrap();
        let cwd = tempfile::tempdir().unwrap();
        let launch = fake_claude(bin.path(), r#"printf '\001%s\002' "$2""#, 0);
        let server = Arc::new(HookServer::start().unwrap());
        let spawner = spawner(
            &launch,
            vec![],
            tracker(&Outbox::default()),
            Some(server.clone()),
        );
        let out = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();

        let mut process = spawner
            .spawn(
                cwd.path(),
                &SessionId("sid-1".into()),
                true,
                Box::new(ExitSink(out.clone(), Mutex::new(tx))),
            )
            .expect("spawned");
        let fields = printed_fields(&out);
        let settings: serde_json::Value = serde_json::from_str(&fields[0]).unwrap();
        let url = hook_url(&settings, "UserPromptSubmit");

        let response = post_url(
            &url,
            r#"{"hook_event_name":"UserPromptSubmit","session_id":"sid-1","prompt":"thêm nút export"}"#,
        );
        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        assert!(response.ends_with("\r\n\r\n"), "{response}");

        process.write(b"\n").unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).unwrap(), Some(0));
        process.close();
    }

    #[test]
    fn pty_spawner_drops_the_token_when_claude_fails_to_start() {
        let dir = tempfile::tempdir().unwrap();
        let launch = Launch {
            claude: Some(dir.path().join("missing-claude")),
            path: String::new(),
        };
        let server = Arc::new(HookServer::start().unwrap());
        let spawner = spawner(
            &launch,
            vec![],
            tracker(&Outbox::default()),
            Some(server.clone()),
        );
        let (tx, _rx) = mpsc::channel();
        let sink = ExitSink(Arc::default(), Mutex::new(tx));

        assert!(
            spawner
                .spawn(dir.path(), &SessionId("s".into()), false, Box::new(sink))
                .is_none()
        );
        assert_eq!(server.registered(), 0);
    }

    #[test]
    fn pty_spawner_without_claude_starts_nothing() {
        let launch = Launch {
            claude: None,
            path: String::new(),
        };
        let server = Arc::new(HookServer::start().unwrap());
        let spawner = spawner(
            &launch,
            vec![],
            tracker(&Outbox::default()),
            Some(server.clone()),
        );
        let (tx, _rx) = mpsc::channel();
        let dir = tempfile::tempdir().unwrap();
        assert!(
            spawner
                .spawn(
                    dir.path(),
                    &SessionId("s".into()),
                    false,
                    Box::new(ExitSink(Arc::default(), Mutex::new(tx)))
                )
                .is_none()
        );
        assert_eq!(server.registered(), 0);
    }

    fn wait_for(calls: &Mutex<Vec<Call>>, n: usize) {
        let end = Instant::now() + Duration::from_secs(3);
        while calls.lock().unwrap().len() < n && Instant::now() < end {
            std::thread::sleep(Duration::from_millis(1));
        }
    }

    /// F-I3: input goes through the tracker before it reaches the session.
    #[test]
    fn tracked_process_answers_a_wait_with_an_answer_key_and_still_writes_it() {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let out = Outbox::default();
        let tracker = tracker(&out);
        tracker.hook(serde_json::json!({"hook_event_name": "UserPromptSubmit"}));
        tracker
            .hook(serde_json::json!({"hook_event_name": "PermissionRequest", "tool_name": "Bash"}));
        out.0.lock().unwrap().clear();
        let mut process = TrackedProcess {
            inner: QueuedProcess::new(Box::new(Recorder(calls.clone())), None),
            tracker,
            follower: Arc::new(SessionFollower::new("s".into(), Arc::new(Outbox::default()))),
            hook: None,
            chat: None,
        };

        process.write(b"\x1b[I").unwrap();
        assert!(out.0.lock().unwrap().is_empty());
        process.write(b"1").unwrap();
        wait_for(&calls, 2);

        let sent = out.0.lock().unwrap().clone();
        assert_eq!(sent.len(), 1, "{sent:?}");
        assert!(sent[0].contains(r#""state":"Running""#), "{sent:?}");
        assert_eq!(
            *calls.lock().unwrap(),
            [Call::Write(b"\x1b[I".to_vec()), Call::Write(b"1".to_vec())]
        );
        process.close();
    }

    struct TrackerSink(Arc<StatusTracker>, Mutex<Sender<()>>);

    impl OutputSink for TrackerSink {
        fn output(&self, _chunk: Vec<u8>) {}
        fn exited(&self, code: Option<i32>) {
            self.0.exited(code, now_ms());
            let _ = self.1.lock().unwrap().send(());
        }
    }

    /// F-M3: closing a busy pane sends `{"exited"}` without an `Error · killed` status,
    /// with and without a listener.
    #[cfg(unix)]
    #[test]
    fn closing_a_pane_sends_no_status_for_its_exit() {
        for listener in [false, true] {
            let bin = tempfile::tempdir().unwrap();
            let cwd = tempfile::tempdir().unwrap();
            let launch = fake_claude(bin.path(), "printf ready", 0);
            let out = Outbox::default();
            let tracker = tracker(&out);
            let hooks = listener.then(|| Arc::new(HookServer::start().unwrap()));
            let spawner = spawner(&launch, inherited_env(), tracker.clone(), hooks);
            let (tx, rx) = mpsc::channel();

            let mut process = spawner
                .spawn(
                    cwd.path(),
                    &SessionId("s".into()),
                    false,
                    Box::new(TrackerSink(tracker.clone(), Mutex::new(tx))),
                )
                .expect("spawned");
            tracker.hook(serde_json::json!({"hook_event_name": "UserPromptSubmit"}));
            out.0.lock().unwrap().clear();
            process.close();

            rx.recv_timeout(Duration::from_secs(3)).expect("exited");
            let sent = out.0.lock().unwrap().clone();
            assert_eq!(sent.len(), 1, "listener {listener}: {sent:?}");
            assert!(sent[0].starts_with(r#"{"exited":"#), "{sent:?}");
        }
    }

    #[test]
    fn channel_sink_sends_the_final_status_before_exited() {
        let sent = Arc::new(Mutex::new(Vec::new()));
        let log = sent.clone();
        let channel = Channel::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                log.lock().unwrap().push(json);
            }
            Ok(())
        });
        let tracker = Arc::new(StatusTracker::new(
            "/w".into(),
            Box::new(ChannelStatus(channel.clone())),
            1,
        ));
        let sink = ChannelSink { channel, tracker };

        sink.exited(Some(0));

        let sent = sent.lock().unwrap();
        assert_eq!(sent.len(), 2, "{sent:?}");
        let status: serde_json::Value = serde_json::from_str(&sent[0]).unwrap();
        assert_eq!(status["status"]["state"], "Ended");
        assert_eq!(sent[1], r#"{"exited":0}"#);
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

    mod chat {
        use super::*;
        use crate::transcript::expected_path;
        use serde_json::{Value, json};
        use std::io::Write;

        fn prompt_line(uuid: &str, text: &str) -> String {
            json!({"type": "user", "uuid": uuid, "message": {"role": "user", "content": text}})
                .to_string()
                + "\n"
        }

        fn prompt(uuid: &str, text: &str) -> Value {
            json!({"kind": "prompt", "key": format!("{uuid}:0"), "text": text})
        }

        fn append(path: &Path, text: &str) {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .unwrap();
            file.write_all(text.as_bytes()).unwrap();
        }

        /// `{"chat"}` and `{"session"}` messages sent so far.
        fn feed(out: &Outbox) -> Vec<Value> {
            out.0
                .lock()
                .unwrap()
                .iter()
                .map(|j| serde_json::from_str::<Value>(j).unwrap())
                .filter(|m| m.get("chat").is_some() || m.get("session").is_some())
                .collect()
        }

        fn wait_feed(out: &Outbox, n: usize) -> Vec<Value> {
            let end = Instant::now() + Duration::from_secs(3);
            loop {
                let sent = feed(out);
                if sent.len() >= n {
                    return sent;
                }
                assert!(Instant::now() < end, "{n} messages expected, got {sent:?}");
                std::thread::sleep(Duration::from_millis(5));
            }
        }

        /// Long enough for a running tail thread to have polled twice more.
        fn quiet() {
            std::thread::sleep(crate::transcript::POLL_INTERVAL * 2 + Duration::from_millis(100));
        }

        fn reset(items: Vec<Value>) -> Value {
            json!({"chat": {"reset": true, "items": items}})
        }

        struct Pane {
            out: Outbox,
            hooks: PaneHooks,
            chat: Arc<PaneChat>,
        }

        fn pane(projects: &Path, cwd: &Path, session: &str) -> Pane {
            let out = Outbox::default();
            let chat = Arc::new(PaneChat::new(projects, cwd, session, Arc::new(out.clone())));
            let hooks = PaneHooks {
                tracker: tracker(&Outbox::default()),
                follower: Arc::new(SessionFollower::new(session.into(), Arc::new(out.clone()))),
                chat: Some(chat.clone()),
                activity: Arc::new(PaneActivity::new(cwd, Arc::new(out.clone()))),
            };
            chat.start();
            Pane { out, hooks, chat }
        }

        #[cfg(unix)]
        #[test]
        fn a_spawned_pane_first_sends_a_chat_reset() {
            let bin = tempfile::tempdir().unwrap();
            let cwd = tempfile::tempdir().unwrap();
            let projects = tempfile::tempdir().unwrap();
            let launch = fake_claude(bin.path(), "printf ready", 0);
            let out = Outbox::default();
            let mut spawner = spawner(&launch, vec![], tracker(&Outbox::default()), None);
            spawner.session_out = Arc::new(out.clone());
            spawner.projects_dir = Some(projects.path().into());
            let (tx, _rx) = mpsc::channel();

            let mut process = spawner
                .spawn(
                    cwd.path(),
                    &SessionId("s1".into()),
                    false,
                    Box::new(ExitSink(Arc::default(), Mutex::new(tx))),
                )
                .expect("spawned");

            assert_eq!(wait_feed(&out, 1)[0], reset(vec![]));
            process.close();
        }

        #[cfg(unix)]
        #[test]
        fn a_pane_without_a_projects_dir_sends_unreadable_once() {
            let bin = tempfile::tempdir().unwrap();
            let cwd = tempfile::tempdir().unwrap();
            let launch = fake_claude(bin.path(), "printf ready", 0);
            let out = Outbox::default();
            let mut spawner = spawner(&launch, vec![], tracker(&Outbox::default()), None);
            spawner.session_out = Arc::new(out.clone());
            let (tx, _rx) = mpsc::channel();

            let mut process = spawner
                .spawn(
                    cwd.path(),
                    &SessionId("s1".into()),
                    false,
                    Box::new(ExitSink(Arc::default(), Mutex::new(tx))),
                )
                .expect("spawned");
            quiet();

            assert_eq!(feed(&out), [json!({"chat": {"unreadable": true}})]);
            process.close();
        }

        #[cfg(unix)]
        #[test]
        fn closing_the_pane_stops_the_chat_thread() {
            let bin = tempfile::tempdir().unwrap();
            let cwd = tempfile::tempdir().unwrap();
            let projects = tempfile::tempdir().unwrap();
            let file = expected_path(projects.path(), cwd.path(), "s1");
            append(&file, &prompt_line("a", "một"));
            let launch = fake_claude(bin.path(), "printf ready", 0);
            let out = Outbox::default();
            let server = Arc::new(HookServer::start().unwrap());
            let mut spawner = spawner(&launch, vec![], tracker(&Outbox::default()), Some(server));
            spawner.session_out = Arc::new(out.clone());
            spawner.projects_dir = Some(projects.path().into());
            let (tx, _rx) = mpsc::channel();

            let mut process = spawner
                .spawn(
                    cwd.path(),
                    &SessionId("s1".into()),
                    false,
                    Box::new(ExitSink(Arc::default(), Mutex::new(tx))),
                )
                .expect("spawned");
            assert_eq!(wait_feed(&out, 1), [reset(vec![prompt("a", "một")])]);
            process.close();
            append(&file, &prompt_line("b", "hai"));
            quiet();

            assert_eq!(feed(&out), [reset(vec![prompt("a", "một")])]);
        }

        #[test]
        fn a_failed_spawn_sends_no_chat() {
            let dir = tempfile::tempdir().unwrap();
            let projects = tempfile::tempdir().unwrap();
            let launch = Launch {
                claude: Some(dir.path().join("missing-claude")),
                path: String::new(),
            };
            let out = Outbox::default();
            let mut spawner = spawner(&launch, vec![], tracker(&Outbox::default()), None);
            spawner.session_out = Arc::new(out.clone());
            spawner.projects_dir = Some(projects.path().into());
            let (tx, _rx) = mpsc::channel();

            assert!(
                spawner
                    .spawn(
                        dir.path(),
                        &SessionId("s".into()),
                        false,
                        Box::new(ExitSink(Arc::default(), Mutex::new(tx)))
                    )
                    .is_none()
            );
            quiet();
            assert_eq!(feed(&out), Vec::<Value>::new());
        }

        #[test]
        fn a_hook_transcript_path_moves_the_tail() {
            let projects = tempfile::tempdir().unwrap();
            let elsewhere = tempfile::tempdir().unwrap();
            let other = elsewhere.path().join("s1.jsonl");
            append(&other, &prompt_line("a", "một"));
            let pane = pane(projects.path(), Path::new("/work/app"), "s1");
            assert_eq!(wait_feed(&pane.out, 1), [reset(vec![])]);

            pane.hooks.hook(json!({
                "hook_event_name": "SessionStart",
                "session_id": "s1",
                "transcript_path": other,
            }));

            assert_eq!(
                wait_feed(&pane.out, 2),
                [reset(vec![]), reset(vec![prompt("a", "một")])]
            );
            pane.chat.stop();
        }

        #[test]
        fn a_new_session_sends_session_then_a_reset_from_its_file_and_leaves_the_old_one() {
            let projects = tempfile::tempdir().unwrap();
            let cwd = Path::new("/work/app");
            let old = expected_path(projects.path(), cwd, "s1");
            let new = expected_path(projects.path(), cwd, "s2");
            append(&old, &prompt_line("a", "cũ"));
            append(&new, &prompt_line("b", "mới"));
            let pane = pane(projects.path(), cwd, "s1");
            assert_eq!(wait_feed(&pane.out, 1), [reset(vec![prompt("a", "cũ")])]);

            pane.hooks.hook(json!({
                "hook_event_name": "SessionStart",
                "session_id": "s2",
                "source": "clear",
                "transcript_path": new,
            }));
            // Late, names the old session and its file.
            pane.hooks.hook(json!({
                "hook_event_name": "SessionEnd",
                "session_id": "s1",
                "transcript_path": old,
            }));
            let sent = wait_feed(&pane.out, 3);
            append(&old, &prompt_line("c", "cũ nữa"));
            quiet();

            assert_eq!(
                feed(&pane.out),
                [
                    reset(vec![prompt("a", "cũ")]),
                    json!({"session": "s2"}),
                    reset(vec![prompt("b", "mới")]),
                ],
                "{sent:?}"
            );
            pane.chat.stop();
        }

        #[test]
        fn a_new_session_without_a_transcript_path_moves_to_its_expected_file() {
            let projects = tempfile::tempdir().unwrap();
            let cwd = Path::new("/work/app");
            append(
                &expected_path(projects.path(), cwd, "s2"),
                &prompt_line("b", "mới"),
            );
            let pane = pane(projects.path(), cwd, "s1");
            assert_eq!(wait_feed(&pane.out, 1), [reset(vec![])]);

            pane.hooks
                .hook(json!({"hook_event_name": "UserPromptSubmit", "session_id": "s2"}));

            assert_eq!(
                wait_feed(&pane.out, 3),
                [
                    reset(vec![]),
                    json!({"session": "s2"}),
                    reset(vec![prompt("b", "mới")]),
                ]
            );
            pane.chat.stop();
        }

        #[test]
        fn a_long_first_read_arrives_as_a_reset_of_500_and_appends() {
            let projects = tempfile::tempdir().unwrap();
            let cwd = Path::new("/work/app");
            let lines: String = (0..1200)
                .map(|i| prompt_line(&format!("u{i}"), &format!("p{i}")))
                .collect();
            append(&expected_path(projects.path(), cwd, "s1"), &lines);

            let pane = pane(projects.path(), cwd, "s1");
            let sent = wait_feed(&pane.out, 3);
            pane.chat.stop();

            let sizes: Vec<(bool, usize)> = sent
                .iter()
                .map(|m| {
                    (
                        m["chat"].get("reset").is_some(),
                        m["chat"]["items"].as_array().unwrap().len(),
                    )
                })
                .collect();
            assert_eq!(sizes, [(true, 500), (false, 500), (false, 200)]);
            assert_eq!(sent[0]["chat"]["reset"], true);
            assert_eq!(sent[1]["chat"]["items"][0], prompt("u500", "p500"));
            assert_eq!(sent[2]["chat"]["items"][199], prompt("u1199", "p1199"));
        }

        #[test]
        fn an_unreadable_transcript_sends_unreadable() {
            let projects = tempfile::tempdir().unwrap();
            let cwd = Path::new("/work/app");
            std::fs::create_dir_all(expected_path(projects.path(), cwd, "s1")).unwrap();

            let pane = pane(projects.path(), cwd, "s1");

            assert_eq!(
                wait_feed(&pane.out, 1),
                [json!({"chat": {"unreadable": true}})]
            );
            pane.chat.stop();
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn passwd_shell_is_an_absolute_path() {
        let shell = passwd_shell().expect("current user has a login shell");
        assert!(shell.starts_with('/'), "{shell}");
    }
}
