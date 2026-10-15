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
    let outcome = list.add(Path::new(&path));
    state.store.save(&list).map_err(|e| e.to_string())?;
    Ok(outcome)
}

#[tauri::command]
pub fn remove_workspace(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut list = state.list.lock().unwrap();
    list.remove(&WorkspaceId(id), &NoPanes)
        .map_err(|e| match e {
            RemoveError::HasOpenPanes => "has_open_panes".to_string(),
            RemoveError::NotFound => "not_found".to_string(),
        })?;
    state.store.save(&list).map_err(|e| e.to_string())
}
