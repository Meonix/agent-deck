use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct WorkspaceId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", content = "id", rename_all = "camelCase")]
pub enum AddOutcome {
    Added(WorkspaceId),
    AlreadyPresent(WorkspaceId),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoveError {
    NotFound,
    HasOpenPanes,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WorkspaceView {
    pub id: WorkspaceId,
    pub name: String,
    pub path: PathBuf,
    pub missing: bool,
}

pub trait FolderProbe {
    fn exists(&self, path: &Path) -> bool;
}

pub trait OpenPanes {
    fn has_open_panes(&self, id: &WorkspaceId) -> bool;
}

pub struct NoPanes;

impl OpenPanes for NoPanes {
    fn has_open_panes(&self, _id: &WorkspaceId) -> bool {
        false
    }
}

pub struct DiskProbe;

impl FolderProbe for DiskProbe {
    fn exists(&self, path: &Path) -> bool {
        path.is_dir()
    }
}

#[derive(Debug, Default)]
pub struct WorkspaceList {
    paths: Vec<PathBuf>,
}

impl WorkspaceList {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_paths(paths: Vec<PathBuf>) -> Self {
        Self { paths }
    }

    pub fn paths(&self) -> &[PathBuf] {
        &self.paths
    }

    pub fn add(&mut self, path: &Path) -> AddOutcome {
        let canonical = canonical_form(path);
        let id = id_of(&canonical);
        if self.paths.contains(&canonical) {
            return AddOutcome::AlreadyPresent(id);
        }
        self.paths.push(canonical);
        AddOutcome::Added(id)
    }

    pub fn remove(&mut self, id: &WorkspaceId, panes: &dyn OpenPanes) -> Result<(), RemoveError> {
        let index = self
            .paths
            .iter()
            .position(|path| id_of(path) == *id)
            .ok_or(RemoveError::NotFound)?;
        if panes.has_open_panes(id) {
            return Err(RemoveError::HasOpenPanes);
        }
        self.paths.remove(index);
        Ok(())
    }

    pub fn entries(&self, probe: &dyn FolderProbe) -> Vec<WorkspaceView> {
        self.paths
            .iter()
            .map(|path| WorkspaceView {
                id: id_of(path),
                name: display_name(path),
                path: path.clone(),
                missing: !probe.exists(path),
            })
            .collect()
    }
}

fn id_of(path: &Path) -> WorkspaceId {
    WorkspaceId(path.to_string_lossy().into_owned())
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy()
        .into_owned()
}

// A folder that no longer exists cannot be canonicalized; the component
// round-trip still drops a trailing separator so duplicates compare equal.
fn canonical_form(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.components().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct AllPresent;
    impl FolderProbe for AllPresent {
        fn exists(&self, _path: &Path) -> bool {
            true
        }
    }

    #[test]
    fn add_creates_entry_named_after_folder() {
        let root = tempfile::tempdir().unwrap();
        let folder = root.path().join("mokairo");
        fs::create_dir(&folder).unwrap();
        let canonical = fs::canonicalize(&folder).unwrap();

        let mut list = WorkspaceList::new();
        let outcome = list.add(&folder);

        let id = WorkspaceId(canonical.to_string_lossy().into_owned());
        assert_eq!(outcome, AddOutcome::Added(id.clone()));
        let entries = list.entries(&AllPresent);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, id);
        assert_eq!(entries[0].name, "mokairo");
        assert_eq!(entries[0].path, canonical);
    }

    #[test]
    fn add_existing_path_returns_already_present_and_changes_nothing() {
        let root = tempfile::tempdir().unwrap();
        let first = root.path().join("alpha");
        let second = root.path().join("beta");
        fs::create_dir(&first).unwrap();
        fs::create_dir(&second).unwrap();

        let mut list = WorkspaceList::new();
        let AddOutcome::Added(first_id) = list.add(&first) else {
            panic!("first add must create an entry");
        };
        list.add(&second);
        let before = list.paths().to_vec();

        let with_trailing_slash = PathBuf::from(format!("{}/", first.display()));
        assert_eq!(
            list.add(&with_trailing_slash),
            AddOutcome::AlreadyPresent(first_id.clone())
        );
        assert_eq!(list.add(&first), AddOutcome::AlreadyPresent(first_id));
        assert_eq!(list.paths(), before.as_slice());
    }

    #[test]
    fn add_deduplicates_missing_folders_by_given_path() {
        let mut list = WorkspaceList::new();
        list.add(Path::new("/gone/proj"));
        assert!(matches!(
            list.add(Path::new("/gone/proj/")),
            AddOutcome::AlreadyPresent(_)
        ));
        assert_eq!(list.paths().len(), 1);
    }

    struct GoneFolders(Vec<PathBuf>);
    impl FolderProbe for GoneFolders {
        fn exists(&self, path: &Path) -> bool {
            !self.0.iter().any(|gone| gone == path)
        }
    }

    #[test]
    fn entries_marks_only_vanished_folders_missing() {
        let list =
            WorkspaceList::from_paths(vec![PathBuf::from("/w/kept"), PathBuf::from("/w/gone")]);
        let probe = GoneFolders(vec![PathBuf::from("/w/gone")]);

        let entries = list.entries(&probe);

        assert_eq!(entries.len(), 2);
        assert_eq!(
            (entries[0].name.as_str(), entries[0].missing),
            ("kept", false)
        );
        assert_eq!(
            (entries[1].name.as_str(), entries[1].missing),
            ("gone", true)
        );
    }

    #[test]
    fn disk_probe_reports_real_folders() {
        let root = tempfile::tempdir().unwrap();
        assert!(DiskProbe.exists(root.path()));
        assert!(!DiskProbe.exists(&root.path().join("nope")));
    }

    struct PanesOpenIn(WorkspaceId);
    impl OpenPanes for PanesOpenIn {
        fn has_open_panes(&self, id: &WorkspaceId) -> bool {
            *id == self.0
        }
    }

    fn two_entry_list() -> (WorkspaceList, WorkspaceId, WorkspaceId) {
        let list = WorkspaceList::from_paths(vec![PathBuf::from("/w/a"), PathBuf::from("/w/b")]);
        (list, WorkspaceId("/w/a".into()), WorkspaceId("/w/b".into()))
    }

    #[test]
    fn remove_deletes_entry_when_no_panes_are_open() {
        let (mut list, a, _b) = two_entry_list();

        assert_eq!(list.remove(&a, &NoPanes), Ok(()));
        assert_eq!(list.paths(), [PathBuf::from("/w/b")]);
    }

    #[test]
    fn remove_is_blocked_while_panes_are_open() {
        let (mut list, a, _b) = two_entry_list();

        assert_eq!(
            list.remove(&a, &PanesOpenIn(a.clone())),
            Err(RemoveError::HasOpenPanes)
        );
        assert_eq!(list.paths().len(), 2);
    }

    #[test]
    fn remove_unknown_id_is_not_found() {
        let (mut list, _a, _b) = two_entry_list();

        assert_eq!(
            list.remove(&WorkspaceId("/w/zzz".into()), &NoPanes),
            Err(RemoveError::NotFound)
        );
        assert_eq!(list.paths().len(), 2);
    }

    #[test]
    fn remove_never_touches_the_folder_on_disk() {
        let root = tempfile::tempdir().unwrap();
        let folder = root.path().join("proj");
        fs::create_dir(&folder).unwrap();
        fs::write(folder.join("keep.txt"), "x").unwrap();
        let mut list = WorkspaceList::new();
        let AddOutcome::Added(id) = list.add(&folder) else {
            panic!("expected Added");
        };

        list.remove(&id, &NoPanes).unwrap();

        assert!(folder.join("keep.txt").is_file());
    }

    #[test]
    fn outcomes_serialize_for_the_ui() {
        let id = WorkspaceId("/w/a".into());
        assert_eq!(
            serde_json::to_string(&AddOutcome::AlreadyPresent(id)).unwrap(),
            r#"{"outcome":"alreadyPresent","id":"/w/a"}"#
        );
        assert_eq!(
            serde_json::to_string(&RemoveError::HasOpenPanes).unwrap(),
            r#""has_open_panes""#
        );
    }
}
