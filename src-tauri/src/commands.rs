use std::path::Path;
use std::sync::Mutex;

use tauri::State;

use crate::workspace::{
    AddOutcome, DiskProbe, NoPanes, RemoveError, WorkspaceId, WorkspaceList, WorkspaceStore,
    WorkspaceView,
};

pub struct AppState {
    pub list: Mutex<WorkspaceList>,
    pub store: WorkspaceStore,
}

#[tauri::command]
pub fn list_workspaces(state: State<'_, AppState>) -> Vec<WorkspaceView> {
    state.list.lock().unwrap().entries(&DiskProbe)
}

#[tauri::command]
pub fn add_workspace(path: String, state: State<'_, AppState>) -> Result<AddOutcome, String> {
    let mut list = state.list.lock().unwrap();
    add_and_save(&mut list, &state.store, Path::new(&path))
}

#[tauri::command]
pub fn remove_workspace(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut list = state.list.lock().unwrap();
    remove_and_save(&mut list, &state.store, &WorkspaceId(id))
}

// On a failed save the list is restored, so memory never diverges from disk.
fn add_and_save(
    list: &mut WorkspaceList,
    store: &WorkspaceStore,
    path: &Path,
) -> Result<AddOutcome, String> {
    let before = list.paths().to_vec();
    let outcome = list.add(path);
    if let Err(e) = store.save(list) {
        *list = WorkspaceList::from_paths(before);
        return Err(e.to_string());
    }
    Ok(outcome)
}

fn remove_and_save(
    list: &mut WorkspaceList,
    store: &WorkspaceStore,
    id: &WorkspaceId,
) -> Result<(), String> {
    let before = list.paths().to_vec();
    list.remove(id, &NoPanes).map_err(|e| match e {
        RemoveError::HasOpenPanes => "has_open_panes".to_string(),
        RemoveError::NotFound => "not_found".to_string(),
    })?;
    if let Err(e) = store.save(list) {
        *list = WorkspaceList::from_paths(before);
        return Err(e.to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::{NamedTempFile, tempdir};

    // A store whose directory is a regular file, so every save fails.
    fn failing_store() -> (NamedTempFile, WorkspaceStore) {
        let f = NamedTempFile::new().unwrap();
        let store = WorkspaceStore::new(f.path().to_path_buf());
        (f, store)
    }

    #[test]
    fn failed_save_on_add_leaves_list_unchanged() {
        let (_f, store) = failing_store();
        let existing = tempdir().unwrap();
        let new = tempdir().unwrap();
        let mut list = WorkspaceList::from_paths(vec![existing.path().to_path_buf()]);
        assert!(add_and_save(&mut list, &store, new.path()).is_err());
        assert_eq!(list.paths(), [existing.path().to_path_buf()]);
    }

    #[test]
    fn failed_save_on_remove_leaves_list_unchanged() {
        let (_f, store) = failing_store();
        let existing = tempdir().unwrap();
        let mut list = WorkspaceList::from_paths(vec![existing.path().to_path_buf()]);
        let id = WorkspaceId(existing.path().to_string_lossy().into_owned());
        assert!(remove_and_save(&mut list, &store, &id).is_err());
        assert_eq!(list.paths(), [existing.path().to_path_buf()]);
    }
}
