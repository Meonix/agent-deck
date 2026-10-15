use std::fs;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::WorkspaceList;

const FILE: &str = "workspaces.json";
const TMP: &str = "workspaces.json.tmp";
const BAK: &str = "workspaces.json.bak";

#[derive(Serialize, Deserialize)]
struct Stored {
    version: u32,
    paths: Vec<PathBuf>,
}

pub struct WorkspaceStore {
    dir: PathBuf,
}

impl WorkspaceStore {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    pub fn load(&self) -> io::Result<WorkspaceList> {
        let file = self.dir.join(FILE);
        let bytes = match fs::read(&file) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(WorkspaceList::new()),
            Err(e) => return Err(e),
        };
        match serde_json::from_slice::<Stored>(&bytes) {
            Ok(stored) => Ok(WorkspaceList::from_paths(stored.paths)),
            Err(_) => {
                // Keep the unreadable file for manual recovery instead of overwriting it on next save.
                fs::rename(&file, self.dir.join(BAK))?;
                Ok(WorkspaceList::new())
            }
        }
    }

    pub fn save(&self, list: &WorkspaceList) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let stored = Stored {
            version: 1,
            paths: list.paths().to_vec(),
        };
        let json = serde_json::to_vec_pretty(&stored).map_err(io::Error::other)?;
        let tmp = self.dir.join(TMP);
        fs::write(&tmp, json)?;
        fs::rename(&tmp, self.dir.join(FILE))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::{NoPanes, WorkspaceId};
    use std::fs;
    use tempfile::tempdir;

    fn list_of(paths: &[&std::path::Path]) -> WorkspaceList {
        let mut l = WorkspaceList::new();
        for p in paths {
            l.add(p);
        }
        l
    }

    #[test]
    fn round_trip_keeps_entries_and_order() {
        let data = tempdir().unwrap();
        let a = tempdir().unwrap();
        let b = tempdir().unwrap();
        let list = list_of(&[a.path(), b.path()]);
        WorkspaceStore::new(data.path().to_path_buf())
            .save(&list)
            .unwrap();
        let loaded = WorkspaceStore::new(data.path().to_path_buf())
            .load()
            .unwrap();
        assert_eq!(loaded.paths(), list.paths());
        assert_eq!(loaded.paths().len(), 2);
    }

    #[test]
    fn save_creates_missing_dir_and_leaves_no_tmp() {
        let root = tempdir().unwrap();
        let dir = root.path().join("nested/app");
        let a = tempdir().unwrap();
        WorkspaceStore::new(dir.clone())
            .save(&list_of(&[a.path()]))
            .unwrap();
        assert!(dir.join("workspaces.json").is_file());
        assert!(!dir.join("workspaces.json.tmp").exists());
        let v: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.join("workspaces.json")).unwrap())
                .unwrap();
        assert_eq!(v["version"], 1);
        assert_eq!(v["paths"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn missing_file_loads_empty() {
        let data = tempdir().unwrap();
        let l = WorkspaceStore::new(data.path().to_path_buf())
            .load()
            .unwrap();
        assert!(l.paths().is_empty());
    }

    #[test]
    fn remove_and_save_leaves_folder_and_files_untouched() {
        let data = tempdir().unwrap();
        let ws = tempdir().unwrap();
        fs::create_dir_all(ws.path().join(".claude")).unwrap();
        let hist = ws.path().join(".claude/history.jsonl");
        fs::write(&hist, "{\"a\":1}\n").unwrap();
        let store = WorkspaceStore::new(data.path().to_path_buf());
        let mut list = list_of(&[ws.path()]);
        store.save(&list).unwrap();
        let id = WorkspaceId(list.paths()[0].to_string_lossy().into_owned());
        list.remove(&id, &NoPanes).unwrap();
        store.save(&list).unwrap();
        assert!(store.load().unwrap().paths().is_empty());
        assert_eq!(fs::read_to_string(&hist).unwrap(), "{\"a\":1}\n");
    }

    #[test]
    fn corrupt_file_loads_empty_and_is_kept_as_bak() {
        let data = tempdir().unwrap();
        fs::write(data.path().join("workspaces.json"), "{not json").unwrap();
        fs::write(data.path().join("workspaces.json.bak"), "old").unwrap();
        let l = WorkspaceStore::new(data.path().to_path_buf())
            .load()
            .unwrap();
        assert!(l.paths().is_empty());
        assert_eq!(
            fs::read_to_string(data.path().join("workspaces.json.bak")).unwrap(),
            "{not json"
        );
        assert!(!data.path().join("workspaces.json").exists());
    }
}
