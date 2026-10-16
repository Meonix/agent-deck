use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};

use super::OutputBatcher;

const FLUSH_DELAY: Duration = Duration::from_millis(16);
const FLUSH_BYTES: usize = 64 * 1024;
/// How long output may still drain after the child exits; a background
/// grandchild holding the terminal open must not delay the exit notice forever.
const EXIT_DRAIN: Duration = Duration::from_millis(100);

pub struct SpawnSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: Vec<(String, String)>,
    pub cols: u16,
    pub rows: u16,
}

pub trait OutputSink: Send + 'static {
    fn output(&self, chunk: Vec<u8>);
    fn exited(&self, code: Option<i32>);
}

pub trait PaneProcess: Send {
    fn write(&mut self, data: &[u8]) -> io::Result<()>;
    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()>;
    /// Idempotent; ends the whole process group and reaps the child.
    fn close(&mut self);
}

pub struct PtySession {
    master: Option<Box<dyn MasterPty + Send>>,
    writer: Option<Box<dyn Write + Send>>,
    /// Finishes once the child is reaped.
    waiter: Option<JoinHandle<()>>,
    killer: ProcessKiller,
}

/// Ends a session's processes from any thread, without the session itself,
/// so a thread blocked writing to the session cannot prevent it.
#[derive(Clone)]
pub struct ProcessKiller(Arc<Killer>);

struct Killer {
    /// True once `end` has run; also serialises concurrent calls.
    ended: Mutex<bool>,
    #[cfg(unix)]
    pgid: libc::pid_t,
    #[cfg(unix)]
    reaped: Arc<AtomicBool>,
    #[cfg(windows)]
    job: Mutex<Option<job::Job>>,
}

impl ProcessKiller {
    /// Idempotent; ends the whole process group (SIGHUP, SIGTERM, SIGKILL).
    pub fn end(&self) {
        let mut ended = self.0.ended.lock().unwrap();
        if *ended {
            return;
        }
        #[cfg(unix)]
        end_process_group(self.0.pgid, &self.0.reaped);
        #[cfg(windows)]
        drop(self.0.job.lock().unwrap().take());
        *ended = true;
    }
}

enum Event {
    Data(Vec<u8>),
    ReaderEof,
    Exited(Option<i32>),
}

impl PtySession {
    pub fn spawn(spec: SpawnSpec, sink: Box<dyn OutputSink>) -> io::Result<PtySession> {
        let pair = native_pty_system()
            .openpty(size(spec.cols, spec.rows))
            .map_err(io::Error::other)?;

        let mut cmd = CommandBuilder::new(&spec.program);
        cmd.args(&spec.args);
        cmd.cwd(&spec.cwd);
        // `CommandBuilder::new` starts from the app's own environment; the spec is the whole of it.
        cmd.env_clear();
        for (key, value) in &spec.env {
            cmd.env(key, value);
        }

        let reader = pair.master.try_clone_reader().map_err(io::Error::other)?;
        let writer = pair.master.take_writer().map_err(io::Error::other)?;
        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| e.downcast::<io::Error>().unwrap_or_else(io::Error::other))?;
        // The master must be the only open end left, or reads never reach EOF.
        drop(pair.slave);

        #[cfg(windows)]
        let job = {
            let attach = || -> io::Result<job::Job> {
                let job = job::Job::new()?;
                let handle = child
                    .as_raw_handle()
                    .ok_or_else(|| io::Error::other("child has no process handle"))?;
                job.assign(handle)?;
                Ok(job)
            };
            match attach() {
                Ok(job) => Some(job),
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(e);
                }
            }
        };
        #[cfg(unix)]
        let pgid = child
            .process_id()
            .ok_or_else(|| io::Error::other("child has no pid"))? as libc::pid_t;

        let reaped = Arc::new(AtomicBool::new(false));
        let killer = ProcessKiller(Arc::new(Killer {
            ended: Mutex::new(false),
            #[cfg(unix)]
            pgid,
            #[cfg(unix)]
            reaped: reaped.clone(),
            #[cfg(windows)]
            job: Mutex::new(job),
        }));

        let (tx, rx) = mpsc::channel();
        spawn_reader(reader, tx.clone());
        let group = killer.clone();
        let waiter = std::thread::spawn(move || {
            let code = match child.wait() {
                Ok(status) if status.signal().is_none() => Some(status.exit_code() as i32),
                _ => None,
            };
            reaped.store(true, Ordering::SeqCst);
            // End what the child left running now, while the group id is still
            // ours; once ended, a later close never signals that id again.
            group.end();
            let _ = tx.send(Event::Exited(code));
        });
        std::thread::spawn(move || pump(rx, sink));

        Ok(PtySession {
            master: Some(pair.master),
            writer: Some(writer),
            waiter: Some(waiter),
            killer,
        })
    }

    pub fn killer(&self) -> ProcessKiller {
        self.killer.clone()
    }
}

impl PaneProcess for PtySession {
    fn write(&mut self, data: &[u8]) -> io::Result<()> {
        let writer = self.writer.as_mut().ok_or_else(closed)?;
        writer.write_all(data)?;
        writer.flush()
    }

    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        self.master
            .as_ref()
            .ok_or_else(closed)?
            .resize(size(cols, rows))
            .map_err(io::Error::other)
    }

    fn close(&mut self) {
        let Some(waiter) = self.waiter.take() else {
            return;
        };
        self.killer.end();
        let _ = waiter.join();
        // Only now: portable-pty's writer sends "\n" + VEOF to the terminal when
        // dropped, which a live program would read as Enter and Ctrl-D.
        self.writer = None;
        self.master = None;
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        self.close();
    }
}

/// SIGHUP, then SIGTERM after `TERM_AFTER` so a hangup handler can finish,
/// then SIGKILL if the child is not reaped or any member is still alive
/// `KILL_AFTER` after the start. The child is a session leader (portable-pty
/// calls `setsid`), so its pid is the group id.
#[cfg(unix)]
fn end_process_group(pgid: libc::pid_t, reaped: &AtomicBool) {
    const TERM_AFTER: Duration = Duration::from_millis(150);
    const KILL_AFTER: Duration = Duration::from_secs(2);
    let start = Instant::now();
    let done = || reaped.load(Ordering::SeqCst) && group_is_empty(pgid);
    let done_by = |deadline: Instant| {
        while Instant::now() < deadline {
            if done() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        done()
    };
    // Once the group is empty its id may be reused, so it must not be signalled.
    if done() {
        return;
    }
    let signal = |sig| unsafe { libc::killpg(pgid, sig) };
    signal(libc::SIGHUP);
    if done_by(start + TERM_AFTER) {
        return;
    }
    signal(libc::SIGTERM);
    if done_by(start + KILL_AFTER) {
        return;
    }
    signal(libc::SIGKILL);
}

#[cfg(unix)]
fn group_is_empty(pgid: libc::pid_t) -> bool {
    let rc = unsafe { libc::kill(-pgid, 0) };
    rc == -1 && io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
}

fn closed() -> io::Error {
    io::Error::new(io::ErrorKind::BrokenPipe, "pane is closed")
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn spawn_reader(mut reader: Box<dyn Read + Send>, tx: Sender<Event>) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if tx.send(Event::Data(buf[..n].to_vec())).is_err() {
                        return;
                    }
                }
                Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
        let _ = tx.send(Event::ReaderEof);
    });
}

/// Batches output into the sink and reports the exit after the last chunk.
fn pump(rx: Receiver<Event>, sink: Box<dyn OutputSink>) {
    let mut batcher = OutputBatcher::new(FLUSH_DELAY, FLUSH_BYTES);
    let mut reader_done = false;
    let mut exit: Option<Option<i32>> = None;
    let mut drain_until: Option<Instant> = None;

    while !(reader_done && exit.is_some()) {
        let now = Instant::now();
        if drain_until.is_some_and(|t| now >= t) {
            break;
        }
        let wake = match (batcher.deadline(), drain_until) {
            (Some(a), Some(b)) => Some(a.min(b)),
            (a, b) => a.or(b),
        };
        let event = match wake {
            Some(t) => rx.recv_timeout(t.saturating_duration_since(now)),
            None => rx.recv().map_err(|_| RecvTimeoutError::Disconnected),
        };
        match event {
            Ok(Event::Data(bytes)) => {
                if let Some(chunk) = batcher.push(&bytes, Instant::now()) {
                    sink.output(chunk);
                }
            }
            Ok(Event::ReaderEof) => reader_done = true,
            Ok(Event::Exited(code)) => {
                exit = Some(code);
                drain_until = Some(Instant::now() + EXIT_DRAIN);
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }
        if let Some(chunk) = batcher.flush_due(Instant::now()) {
            sink.output(chunk);
        }
    }
    if let Some(chunk) = batcher.flush() {
        sink.output(chunk);
    }
    sink.exited(exit.flatten());
}

#[cfg(windows)]
mod job {
    use std::io;
    use std::os::windows::io::RawHandle;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    };

    /// Closing the last handle kills every process in the job, which
    /// portable-pty's `kill()` (root process only) does not.
    pub struct Job(HANDLE);

    // The handle is a kernel object reference, usable from any thread.
    unsafe impl Send for Job {}

    impl Job {
        pub fn new() -> io::Result<Job> {
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                return Err(io::Error::last_os_error());
            }
            let job = Job(handle);
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = unsafe {
                SetInformationJobObject(
                    job.0,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };
            if ok == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(job)
        }

        pub fn assign(&self, process: RawHandle) -> io::Result<()> {
            if unsafe { AssignProcessToJobObject(self.0, process as HANDLE) } == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.0) };
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::sync::mpsc::{self, Receiver, Sender};
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    struct TestSink {
        out: Arc<Mutex<Vec<u8>>>,
        exit: Sender<Option<i32>>,
    }

    impl OutputSink for TestSink {
        fn output(&self, chunk: Vec<u8>) {
            self.out.lock().unwrap().extend(chunk);
        }
        fn exited(&self, code: Option<i32>) {
            let _ = self.exit.send(code);
        }
    }

    struct Probe {
        out: Arc<Mutex<Vec<u8>>>,
        exit: Receiver<Option<i32>>,
    }

    impl Probe {
        fn text(&self) -> String {
            String::from_utf8_lossy(&self.out.lock().unwrap()).into_owned()
        }

        fn wait_for_len(&self, len: usize, timeout: Duration) -> bool {
            let end = Instant::now() + timeout;
            while self.out.lock().unwrap().len() < len {
                if Instant::now() >= end {
                    return false;
                }
                std::thread::sleep(Duration::from_micros(200));
            }
            true
        }

        /// Polls the collected output until `pred` holds or `timeout` passes.
        fn wait_for(&self, timeout: Duration, pred: impl Fn(&str) -> bool) -> bool {
            let end = Instant::now() + timeout;
            while Instant::now() < end {
                if pred(&self.text()) {
                    return true;
                }
                std::thread::sleep(Duration::from_millis(1));
            }
            pred(&self.text())
        }
    }

    fn sink() -> (Box<dyn OutputSink>, Probe) {
        let out = Arc::new(Mutex::new(Vec::new()));
        let (tx, rx) = mpsc::channel();
        let sink = TestSink {
            out: out.clone(),
            exit: tx,
        };
        (Box::new(sink), Probe { out, exit: rx })
    }

    fn spec(program: &str, args: &[&str], cwd: PathBuf) -> SpawnSpec {
        SpawnSpec {
            program: program.into(),
            args: args.iter().map(|a| a.to_string()).collect(),
            cwd,
            env: vec![
                ("TERM".into(), "xterm-256color".into()),
                ("PATH".into(), std::env::var("PATH").unwrap_or_default()),
            ],
            cols: 80,
            rows: 24,
        }
    }

    fn sh(script: &str, cwd: PathBuf) -> SpawnSpec {
        spec("/bin/sh", &["-c", script], cwd)
    }

    #[test]
    fn spawn_runs_in_cwd_and_reports_the_exit_code() {
        let dir = tempfile::tempdir().unwrap();
        let canonical = dunce::canonicalize(dir.path()).unwrap();
        let (sink, probe) = sink();
        let _session = PtySession::spawn(sh("pwd; exit 3", dir.path().into()), sink).unwrap();

        let code = probe.exit.recv_timeout(Duration::from_secs(3)).unwrap();
        assert_eq!(code, Some(3));
        assert!(
            probe.text().contains(canonical.to_str().unwrap()),
            "output {:?} lacks {:?}",
            probe.text(),
            canonical
        );
        assert!(probe.exit.recv_timeout(Duration::from_millis(100)).is_err());
    }

    #[test]
    fn spawn_passes_env() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let mut s = sh("printf '<%s>' \"$AD_TEST_VAR\"", dir.path().into());
        s.env.push(("AD_TEST_VAR".into(), "pane-42".into()));
        let _session = PtySession::spawn(s, sink).unwrap();

        assert_eq!(
            probe.exit.recv_timeout(Duration::from_secs(3)).unwrap(),
            Some(0)
        );
        assert!(probe.text().contains("<pane-42>"), "{:?}", probe.text());
    }

    #[test]
    fn spawn_passes_only_the_spec_env() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let s = sh("printf '<%s>' \"${HOME-unset}\"", dir.path().into());
        let _session = PtySession::spawn(s, sink).unwrap();

        assert_eq!(
            probe.exit.recv_timeout(Duration::from_secs(3)).unwrap(),
            Some(0)
        );
        assert!(probe.text().contains("<unset>"), "{:?}", probe.text());
    }

    #[test]
    fn spawn_of_a_missing_program_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, _probe) = sink();
        let result = PtySession::spawn(spec("/no/such/program", &[], dir.path().into()), sink);
        assert!(result.is_err());
    }

    #[test]
    fn resize_is_seen_by_the_child() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let mut session =
            PtySession::spawn(sh("stty size; read x; stty size", dir.path().into()), sink).unwrap();
        assert!(probe.wait_for(Duration::from_secs(3), |t| t.contains("24 80")));

        session.resize(100, 30).unwrap();
        session.write(b"\n").unwrap();

        assert_eq!(
            probe.exit.recv_timeout(Duration::from_secs(3)).unwrap(),
            Some(0)
        );
        let text = probe.text();
        let first = text.find("24 80").unwrap();
        let second = text.find("30 100").expect("new size not reported");
        assert!(first < second, "{text:?}");
    }

    #[test]
    fn echo_round_trip_p95_is_under_100ms() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let mut session = PtySession::spawn(spec("cat", &[], dir.path().into()), sink).unwrap();

        let mut samples = Vec::with_capacity(200);
        for i in 0..200u8 {
            let seen = probe.out.lock().unwrap().len();
            let start = Instant::now();
            session.write(&[b'a' + i % 26]).unwrap();
            assert!(
                probe.wait_for_len(seen + 1, Duration::from_secs(1)),
                "byte {i} never echoed"
            );
            samples.push(start.elapsed());
        }
        samples.sort();
        let p50 = samples[samples.len() / 2];
        let p95 = samples[samples.len() * 95 / 100];
        println!("pty echo round trip over 200 bytes: p50 = {p50:?}, p95 = {p95:?}");
        assert!(p95 < Duration::from_millis(100), "p95 {p95:?}");
    }

    fn group_members(pgid: libc::pid_t) -> Vec<libc::pid_t> {
        let out = std::process::Command::new("pgrep")
            .args(["-g", &pgid.to_string()])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .map(|p| p.parse().unwrap())
            .collect()
    }

    fn alive(pid: libc::pid_t) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    fn wait_for_members(pgid: libc::pid_t, count: usize) -> Vec<libc::pid_t> {
        let end = Instant::now() + Duration::from_secs(3);
        loop {
            let members = group_members(pgid);
            if members.len() >= count || Instant::now() >= end {
                return members;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    fn assert_all_gone(pids: &[libc::pid_t], within: Duration) {
        let end = Instant::now() + within;
        while pids.iter().any(|&p| alive(p)) {
            assert!(Instant::now() < end, "still alive: {pids:?}");
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[test]
    fn close_ends_the_whole_process_group() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let script = "sleep 1000 & sleep 1000 & wait";
        let mut session = PtySession::spawn(sh(script, dir.path().into()), sink).unwrap();
        let members = wait_for_members(session.killer.0.pgid, 3);
        assert_eq!(members.len(), 3, "sh and two sleeps: {members:?}");

        let start = Instant::now();
        session.close();
        assert_all_gone(&members, Duration::from_secs(3));
        assert!(
            start.elapsed() < Duration::from_secs(1),
            "SIGHUP should be enough"
        );
        assert!(group_members(session.killer.0.pgid).is_empty());

        session.close();
        assert!(session.write(b"x").is_err());
        assert!(session.resize(10, 10).is_err());
        assert_eq!(
            probe.exit.recv_timeout(Duration::from_secs(1)).unwrap(),
            None
        );
    }

    #[test]
    fn close_escalates_to_sigkill_when_hup_and_term_are_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, _probe) = sink();
        let script = "trap '' HUP TERM; sleep 1000 & wait";
        let mut session = PtySession::spawn(sh(script, dir.path().into()), sink).unwrap();
        let members = wait_for_members(session.killer.0.pgid, 2);
        assert_eq!(members.len(), 2, "{members:?}");

        let start = Instant::now();
        session.close();
        assert_all_gone(&members, Duration::from_secs(3));
        assert!(
            start.elapsed() >= Duration::from_secs(2),
            "{:?}",
            start.elapsed()
        );
    }

    #[test]
    fn drop_closes_the_session() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, _probe) = sink();
        let session = PtySession::spawn(sh("sleep 1000", dir.path().into()), sink).unwrap();
        let pgid = session.killer.0.pgid;
        let members = wait_for_members(pgid, 1);
        drop(session);
        assert_all_gone(&members, Duration::from_secs(3));
    }

    #[test]
    fn close_after_a_natural_exit_returns_at_once() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let mut session = PtySession::spawn(sh("exit 0", dir.path().into()), sink).unwrap();
        assert_eq!(
            probe.exit.recv_timeout(Duration::from_secs(3)).unwrap(),
            Some(0)
        );

        let start = Instant::now();
        session.close();
        assert!(
            start.elapsed() < Duration::from_millis(500),
            "{:?}",
            start.elapsed()
        );
    }

    fn printed_pid(probe: &Probe, tag: &str) -> libc::pid_t {
        let text = probe.text();
        text.split_once(tag)
            .and_then(|(_, rest)| rest.split_once(';'))
            .and_then(|(pid, _)| pid.parse().ok())
            .unwrap_or_else(|| panic!("no {tag} in {text:?}"))
    }

    #[test]
    fn a_natural_exit_ends_the_rest_of_the_group() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        // The kernel hangs up the group when the leader exits; ignoring that is
        // what lets a background child outlive it.
        let script = "trap '' HUP; sleep 1000 & printf 'bg=%s;' $!; exit 0";
        let mut session = PtySession::spawn(sh(script, dir.path().into()), sink).unwrap();
        assert_eq!(
            probe.exit.recv_timeout(Duration::from_secs(5)).unwrap(),
            Some(0)
        );
        let bg = printed_pid(&probe, "bg=");

        assert_all_gone(&[bg], Duration::from_millis(200));
        assert!(
            *session.killer.0.ended.lock().unwrap(),
            "a later close could signal a reused group id"
        );
        session.close();
    }

    #[test]
    fn close_types_nothing_into_the_session() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let script = "trap '' HUP TERM; printf ready; IFS= read -r x; echo got > marker";
        let mut session = PtySession::spawn(sh(script, dir.path().into()), sink).unwrap();
        assert!(probe.wait_for(Duration::from_secs(3), |t| t.contains("ready")));

        session.close();
        assert!(!dir.path().join("marker").exists(), "close sent input");
    }

    #[test]
    fn close_gives_a_sighup_handler_time_before_sigterm() {
        let dir = tempfile::tempdir().unwrap();
        let (sink, probe) = sink();
        let script = "trap 'sleep 0.05; [ -e term ] || echo ok > hup_clean; exit 0' HUP; \
                      trap 'echo > term' TERM; printf ready; sleep 1000 & wait";
        let mut session = PtySession::spawn(sh(script, dir.path().into()), sink).unwrap();
        assert!(probe.wait_for(Duration::from_secs(3), |t| t.contains("ready")));

        session.close();
        assert!(
            dir.path().join("hup_clean").exists(),
            "SIGTERM came during the HUP handler"
        );
    }
}
