use std::collections::HashMap;
use std::io;
use std::path::Path;

use serde::Serialize;

use crate::pty::{OutputSink, PaneProcess};
use crate::workspace::{OpenPanes, WorkspaceId, WorkspaceView};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct PaneId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct SessionId(pub String);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenError {
    WorkspaceMissing,
    WorkspaceNotFound,
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
        sink: Box<dyn OutputSink>,
    ) -> Option<Box<dyn PaneProcess>>;
}

struct Pane {
    workspace: WorkspaceId,
    session: SessionId,
    /// None when claude could not be started; the pane stays until the UI closes it.
    process: Option<Box<dyn PaneProcess>>,
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
        spawner: &dyn Spawner,
        sink: Box<dyn OutputSink>,
    ) -> Result<Opened, OpenError> {
        if workspace.missing {
            return Err(OpenError::WorkspaceMissing);
        }
        let pane_id = PaneId(new_id());
        let session_id = SessionId(new_id());
        let process = spawner.spawn(&workspace.path, &session_id, sink);
        let started = process.is_some();
        self.panes.insert(
            pane_id.clone(),
            Pane {
                workspace: workspace.id.clone(),
                session: session_id.clone(),
                process,
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
        logs: RefCell<Vec<Log>>,
    }

    impl FakeSpawner {
        fn new(starts: bool) -> Self {
            FakeSpawner {
                starts,
                spawns: RefCell::default(),
                logs: RefCell::default(),
            }
        }

        fn log(&self, index: usize) -> Vec<Call> {
            self.logs.borrow()[index].lock().unwrap().clone()
        }
    }

    impl Spawner for FakeSpawner {
        fn spawn(
            &self,
            cwd: &Path,
            session_id: &SessionId,
            _sink: Box<dyn OutputSink>,
        ) -> Option<Box<dyn PaneProcess>> {
            self.spawns
                .borrow_mut()
                .push((cwd.to_path_buf(), session_id.clone()));
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
        reg.open(ws, spawner, Box::new(NullSink)).unwrap()
    }

    #[test]
    fn open_in_a_missing_workspace_fails_without_spawning() {
        let mut reg = PaneRegistry::new();
        let spawner = FakeSpawner::new(true);
        let ws = workspace("/w/gone", true);

        let result = reg.open(&ws, &spawner, Box::new(NullSink));

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

    #[test]
    fn ids_serialize_as_plain_strings() {
        assert_eq!(
            serde_json::to_string(&PaneId("p".into())).unwrap(),
            r#""p""#
        );
    }
}
