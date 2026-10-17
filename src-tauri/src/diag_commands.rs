use std::time::Duration;

use tauri::{AppHandle, Manager, State};

use crate::commands::AppState;
use crate::diag::{self, Level};
use crate::watchdog::{
    Note, PaneStat, ProcStat, SAMPLE_SECS, Sample, UiReport, parse_ps, survivor,
};

const SURVIVOR_CHECK: Duration = Duration::from_secs(5);

#[tauri::command]
pub fn diag_log(level: String, source: String, message: String) {
    let source = format!("ui:{source}");
    match level.as_str() {
        "ERROR" => diag::error(&source, &message),
        "WARN" => diag::warn(&source, &message),
        _ => diag::info(&source, &message),
    }
}

#[tauri::command]
pub fn diag_report(report: UiReport, state: State<'_, AppState>) {
    let notes = state.watchdog.lock().unwrap().report(&report);
    write(&notes);
}

/// Samples memory and CPU every `SAMPLE_SECS` for the life of the app.
pub fn start_sampler(app: AppHandle) {
    if !cfg!(unix) {
        diag::info(
            "watchdog",
            "memory and CPU sampling is not available on this platform",
        );
        return;
    }
    std::thread::spawn(move || {
        let mut ps_failed = false;
        loop {
            std::thread::sleep(Duration::from_secs(SAMPLE_SECS));
            let state = app.state::<AppState>();
            let pids = state.panes.lock().unwrap().pids();
            let Some(sample) = sample(&pids) else {
                if !ps_failed {
                    diag::warn(
                        "watchdog",
                        "ps gave no figures for the app; sampling skipped",
                    );
                    ps_failed = true;
                }
                continue;
            };
            ps_failed = false;
            let notes = state.watchdog.lock().unwrap().observe(&sample);
            write(&notes);
        }
    });
}

fn sample(pids: &[(crate::panes::PaneId, u32)]) -> Option<Sample> {
    let app_pid = std::process::id();
    let list: Vec<String> = std::iter::once(app_pid)
        .chain(pids.iter().map(|(_, pid)| *pid))
        .map(|pid| pid.to_string())
        .collect();
    let output = std::process::Command::new("ps")
        .args(["-o", "pid=,rss=,%cpu=", "-p", &list.join(",")])
        .output()
        .ok()?;
    let stats = parse_ps(&String::from_utf8_lossy(&output.stdout));
    let app: ProcStat = *stats.get(&app_pid)?;
    let panes = pids
        .iter()
        .map(|(pane, pid)| PaneStat {
            pane: pane.0.clone(),
            pid: *pid,
            stat: stats.get(pid).copied(),
        })
        .collect();
    Some(Sample { app, panes })
}

/// Logs a warning if `pid` is still alive a few seconds after its pane closed.
pub fn check_survivor(pane: String, pid: u32) {
    std::thread::spawn(move || {
        std::thread::sleep(SURVIVOR_CHECK);
        if alive(pid) {
            write(&[survivor(&pane, pid)]);
        }
    });
}

#[cfg(unix)]
fn alive(pid: u32) -> bool {
    // Signal 0 only checks that the process exists.
    unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
}

#[cfg(not(unix))]
fn alive(_pid: u32) -> bool {
    false
}

fn write(notes: &[Note]) {
    for note in notes {
        match note.level {
            Level::Info => diag::info("watchdog", &note.message),
            Level::Warn => diag::warn("watchdog", &note.message),
            Level::Error => diag::error("watchdog", &note.message),
        }
    }
}
