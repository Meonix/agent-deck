use std::path::Path;
use std::sync::{Arc, Mutex};

use tauri::State;

use crate::hooks::HookServer;
use crate::pane_commands::LaunchLookup;
use crate::panes::PaneRegistry;
use crate::session_goal::GoalStore;
use crate::session_progress::ProgressStore;
use crate::shell::ShellRegistry;
use crate::status_latency::StatusLatencyLog;
use crate::summarizer::Summarizer;
use crate::workspace::{
    AddOutcome, DiskProbe, OpenPanes, RemoveError, WorkspaceId, WorkspaceList, WorkspaceStore,
    WorkspaceView,
};

/// Lock order: `list` before `panes` before `shells` whenever more than one is held; a pane's
/// keeper session lock comes after `panes` and before `goals`, and a pane's progress keeper lock
/// after `panes` and before `progress`. `goals` and `progress` are never held together.
pub struct AppState {
    pub list: Mutex<WorkspaceList>,
    pub store: WorkspaceStore,
    pub panes: Mutex<PaneRegistry>,
    pub shells: Mutex<ShellRegistry>,
    pub launch: Arc<LaunchLookup>,
    /// Session goals, shared by every pane's keeper; taken last, after `list`, `panes` and the keeper's session lock.
    pub goals: Arc<Mutex<GoalStore>>,
    /// Progress Records, shared by every pane's progress keeper; taken last, like `goals`, and
    /// never held while a summary runs.
    pub progress: Arc<Mutex<ProgressStore>>,
    pub summarizer: Arc<dyn Summarizer>,
    /// None when the hook listener could not start; panes then run untracked.
    pub hooks: Option<Arc<HookServer>>,
    /// Status change timing records; no other lock is held while it is used.
    pub latency: Mutex<StatusLatencyLog>,
    pub watchdog: Mutex<crate::watchdog::Watchdog>,
}

#[tauri::command]
pub fn list_workspaces(state: State<'_, AppState>) -> Vec<WorkspaceView> {
    state.list.lock().unwrap().entries(&DiskProbe)
}

#[tauri::command]
pub fn add_workspace(path: String, state: State<'_, AppState>) -> Result<AddOutcome, String> {
    let path = Path::new(&path);
    validate_folder(path)?;
    let mut list = state.list.lock().unwrap();
    add_and_save(&mut list, &state.store, path)
}

#[tauri::command]
pub fn remove_workspace(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut list = state.list.lock().unwrap();
    let panes = state.panes.lock().unwrap();
    remove_and_save(&mut list, &state.store, &WorkspaceId(id), &*panes)
}

fn validate_folder(path: &Path) -> Result<(), String> {
    if path.is_absolute() && path.is_dir() {
        Ok(())
    } else {
        Err("invalid_folder".to_string())
    }
}

// On a failed save the list is restored, so memory never diverges from disk.
fn add_and_save(
    list: &mut WorkspaceList,
    store: &WorkspaceStore,
    path: &Path,
) -> Result<AddOutcome, String> {
    let before = list.paths().to_vec();
    let outcome = list.add(path);
    if matches!(outcome, AddOutcome::Added(_))
        && let Err(e) = store.save(list)
    {
        *list = WorkspaceList::from_paths(before);
        return Err(e.to_string());
    }
    Ok(outcome)
}

fn remove_and_save(
    list: &mut WorkspaceList,
    store: &WorkspaceStore,
    id: &WorkspaceId,
    panes: &dyn OpenPanes,
) -> Result<(), String> {
    let before = list.paths().to_vec();
    list.remove(id, panes).map_err(|e| match e {
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
    use crate::workspace::NoPanes;
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
    fn duplicate_add_does_not_touch_disk() {
        let (_f, store) = failing_store();
        let existing = tempdir().unwrap();
        // Canonical, so the list recognises the folder (tmp is a symlink on macOS).
        let canonical = std::fs::canonicalize(existing.path()).unwrap();
        let mut list = WorkspaceList::from_paths(vec![canonical]);
        let outcome = add_and_save(&mut list, &store, existing.path()).unwrap();
        assert!(matches!(outcome, AddOutcome::AlreadyPresent(_)));
    }

    #[test]
    fn validate_folder_accepts_existing_absolute_dir() {
        let dir = tempdir().unwrap();
        assert_eq!(validate_folder(dir.path()), Ok(()));
    }

    #[test]
    fn validate_folder_rejects_relative_missing_and_file() {
        let dir = tempdir().unwrap();
        let file = NamedTempFile::new().unwrap();
        let invalid = Err("invalid_folder".to_string());
        assert_eq!(validate_folder(Path::new("relative/dir")), invalid);
        assert_eq!(validate_folder(&dir.path().join("missing")), invalid);
        assert_eq!(validate_folder(file.path()), invalid);
    }

    #[test]
    fn failed_save_on_remove_leaves_list_unchanged() {
        let (_f, store) = failing_store();
        let existing = tempdir().unwrap();
        let mut list = WorkspaceList::from_paths(vec![existing.path().to_path_buf()]);
        let id = WorkspaceId(existing.path().to_string_lossy().into_owned());
        assert!(remove_and_save(&mut list, &store, &id, &NoPanes).is_err());
        assert_eq!(list.paths(), [existing.path().to_path_buf()]);
    }
}
