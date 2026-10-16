use tauri::{AppHandle, Manager};

use crate::commands::AppState;
use crate::pane_status::now_ms;
use crate::status_latency::{LatencyRecord, LatencyReport, STATE_NAMES};

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

#[tauri::command]
pub async fn status_latency_report(app: AppHandle) -> Result<LatencyReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let log = state.latency.lock().unwrap();
        let now = now_ms();
        // Also pruned here, so an app left open for weeks still keeps only the window.
        if let Err(e) = log.prune(now) {
            eprintln!("status latency records could not be pruned: {e}");
        }
        log.report(now).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
