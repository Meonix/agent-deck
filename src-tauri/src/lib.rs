mod commands;
pub mod diag;
mod diag_commands;
pub mod hooks;
mod latency_commands;
pub mod launcher;
mod pane_commands;
pub mod pane_status;
pub mod panes;
pub mod progress_keeper;
pub mod pty;
mod session_commands;
pub mod session_goal;
pub mod session_list;
pub mod session_progress;
pub mod session_title;
pub mod session_trash;
pub mod summarizer;
pub mod shell;
pub mod status;
pub mod status_latency;
pub mod watchdog;
pub mod workspace;

use std::io;
use std::sync::{Arc, Mutex};

use tauri::webview::PageLoadEvent;
use tauri::{Manager, RunEvent};

use commands::AppState;
use hooks::HookServer;
use pane_commands::LaunchLookup;
use panes::PaneRegistry;
use shell::ShellRegistry;
use status_latency::StatusLatencyLog;
use workspace::WorkspaceStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Err(e) = app
                .path()
                .app_log_dir()
                .map_err(io::Error::other)
                .and_then(|dir| diag::init(&dir))
            {
                diag::error(
                    "app",
                    &format!("log folder unavailable, logging to stderr: {e}"),
                );
            }
            diag::install_panic_hook();
            diag::info(
                "app",
                &format!(
                    "agent-deck {} on {} {}, pid {}",
                    env!("CARGO_PKG_VERSION"),
                    std::env::consts::OS,
                    std::env::consts::ARCH,
                    std::process::id()
                ),
            );
            let data_dir = app.path().app_data_dir()?;
            let store = WorkspaceStore::new(data_dir.clone());
            let list = store.load()?;
            let goals = session_goal::GoalStore::load(data_dir.clone());
            let progress = Arc::new(Mutex::new(session_progress::ProgressStore::load(
                data_dir.clone(),
            )));
            if let Ok(home) = app.path().home_dir() {
                let progress = progress.clone();
                std::thread::spawn(move || {
                    progress_keeper::prune_without_history(
                        &progress,
                        &home.join(".claude").join("projects"),
                    )
                });
            }
            let launch = Arc::new(LaunchLookup::start());
            let summarizer = Arc::new(pane_commands::LookupSummarizer {
                launch: launch.clone(),
                cwd: data_dir.clone(),
            });
            let latency = StatusLatencyLog::new(data_dir);
            if let Err(e) = latency.prune(pane_status::now_ms()) {
                diag::error(
                    "latency",
                    &format!("status latency records could not be pruned: {e}"),
                );
            }
            app.manage(AppState {
                list: Mutex::new(list),
                store,
                panes: Mutex::new(PaneRegistry::new()),
                shells: Mutex::new(ShellRegistry::new()),
                launch,
                goals: Arc::new(Mutex::new(goals)),
                progress,
                summarizer,
                hooks: HookServer::start()
                    .map_err(|e| {
                        diag::error("hooks", &format!("hook listener could not start: {e}"))
                    })
                    .ok()
                    .map(Arc::new),
                latency: Mutex::new(latency),
                watchdog: Mutex::new(watchdog::Watchdog::new()),
            });
            diag_commands::start_sampler(app.handle().clone());
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
            pane_commands::set_session_goal,
            pane_commands::set_progress_tracking,
            pane_commands::set_progress_collapsed,
            pane_commands::close_pane,
            pane_commands::open_shell,
            pane_commands::shell_write,
            pane_commands::shell_resize,
            pane_commands::shell_activity,
            latency_commands::record_status_shown,
            latency_commands::status_latency_report,
            session_commands::list_sessions,
            session_commands::delete_session,
            diag_commands::diag_log,
            diag_commands::diag_report
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|app, event| {
        if let RunEvent::Exit = event {
            pane_commands::close_all_on_exit(app);
        }
    });
}
