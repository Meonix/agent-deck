use std::collections::HashMap;
use std::io;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

use crate::pty::{OutputSink, PaneProcess};
use crate::workspace::{OpenPanes, WorkspaceId, WorkspaceView};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct PaneId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct SessionId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OpenError {
    WorkspaceMissing,
    WorkspaceNotFound,
    /// A pane is already running the session asked to resume.
    AlreadyOpen(PaneId),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Start {
    New,
    Resume(SessionId),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidSessionId;

/// Only a UUID may reach the command line, so an id can never be read as a flag.
pub fn resume_id(raw: &str) -> Result<SessionId, InvalidSessionId> {
    uuid::Uuid::parse_str(raw)
        .map(|id| SessionId(id.to_string()))
        .map_err(|_| InvalidSessionId)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Opened {
    pub pane_id: PaneId,
    pub session_id: SessionId,
    pub started: bool,
}

pub trait Spawner {
    /// None = claude could not be found/started; Some = running process.
    fn spawn(
        &self,
        cwd: &Path,
        session_id: &SessionId,
        resume: bool,
        sink: Box<dyn OutputSink>,
    ) -> Option<Box<dyn PaneProcess>>;
}

struct Pane {
    workspace: WorkspaceId,
    session: SessionId,
    /// None when claude could not be started; the pane stays until the UI closes it.
    process: Option<Box<dyn PaneProcess>>,
    /// Set when the process exits; the pane stays until the UI closes it.
    ended: Arc<AtomicBool>,
}

/// The flag is set before forwarding so a pane the UI has already seen end no longer blocks a resume (`AlreadyOpen`).
struct EndSink {
    ended: Arc<AtomicBool>,
    inner: Box<dyn OutputSink>,
}

impl OutputSink for EndSink {
    fn output(&self, chunk: Vec<u8>) {
        self.inner.output(chunk);
    }

    fn exited(&self, code: Option<i32>) {
        self.ended.store(true, Ordering::SeqCst);
        self.inner.exited(code);
    }
}

impl Pane {
    fn is_running(&self) -> bool {
        self.process.is_some() && !self.ended.load(Ordering::SeqCst)
    }
}

#[derive(Default)]
pub struct PaneRegistry {
    panes: HashMap<PaneId, Pane>,
}

impl PaneRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open(
        &mut self,
        workspace: &WorkspaceView,
        start: Start,
        spawner: &dyn Spawner,
        sink: Box<dyn OutputSink>,
    ) -> Result<Opened, OpenError> {
        if workspace.missing {
            return Err(OpenError::WorkspaceMissing);
        }
        let pane_id = PaneId(new_id());
        let (session_id, resume) = match start {
            Start::New => (SessionId(new_id()), false),
            Start::Resume(id) => {
                if let Some((pane_id, _)) = self
                    .panes
                    .iter()
                    .find(|(_, p)| p.session == id && p.is_running())
                {
                    return Err(OpenError::AlreadyOpen(pane_id.clone()));
                }
                (id, true)
            }
        };
        let ended = Arc::new(AtomicBool::new(false));
        let sink = Box::new(EndSink {
            ended: ended.clone(),
            inner: sink,
        });
        let process = spawner.spawn(&workspace.path, &session_id, resume, sink);
        let started = process.is_some();
        self.panes.insert(
            pane_id.clone(),
            Pane {
                workspace: workspace.id.clone(),
                session: session_id.clone(),
                process,
                ended,
            },
        );
        Ok(Opened {
            pane_id,
            session_id,
            started,
        })
    }

    pub fn write(&mut self, pane: &PaneId, data: &[u8]) -> io::Result<()> {
        self.process(pane)?.write(data)
    }

    pub fn resize(&mut self, pane: &PaneId, cols: u16, rows: u16) -> io::Result<()> {
        self.process(pane)?.resize(cols, rows)
    }

    /// Forgets the pane and hands back its process, so the caller can close it
    /// (which may block) outside any lock around the registry.
    pub fn take(&mut self, pane: &PaneId) -> Option<Box<dyn PaneProcess>> {
        self.panes.remove(pane)?.process
    }

    /// Closes the process if any and forgets the pane; an unknown id is a no-op.
    pub fn close(&mut self, pane: &PaneId) {
        if let Some(mut process) = self.take(pane) {
            process.close();
        }
    }

    pub fn take_all(&mut self) -> Vec<Box<dyn PaneProcess>> {
        self.panes
            .drain()
            .filter_map(|(_, pane)| pane.process)
            .collect()
    }

    pub fn close_all(&mut self) {
        close_in_parallel(self.take_all());
    }

    pub fn session_of(&self, pane: &PaneId) -> Option<SessionId> {
        self.panes.get(pane).map(|p| p.session.clone())
    }

    fn process(&mut self, pane: &PaneId) -> io::Result<&mut Box<dyn PaneProcess>> {
        self.panes
            .get_mut(pane)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "unknown pane"))?
            .process
            .as_mut()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "pane was not started"))
    }
}

impl OpenPanes for PaneRegistry {
    fn has_open_panes(&self, id: &WorkspaceId) -> bool {
        self.panes.values().any(|p| p.workspace == *id)
    }
}

/// Each close can take up to ~2 s, so they run side by side.
pub fn close_in_parallel(processes: Vec<Box<dyn PaneProcess>>) {
    std::thread::scope(|scope| {
        for mut process in processes {
            scope.spawn(move || process.close());
        }
    });
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

    #[derive(Debug, Clone, PartialEq, Eq)]
    enum Call {
        Write(Vec<u8>),
        Resize(u16, u16),
        Close,
    }

    type Log = Arc<Mutex<Vec<Call>>>;

    struct FakeProcess(Log);

    impl PaneProcess for FakeProcess {
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

    struct NullSink;
    impl OutputSink for NullSink {
        fn output(&self, _chunk: Vec<u8>) {}
        fn exited(&self, _code: Option<i32>) {}
    }

    /// Records each spawn and hands out a fake process with its own call log.
    struct FakeSpawner {
        starts: bool,
        spawns: RefCell<Vec<(PathBuf, SessionId)>>,
        resumes: RefCell<Vec<bool>>,
        sinks: RefCell<Vec<Box<dyn OutputSink>>>,
        logs: RefCell<Vec<Log>>,
    }

    impl FakeSpawner {
        fn new(starts: bool) -> Self {
            FakeSpawner {
                starts,
                spawns: RefCell::default(),
                resumes: RefCell::default(),
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

    impl Spawner for FakeSpawner {
        fn spawn(
            &self,
            cwd: &Path,
            session_id: &SessionId,
            resume: bool,
            sink: Box<dyn OutputSink>,
        ) -> Option<Box<dyn PaneProcess>> {
            self.spawns
                .borrow_mut()
                .push((cwd.to_path_buf(), session_id.clone()));
            self.resumes.borrow_mut().push(resume);
            self.sinks.borrow_mut().push(sink);
            if !self.starts {
                return None;
            }
            let log = Log::default();
            self.logs.borrow_mut().push(log.clone());
            Some(Box::new(FakeProcess(log)))
        }
    }

    fn workspace(path: &str, missing: bool) -> WorkspaceView {
        WorkspaceView {
            id: WorkspaceId(path.into()),
            name: path.rsplit('/').next().unwrap().into(),
            path: PathBuf::from(path),
            missing,
        }
    }

    fn open(reg: &mut PaneRegistry, ws: &WorkspaceView, spawner: &FakeSpawner) -> Opened {
        reg.open(ws, Start::New, spawner, Box::new(NullSink))
            .unwrap()
    }

    #[test]
    fn open_in_a_missing_workspace_fails_without_spawning() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let ws = workspace("/w/gone", true);

        let result = reg.open(&ws, Start::New, &spawner, Box::new(NullSink));

        assert_eq!(result, Err(OpenError::WorkspaceMissing));
        assert!(spawner.spawns.borrow().is_empty());
        assert!(!reg.has_open_panes(&ws.id));
    }

    #[test]
    fn open_spawns_in_the_workspace_and_marks_only_it_busy() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let a = workspace("/w/a", false);
        let b = workspace("/w/b", false);

        let opened = open(&mut reg, &a, &spawner);

        assert!(opened.started);
        assert_eq!(
            spawner.spawns.borrow().as_slice(),
            [(PathBuf::from("/w/a"), opened.session_id.clone())]
        );
        assert_eq!(reg.session_of(&opened.pane_id), Some(opened.session_id));
        assert!(reg.has_open_panes(&a.id));
        assert!(!reg.has_open_panes(&b.id));
    }

    #[test]
    fn write_and_resize_reach_the_process() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let opened = open(&mut reg, &workspace("/w/a", false), &spawner);

        reg.write(&opened.pane_id, b"hi").unwrap();
        reg.resize(&opened.pane_id, 120, 40).unwrap();

        assert_eq!(
            spawner.log(0),
            [Call::Write(b"hi".to_vec()), Call::Resize(120, 40)]
        );
    }

    #[test]
    fn write_to_an_unknown_pane_is_not_found() {
        let mut reg = PaneRegistry::new();
        let unknown = PaneId("nope".into());
        assert_eq!(
            reg.write(&unknown, b"x").unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
        assert_eq!(
            reg.resize(&unknown, 1, 1).unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
    }

    #[test]
    fn close_ends_the_process_and_frees_the_workspace() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let a = workspace("/w/a", false);
        let opened = open(&mut reg, &a, &spawner);

        reg.close(&opened.pane_id);

        assert_eq!(spawner.log(0), [Call::Close]);
        assert!(!reg.has_open_panes(&a.id));
        assert_eq!(reg.session_of(&opened.pane_id), None);
        reg.close(&opened.pane_id);
        assert_eq!(spawner.log(0), [Call::Close]);
    }

    #[test]
    fn take_forgets_the_pane_without_closing_it() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let a = workspace("/w/a", false);
        let opened = open(&mut reg, &a, &spawner);

        let process = reg.take(&opened.pane_id);

        assert!(process.is_some());
        assert!(spawner.log(0).is_empty());
        assert!(!reg.has_open_panes(&a.id));
    }

    #[test]
    fn a_pane_that_failed_to_start_is_still_listed() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(false);
        let a = workspace("/w/a", false);

        let opened = open(&mut reg, &a, &spawner);

        assert!(!opened.started);
        assert!(reg.has_open_panes(&a.id));
        assert_eq!(
            reg.write(&opened.pane_id, b"x").unwrap_err().kind(),
            io::ErrorKind::NotConnected
        );
        assert!(reg.take(&opened.pane_id).is_none());
        assert!(!reg.has_open_panes(&a.id));
    }

    #[test]
    fn close_all_closes_every_process() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let a = workspace("/w/a", false);
        let b = workspace("/w/b", false);
        open(&mut reg, &a, &spawner);
        open(&mut reg, &a, &spawner);
        open(&mut reg, &b, &spawner);

        reg.close_all();

        for i in 0..3 {
            assert_eq!(spawner.log(i), [Call::Close], "process {i}");
        }
        assert!(!reg.has_open_panes(&a.id));
        assert!(!reg.has_open_panes(&b.id));
    }

    #[test]
    fn two_opens_get_distinct_uuid_ids() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let ws = workspace("/w/a", false);

        let first = open(&mut reg, &ws, &spawner);
        let second = open(&mut reg, &ws, &spawner);

        assert_ne!(first.pane_id, second.pane_id);
        assert_ne!(first.session_id, second.session_id);
        assert_ne!(first.pane_id.0, first.session_id.0);
        for id in [&first.pane_id.0, &first.session_id.0] {
            let parsed = uuid::Uuid::parse_str(id).unwrap();
            assert_eq!(parsed.get_version_num(), 4);
        }
    }

    const SID: &str = "0b6f9a52-6c4e-4a39-9d6e-3f1f4f2a7c10";

    fn resume(
        reg: &mut PaneRegistry,
        ws: &WorkspaceView,
        spawner: &FakeSpawner,
    ) -> Result<Opened, OpenError> {
        reg.open(
            ws,
            Start::Resume(SessionId(SID.into())),
            spawner,
            Box::new(NullSink),
        )
    }

    #[test]
    fn resume_keeps_the_session_id_and_spawns_a_resume_in_the_workspace() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);

        let opened = resume(&mut reg, &workspace("/w/a", false), &spawner).unwrap();

        assert_eq!(opened.session_id, SessionId(SID.into()));
        assert!(opened.started);
        assert_eq!(
            spawner.spawns.borrow().as_slice(),
            [(PathBuf::from("/w/a"), SessionId(SID.into()))]
        );
        assert_eq!(*spawner.resumes.borrow(), [true]);
        assert_eq!(reg.session_of(&opened.pane_id), Some(SessionId(SID.into())));
    }

    #[test]
    fn a_new_open_is_not_a_resume() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);

        open(&mut reg, &workspace("/w/a", false), &spawner);

        assert_eq!(*spawner.resumes.borrow(), [false]);
    }

    #[test]
    fn resume_in_a_missing_workspace_fails_without_spawning() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);

        let result = resume(&mut reg, &workspace("/w/gone", true), &spawner);

        assert_eq!(result, Err(OpenError::WorkspaceMissing));
        assert!(spawner.spawns.borrow().is_empty());
    }

    #[test]
    fn resume_of_a_running_session_is_refused_without_spawning() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let ws = workspace("/w/a", false);
        let first = resume(&mut reg, &ws, &spawner).unwrap();

        let second = resume(&mut reg, &ws, &spawner);

        assert_eq!(second, Err(OpenError::AlreadyOpen(first.pane_id)));
        assert_eq!(spawner.spawns.borrow().len(), 1);
    }

    #[test]
    fn resume_is_allowed_again_after_the_pane_exited() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let ws = workspace("/w/a", false);
        let first = resume(&mut reg, &ws, &spawner).unwrap();

        spawner.exit(0);
        let second = resume(&mut reg, &ws, &spawner).unwrap();

        assert_ne!(second.pane_id, first.pane_id);
        assert_eq!(second.session_id, first.session_id);
        assert_eq!(spawner.spawns.borrow().len(), 2);
    }

    #[test]
    fn the_pane_is_marked_ended_before_the_exit_is_forwarded() {
        struct Probe(Arc<AtomicBool>, Arc<AtomicBool>);
        impl OutputSink for Probe {
            fn output(&self, _chunk: Vec<u8>) {}
            fn exited(&self, _code: Option<i32>) {
                self.1
                    .store(self.0.load(Ordering::SeqCst), Ordering::SeqCst);
            }
        }
        let ended = Arc::new(AtomicBool::new(false));
        let seen = Arc::new(AtomicBool::new(false));
        let sink = EndSink {
            ended: ended.clone(),
            inner: Box::new(Probe(ended, seen.clone())),
        };

        sink.exited(Some(0));

        assert!(seen.load(Ordering::SeqCst));
    }

    #[test]
    fn resume_is_allowed_again_after_the_pane_was_closed() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let ws = workspace("/w/a", false);
        let first = resume(&mut reg, &ws, &spawner).unwrap();

        reg.close(&first.pane_id);

        assert!(resume(&mut reg, &ws, &spawner).is_ok());
    }

    #[test]
    fn a_pane_that_never_started_does_not_block_a_resume() {
        let mut reg = PaneRegistry::new();
        let ws = workspace("/w/a", false);
        let broken = FakeSpawner::new(false);
        assert!(!resume(&mut reg, &ws, &broken).unwrap().started);

        let working = FakeSpawner::new(true);

        assert!(resume(&mut reg, &ws, &working).unwrap().started);
    }

    #[test]
    fn exit_reaches_the_inner_sink_unchanged() {
        struct Recording(Arc<Mutex<Vec<Option<i32>>>>);
        impl OutputSink for Recording {
            fn output(&self, _chunk: Vec<u8>) {}
            fn exited(&self, code: Option<i32>) {
                self.0.lock().unwrap().push(code);
            }
        }
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let codes = Arc::new(Mutex::new(Vec::new()));
        reg.open(
            &workspace("/w/a", false),
            Start::New,
            &spawner,
            Box::new(Recording(codes.clone())),
        )
        .unwrap();

        spawner.sinks.borrow()[0].exited(Some(7));

        assert_eq!(*codes.lock().unwrap(), [Some(7)]);
    }

    #[test]
    fn resume_id_accepts_a_uuid_in_canonical_lower_case() {
        assert_eq!(resume_id(SID), Ok(SessionId(SID.into())));
        assert_eq!(resume_id(&SID.to_uppercase()), Ok(SessionId(SID.into())));
    }

    #[test]
    fn resume_id_rejects_anything_that_is_not_a_uuid() {
        for raw in [
            "",
            "--help",
            "../x",
            "/tmp/a.jsonl",
            &format!("{SID}x"),
            &format!("{SID} --fork-session"),
        ] {
            assert_eq!(resume_id(raw), Err(InvalidSessionId), "{raw:?}");
        }
    }

    #[test]
    fn ids_serialize_as_plain_strings() {
        assert_eq!(
            serde_json::to_string(&PaneId("p".into())).unwrap(),
            r#""p""#
        );
    }
}
