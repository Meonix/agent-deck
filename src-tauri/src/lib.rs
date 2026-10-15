mod commands;
pub mod launcher;
mod pane_commands;
pub mod panes;
pub mod pty;
pub mod workspace;

use std::sync::Mutex;

use tauri::{Manager, RunEvent};

use commands::AppState;
use pane_commands::LaunchLookup;
use panes::PaneRegistry;
use workspace::WorkspaceStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let store = WorkspaceStore::new(app.path().app_data_dir()?);
            let list = store.load()?;
            app.manage(AppState {
                list: Mutex::new(list),
                store,
                panes: Mutex::new(PaneRegistry::new()),
                launch: LaunchLookup::start(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::add_workspace,
            commands::remove_workspace,
            pane_commands::open_pane,
            pane_commands::pane_write,
            pane_commands::pane_resize,
            pane_commands::close_pane
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|app, event| {
        if let RunEvent::Exit = event {
            pane_commands::close_all_on_exit(app);
        }
    });
}
