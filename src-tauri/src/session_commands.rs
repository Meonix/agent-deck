use tauri::{AppHandle, Manager};

use crate::commands::AppState;
use crate::panes::{PaneId, SessionId};
use crate::session_list::{SessionListing, scan_sessions};
use crate::session_trash::{DeleteError, SystemTrash, delete_with_pane, trash_session};
use crate::workspace::{DiskProbe, WorkspaceId, WorkspaceView};

/// The sessions of a workspace (SRS-FR-007), read from Claude Code's files without writing them.
#[tauri::command]
pub async fn list_sessions(workspace_id: String, app: AppHandle) -> Result<SessionListing, String> {
    let workspace = present_workspace(&app, &workspace_id)?;
    let projects = projects_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || scan_sessions(&projects, &workspace.path))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Moves a session of the workspace to the trash (SRS-FR-047); with `pane_id`, that pane's
/// session is ended first (SRS-FR-049).
#[tauri::command]
pub async fn delete_session(
    workspace_id: String,
    session_id: String,
    pane_id: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let workspace = present_workspace(&app, &workspace_id)?;
    let projects = projects_dir(&app)?;
    let deleted = session_id.clone();
    let process = match pane_id {
        Some(pane) => app
            .state::<AppState>()
            .panes
            .lock()
            .unwrap()
            .take_for_session(&PaneId(pane), &SessionId(session_id.clone()))
            .map_err(|_| "wrong_pane".to_string())?,
        None => None,
    };
    tauri::async_runtime::spawn_blocking(move || {
        delete_with_pane(process, || {
            trash_session(&projects, &workspace.path, &session_id, &SystemTrash)
        })
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| match e {
        DeleteError::NotFound => "not_found".to_string(),
        DeleteError::Failed(e) => e.to_string(),
    })?;
    // Only once the files are in the Trash (SRS-FR-129).
    app.state::<AppState>()
        .progress
        .lock()
        .unwrap()
        .remove(&deleted);
    Ok(())
}

fn present_workspace(app: &AppHandle, workspace_id: &str) -> Result<WorkspaceView, String> {
    let workspace = {
        let state = app.state::<AppState>();
        let list = state.list.lock().unwrap();
        list.entries(&DiskProbe)
            .into_iter()
            .find(|w| w.id == WorkspaceId(workspace_id.to_string()))
            .ok_or_else(|| "not_found".to_string())?
    };
    if workspace.missing {
        return Err("folder_missing".into());
    }
    Ok(workspace)
}

fn projects_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .home_dir()
        .map_err(|e| e.to_string())?
        .join(".claude")
        .join("projects"))
}
