mod commands;
pub mod hooks;
mod latency_commands;
pub mod launcher;
mod pane_commands;
pub mod pane_status;
pub mod panes;
pub mod pty;
pub mod session_title;
pub mod status;
pub mod status_latency;
pub mod workspace;

use std::sync::{Arc, Mutex};

use tauri::webview::PageLoadEvent;
use tauri::{Manager, RunEvent};

use commands::AppState;
use hooks::HookServer;
use pane_commands::LaunchLookup;
use panes::PaneRegistry;
use status_latency::StatusLatencyLog;
use workspace::WorkspaceStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let store = WorkspaceStore::new(data_dir.clone());
            let list = store.load()?;
            let latency = StatusLatencyLog::new(data_dir);
            if let Err(e) = latency.prune(pane_status::now_ms()) {
                eprintln!("status latency records could not be pruned: {e}");
            }
            app.manage(AppState {
                list: Mutex::new(list),
                store,
                panes: Mutex::new(PaneRegistry::new()),
                launch: LaunchLookup::start(),
                hooks: HookServer::start()
                    .map_err(|e| eprintln!("hook listener could not start: {e}"))
                    .ok()
                    .map(Arc::new),
                latency: Mutex::new(latency),
            });
            Ok(())
        })
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Started {
                pane_commands::close_all_on_reload(webview.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::add_workspace,
            commands::remove_workspace,
            pane_commands::open_pane,
            pane_commands::pane_write,
            pane_commands::pane_resize,
            pane_commands::pane_title,
            pane_commands::close_pane,
            latency_commands::record_status_shown,
            latency_commands::status_latency_report
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|app, event| {
        if let RunEvent::Exit = event {
            pane_commands::close_all_on_exit(app);
        }
    });
}
