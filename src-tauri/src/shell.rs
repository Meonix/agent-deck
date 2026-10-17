use std::collections::HashMap;
use std::io;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

use crate::pane_commands::QueuedProcess;
use crate::panes::{EndSink, PaneId};
use crate::pty::{EndScope, ForegroundProbe, OutputSink, PaneProcess, PtySession, SpawnSpec};

/// Programs whose first argument, when it is not a flag, is the script that names the command.
const INTERPRETERS: [&str; 7] = ["node", "python", "python3", "ruby", "perl", "bun", "deno"];

/// The text of the Shell chip for a foreground command: `node /opt/homebrew/bin/npm run dev`
/// reads `npm run dev`.
pub fn command_label(argv: &[String]) -> Option<String> {
    let program = program_name(argv.first()?);
    let (head, rest) = match argv.get(1) {
        Some(script) if INTERPRETERS.contains(&program) && !script.starts_with('-') => {
            (file_name(script), &argv[2..])
        }
        _ => (program, &argv[1..]),
    };
    let mut label = head.to_string();
    for arg in rest {
        label.push(' ');
        label.push_str(arg);
    }
    Some(label)
}

fn program_name(path: &str) -> &str {
    let name = file_name(path);
    name.strip_suffix(".exe").unwrap_or(name)
}

/// Splits on both separators, so a Windows path is read the same on every platform.
fn file_name(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

/// What the shell's terminal is running now; `command` is None at the prompt or when it cannot be read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub busy: bool,
    pub command: Option<String>,
}

pub trait ShellProcess: PaneProcess {
    fn activity(&self) -> Activity;
}

pub trait ShellSpawner {
    /// None = the shell could not be started.
    fn spawn(&self, cwd: &Path, sink: Box<dyn OutputSink>) -> Option<Box<dyn ShellProcess>>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShellError {
    /// The pane already has a shell that has not exited.
    AlreadyOpen,
    ShellFailed,
}

struct Shell {
    process: Box<dyn ShellProcess>,
    ended: Arc<AtomicBool>,
}

/// One shell per pane, kept apart from `PaneRegistry` so a session's own bookkeeping never sees it.
#[derive(Default)]
pub struct ShellRegistry {
    shells: HashMap<PaneId, Shell>,
}

impl ShellRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// A shell that has exited is replaced and handed back, so the caller can close it
    /// (which may block) outside any lock around the registry; a live one is refused.
    pub fn open(
        &mut self,
        pane: PaneId,
        cwd: &Path,
        spawner: &dyn ShellSpawner,
        sink: Box<dyn OutputSink>,
    ) -> Result<Option<Box<dyn ShellProcess>>, ShellError> {
        if self.live(&pane).is_some() {
            return Err(ShellError::AlreadyOpen);
        }
        let ended = Arc::new(AtomicBool::new(false));
        let sink = Box::new(EndSink {
            ended: ended.clone(),
            inner: sink,
        });
        let process = spawner.spawn(cwd, sink).ok_or(ShellError::ShellFailed)?;
        Ok(self
            .shells
            .insert(pane, Shell { process, ended })
            .map(|replaced| replaced.process))
    }

    pub fn write(&mut self, pane: &PaneId, data: &[u8]) -> io::Result<()> {
        self.process(pane)?.write(data)
    }

    pub fn resize(&mut self, pane: &PaneId, cols: u16, rows: u16) -> io::Result<()> {
        self.process(pane)?.resize(cols, rows)
    }

    /// NotFound also for a shell that has exited, so the UI never reads a stale command.
    pub fn activity(&self, pane: &PaneId) -> io::Result<Activity> {
        self.live(pane)
            .map(|shell| shell.process.activity())
            .ok_or_else(unknown)
    }

    /// Forgets the shell and hands back its process, so the caller can close it
    /// (which may block) outside any lock around the registry.
    pub fn take(&mut self, pane: &PaneId) -> Option<Box<dyn ShellProcess>> {
        self.shells.remove(pane).map(|shell| shell.process)
    }

    pub fn take_all(&mut self) -> Vec<Box<dyn ShellProcess>> {
        self.shells
            .drain()
            .map(|(_, shell)| shell.process)
            .collect()
    }

    fn live(&self, pane: &PaneId) -> Option<&Shell> {
        self.shells
            .get(pane)
            .filter(|shell| !shell.ended.load(Ordering::SeqCst))
    }

    fn process(&mut self, pane: &PaneId) -> io::Result<&mut Box<dyn ShellProcess>> {
        self.shells
            .get_mut(pane)
            .map(|shell| &mut shell.process)
            .ok_or_else(unknown)
    }
}

fn unknown() -> io::Error {
    io::Error::new(io::ErrorKind::NotFound, "unknown pane")
}

/// A shell in a PTY, with a session's non-blocking input; ending it ends every job it started.
pub struct PtyShell {
    inner: QueuedProcess,
    probe: ForegroundProbe,
}

pub fn spawn_shell(spec: SpawnSpec, sink: Box<dyn OutputSink>) -> io::Result<PtyShell> {
    let session = PtySession::spawn_with_scope(spec, sink, EndScope::Session)?;
    let probe = session.foreground_probe()?;
    let killer = session.killer();
    Ok(PtyShell {
        inner: QueuedProcess::new(Box::new(session), Some(killer)),
        probe,
    })
}

impl PaneProcess for PtyShell {
    fn write(&mut self, data: &[u8]) -> io::Result<()> {
        self.inner.write(data)
    }

    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        self.inner.resize(cols, rows)
    }

    fn close(&mut self) {
        self.inner.close();
    }

    fn pid(&self) -> Option<u32> {
        self.inner.pid()
    }
}

impl ShellProcess for PtyShell {
    fn activity(&self) -> Activity {
        match self.probe.foreground_argv() {
            None => Activity {
                busy: false,
                command: None,
            },
            Some(argv) => Activity {
                busy: true,
                command: command_label(&argv),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::path::PathBuf;
    use std::sync::Mutex;
    #[cfg(unix)]
    use std::time::{Duration, Instant};

    fn label(argv: &[&str]) -> Option<String> {
        let argv: Vec<String> = argv.iter().map(|a| a.to_string()).collect();
        command_label(&argv)
    }

    #[test]
    fn an_interpreter_running_a_script_is_labelled_by_the_script() {
        assert_eq!(
            label(&["node", "/opt/homebrew/bin/npm", "run", "dev"]).as_deref(),
            Some("npm run dev")
        );
        assert_eq!(
            label(&["node.exe", "C:\\x\\vite.js"]).as_deref(),
            Some("vite.js")
        );
    }

    #[test]
    fn an_interpreter_with_a_flag_first_is_labelled_by_itself() {
        assert_eq!(
            label(&["python3", "-m", "http.server"]).as_deref(),
            Some("python3 -m http.server")
        );
    }

    #[test]
    fn a_plain_program_is_labelled_by_its_file_name_and_arguments() {
        assert_eq!(label(&["/bin/sleep", "30"]).as_deref(), Some("sleep 30"));
        assert_eq!(
            label(&["cargo", "watch", "-x", "test"]).as_deref(),
            Some("cargo watch -x test")
        );
        assert_eq!(label(&["C:\\bin\\node.exe"]).as_deref(), Some("node"));
    }

    #[test]
    fn no_argv_has_no_label() {
        assert_eq!(label(&[]), None);
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    enum Call {
        Write(Vec<u8>),
        Resize(u16, u16),
        Close,
        Dropped,
    }

    type Log = Arc<Mutex<Vec<Call>>>;

    struct FakeShell {
        log: Log,
        activity: Activity,
    }

    impl PaneProcess for FakeShell {
        fn write(&mut self, data: &[u8]) -> io::Result<()> {
            self.log.lock().unwrap().push(Call::Write(data.to_vec()));
            Ok(())
        }
        fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
            self.log.lock().unwrap().push(Call::Resize(cols, rows));
            Ok(())
        }
        fn close(&mut self) {
            self.log.lock().unwrap().push(Call::Close);
        }
    }

    impl ShellProcess for FakeShell {
        fn activity(&self) -> Activity {
            self.activity.clone()
        }
    }

    impl Drop for FakeShell {
        fn drop(&mut self) {
            self.log.lock().unwrap().push(Call::Dropped);
        }
    }

    struct NullSink;
    impl OutputSink for NullSink {
        fn output(&self, _chunk: Vec<u8>) {}
        fn exited(&self, _code: Option<i32>) {}
    }

    /// Records each spawn and hands out a fake shell with its own call log.
    struct FakeSpawner {
        starts: bool,
        activity: Activity,
        cwds: RefCell<Vec<PathBuf>>,
        sinks: RefCell<Vec<Box<dyn OutputSink>>>,
        logs: RefCell<Vec<Log>>,
    }

    impl FakeSpawner {
        fn new(starts: bool) -> Self {
            FakeSpawner {
                starts,
                activity: Activity {
                    busy: true,
                    command: Some("npm run dev".into()),
                },
                cwds: RefCell::default(),
                sinks: RefCell::default(),
                logs: RefCell::default(),
            }
        }

        fn log(&self, index: usize) -> Vec<Call> {
            self.logs.borrow()[index].lock().unwrap().clone()
        }

        fn exit(&self, index: usize) {
            self.sinks.borrow()[index].exited(Some(0));
        }
    }

    impl ShellSpawner for FakeSpawner {
        fn spawn(&self, cwd: &Path, sink: Box<dyn OutputSink>) -> Option<Box<dyn ShellProcess>> {
            self.cwds.borrow_mut().push(cwd.to_path_buf());
            self.sinks.borrow_mut().push(sink);
            if !self.starts {
                return None;
            }
            let log = Log::default();
            self.logs.borrow_mut().push(log.clone());
            Some(Box::new(FakeShell {
                log,
                activity: self.activity.clone(),
            }))
        }
    }

    fn pane(id: &str) -> PaneId {
        PaneId(id.into())
    }

    fn open(
        reg: &mut ShellRegistry,
        id: &str,
        spawner: &FakeSpawner,
    ) -> Result<Option<Box<dyn ShellProcess>>, ShellError> {
        reg.open(pane(id), Path::new("/w/a"), spawner, Box::new(NullSink))
    }

    /// `Ok(true)`: opened and handed back a replaced shell.
    fn opened(
        result: Result<Option<Box<dyn ShellProcess>>, ShellError>,
    ) -> Result<bool, ShellError> {
        result.map(|replaced| replaced.is_some())
    }

    #[test]
    fn open_spawns_in_the_given_folder() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);

        assert_eq!(opened(open(&mut reg, "p1", &spawner)), Ok(false));

        assert_eq!(*spawner.cwds.borrow(), [PathBuf::from("/w/a")]);
        assert_eq!(
            reg.activity(&pane("p1")).unwrap(),
            Activity {
                busy: true,
                command: Some("npm run dev".into())
            }
        );
    }

    #[test]
    fn a_second_open_on_a_live_shell_is_refused_without_spawning() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        open(&mut reg, "p1", &spawner).unwrap();

        assert_eq!(
            opened(open(&mut reg, "p1", &spawner)),
            Err(ShellError::AlreadyOpen)
        );
        assert_eq!(spawner.cwds.borrow().len(), 1);
        assert_eq!(opened(open(&mut reg, "p2", &spawner)), Ok(false));
    }

    #[test]
    fn a_new_shell_may_open_after_the_old_one_exited() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        open(&mut reg, "p1", &spawner).unwrap();
        spawner.exit(0);

        assert_eq!(
            reg.activity(&pane("p1")).unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
        assert_eq!(opened(open(&mut reg, "p1", &spawner)), Ok(true));
        assert_eq!(spawner.cwds.borrow().len(), 2);
        reg.write(&pane("p1"), b"ls\n").unwrap();
        assert_eq!(spawner.log(1), [Call::Write(b"ls\n".to_vec())]);
    }

    #[test]
    fn reopening_hands_back_the_exited_shell_rather_than_dropping_it() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        open(&mut reg, "p1", &spawner).unwrap();
        spawner.exit(0);

        let mut replaced = open(&mut reg, "p1", &spawner)
            .unwrap()
            .expect("the exited shell");

        assert!(spawner.log(0).is_empty());
        replaced.close();
        drop(replaced);
        assert_eq!(spawner.log(0), [Call::Close, Call::Dropped]);
    }

    #[test]
    fn a_shell_that_fails_to_start_is_not_registered() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(false);

        assert_eq!(
            opened(open(&mut reg, "p1", &spawner)),
            Err(ShellError::ShellFailed)
        );

        assert!(reg.take(&pane("p1")).is_none());
        assert_eq!(
            reg.write(&pane("p1"), b"x").unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
        assert!(open(&mut reg, "p1", &FakeSpawner::new(true)).is_ok());
    }

    #[test]
    fn write_and_resize_reach_the_shell() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        open(&mut reg, "p1", &spawner).unwrap();

        reg.write(&pane("p1"), b"pwd\n").unwrap();
        reg.resize(&pane("p1"), 120, 12).unwrap();

        assert_eq!(
            spawner.log(0),
            [Call::Write(b"pwd\n".to_vec()), Call::Resize(120, 12)]
        );
    }

    #[test]
    fn an_unknown_pane_is_not_found() {
        let mut reg = ShellRegistry::new();
        let unknown = pane("nope");
        assert_eq!(
            reg.write(&unknown, b"x").unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
        assert_eq!(
            reg.resize(&unknown, 1, 1).unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
        assert_eq!(
            reg.activity(&unknown).unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
    }

    #[test]
    fn take_hands_back_the_shell_without_closing_it() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        open(&mut reg, "p1", &spawner).unwrap();

        let mut shell = reg.take(&pane("p1")).expect("shell");

        assert!(spawner.log(0).is_empty());
        assert!(reg.take(&pane("p1")).is_none());
        shell.close();
        assert_eq!(spawner.log(0), [Call::Close]);
    }

    #[test]
    fn take_all_hands_back_every_shell() {
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        open(&mut reg, "p1", &spawner).unwrap();
        open(&mut reg, "p2", &spawner).unwrap();

        assert_eq!(reg.take_all().len(), 2);
        assert!(reg.take_all().is_empty());
        assert!(reg.take(&pane("p1")).is_none());
    }

    #[test]
    fn exit_reaches_the_given_sink() {
        struct Recording(Arc<Mutex<Vec<Option<i32>>>>);
        impl OutputSink for Recording {
            fn output(&self, _chunk: Vec<u8>) {}
            fn exited(&self, code: Option<i32>) {
                self.0.lock().unwrap().push(code);
            }
        }
        let mut reg = ShellRegistry::new();
        let spawner = FakeSpawner::new(true);
        let codes = Arc::new(Mutex::new(Vec::new()));
        reg.open(
            pane("p1"),
            Path::new("/w/a"),
            &spawner,
            Box::new(Recording(codes.clone())),
        )
        .unwrap();

        spawner.sinks.borrow()[0].exited(Some(130));

        assert_eq!(*codes.lock().unwrap(), [Some(130)]);
    }

    #[test]
    fn activity_serializes_as_busy_and_command() {
        let json = |a: &Activity| serde_json::to_string(a).unwrap();
        assert_eq!(
            json(&Activity {
                busy: true,
                command: Some("sleep 30".into())
            }),
            r#"{"busy":true,"command":"sleep 30"}"#
        );
        assert_eq!(
            json(&Activity {
                busy: false,
                command: None
            }),
            r#"{"busy":false,"command":null}"#
        );
    }

    /// Collects a real shell's output.
    #[cfg(unix)]
    struct Collect(Arc<Mutex<Vec<u8>>>, std::sync::mpsc::Sender<Option<i32>>);

    #[cfg(unix)]
    impl OutputSink for Collect {
        fn output(&self, chunk: Vec<u8>) {
            self.0.lock().unwrap().extend(chunk);
        }
        fn exited(&self, code: Option<i32>) {
            let _ = self.1.send(code);
        }
    }

    #[cfg(unix)]
    type Exit = std::sync::mpsc::Receiver<Option<i32>>;

    /// `/bin/sh` rather than the user's shell, so the test does not depend on their rc files.
    #[cfg(unix)]
    fn sh_in(cwd: &Path) -> (PtyShell, Arc<Mutex<Vec<u8>>>, Exit) {
        let out = Arc::new(Mutex::new(Vec::new()));
        let (exit_tx, exit) = std::sync::mpsc::channel();
        let spec = SpawnSpec {
            program: "/bin/sh".into(),
            args: vec![],
            cwd: cwd.to_path_buf(),
            env: vec![
                ("TERM".into(), "xterm-256color".into()),
                ("PATH".into(), "/usr/bin:/bin".into()),
                ("PS1".into(), "$ ".into()),
            ],
            cols: 80,
            rows: 24,
        };
        let shell = spawn_shell(spec, Box::new(Collect(out.clone(), exit_tx))).unwrap();
        (shell, out, exit)
    }

    #[cfg(unix)]
    fn wait_until(what: &str, within: Duration, mut done: impl FnMut() -> bool) {
        let end = Instant::now() + within;
        while !done() {
            assert!(Instant::now() < end, "timed out waiting for {what}");
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[cfg(unix)]
    fn child_named(parent: u32, name: &str) -> libc::pid_t {
        let out = std::process::Command::new("pgrep")
            .args(["-P", &parent.to_string(), "-x", name])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout)
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("no {name} under {parent}"))
    }

    #[cfg(unix)]
    fn text(out: &Mutex<Vec<u8>>) -> String {
        String::from_utf8_lossy(&out.lock().unwrap()).into_owned()
    }

    /// The pid a command printed as `bg=<pid>;`, skipping the echoed command line. `$!` ends
    /// the line, so interactive history expansion leaves it alone.
    #[cfg(unix)]
    fn printed_pid(out: &Mutex<Vec<u8>>) -> libc::pid_t {
        let mut pid = None;
        wait_until("the background pid", Duration::from_secs(3), || {
            pid = text(out).split("bg=").skip(1).find_map(|rest| {
                let (digits, _) = rest.split_once(';')?;
                digits.parse().ok()
            });
            pid.is_some()
        });
        pid.unwrap()
    }

    #[cfg(unix)]
    fn assert_gone(pid: libc::pid_t) {
        wait_until("the job to end", Duration::from_secs(3), || unsafe {
            libc::kill(pid, 0) != 0
        });
    }

    /// A job-control shell gives each job its own process group, so ending only the
    /// shell's group would leave a job that ignores SIGHUP running.
    #[cfg(unix)]
    #[test]
    fn close_ends_a_background_job_that_ignores_sighup() {
        let dir = tempfile::tempdir().unwrap();
        let (mut shell, out, _exit) = sh_in(dir.path());
        wait_until("the prompt", Duration::from_secs(3), || {
            text(&out).contains("$ ")
        });

        shell
            .write(b"(trap '' HUP; exec sleep 30) & printf 'bg=%s;' $!\n")
            .unwrap();
        let job = printed_pid(&out);

        shell.close();

        assert_gone(job);
    }

    /// The shell does not hang up its jobs on a plain `exit`.
    #[cfg(unix)]
    #[test]
    fn a_shell_that_exits_ends_its_background_jobs() {
        let dir = tempfile::tempdir().unwrap();
        let (mut shell, out, exit) = sh_in(dir.path());
        wait_until("the prompt", Duration::from_secs(3), || {
            text(&out).contains("$ ")
        });

        shell.write(b"sleep 30 & printf 'bg=%s;' $!\n").unwrap();
        let job = printed_pid(&out);
        shell.write(b"exit\n").unwrap();

        exit.recv_timeout(Duration::from_secs(5))
            .expect("exit message");
        assert_gone(job);
        shell.close();
    }

    #[cfg(unix)]
    #[test]
    fn the_shell_runs_in_the_given_folder() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = dunce::canonicalize(dir.path()).unwrap();
        let (mut shell, out, _exit) = sh_in(dir.path());

        shell.write(b"pwd\n").unwrap();

        let cwd = cwd.to_str().unwrap();
        wait_until("pwd", Duration::from_secs(3), || {
            text(&out)
                .lines()
                .any(|line| line.trim_end_matches('\r') == cwd)
        });
        shell.close();
    }

    #[cfg(unix)]
    #[test]
    fn activity_follows_the_foreground_command_and_close_ends_it() {
        let dir = tempfile::tempdir().unwrap();
        let (mut shell, out, _exit) = sh_in(dir.path());
        wait_until("the prompt", Duration::from_secs(3), || {
            text(&out).contains("$ ")
        });

        assert_eq!(
            shell.activity(),
            Activity {
                busy: false,
                command: None
            }
        );

        shell.write(b"sleep 30\n").unwrap();
        let busy = Activity {
            busy: true,
            command: Some("sleep 30".into()),
        };
        wait_until("sleep 30 in the foreground", Duration::from_secs(2), || {
            shell.activity() == busy
        });
        let sleep = child_named(shell.pid().unwrap(), "sleep");

        shell.close();

        wait_until("sleep to end", Duration::from_secs(3), || unsafe {
            libc::kill(sleep, 0) != 0
        });
    }
}
