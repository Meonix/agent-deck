use tauri::{AppHandle, Manager};

use crate::commands::AppState;
use crate::status_latency::{LatencyRecord, STATE_NAMES};

#[tauri::command]
pub async fn record_status_shown(
    session_id: String,
    state: String,
    reported_at: u64,
    shown_at: u64,
    app: AppHandle,
) -> Result<(), String> {
    if !STATE_NAMES.contains(&state.as_str()) {
        return Err("invalid_state".into());
    }
    let record = LatencyRecord {
        session: session_id,
        state,
        reported_at,
        shown_at: shown_at.max(reported_at),
    };
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let log = state.latency.lock().unwrap();
        log.append(&record).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
