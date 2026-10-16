use tauri::{AppHandle, Manager};

use crate::commands::AppState;
use crate::session_list::{SessionListing, scan_sessions};
use crate::workspace::{DiskProbe, WorkspaceId};

/// The sessions of a workspace (SRS-FR-007), read from Claude Code's files without writing them.
#[tauri::command]
pub async fn list_sessions(workspace_id: String, app: AppHandle) -> Result<SessionListing, String> {
    let workspace = {
        let state = app.state::<AppState>();
        let list = state.list.lock().unwrap();
        list.entries(&DiskProbe)
            .into_iter()
            .find(|w| w.id == WorkspaceId(workspace_id.clone()))
            .ok_or_else(|| "not_found".to_string())?
    };
    if workspace.missing {
        return Err("folder_missing".into());
    }
    let projects = app
        .path()
        .home_dir()
        .map_err(|e| e.to_string())?
        .join(".claude")
        .join("projects");
    tauri::async_runtime::spawn_blocking(move || scan_sessions(&projects, &workspace.path))
        .await
        .map_err(|e| e.to_string())
}
