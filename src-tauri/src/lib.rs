mod commands;
pub mod launcher;
pub mod workspace;

use std::sync::Mutex;

use tauri::Manager;

use commands::AppState;
use workspace::WorkspaceStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let store = WorkspaceStore::new(app.path().app_data_dir()?);
            let list = store.load()?;
            app.manage(AppState {
                list: Mutex::new(list),
                store,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::add_workspace,
            commands::remove_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
