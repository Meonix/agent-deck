use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

const FILE_NAME: &str = "agent-deck.log";
const MAX_BYTES: u64 = 5 * 1024 * 1024;
/// The live file plus `.1` and `.2`.
const KEEP: usize = 3;
const MAX_MESSAGE: usize = 2000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Level {
    Info,
    Warn,
    Error,
}

impl Level {
    fn label(self) -> &'static str {
        match self {
            Level::Info => "INFO",
            Level::Warn => "WARN",
            Level::Error => "ERROR",
        }
    }
}

/// One log line: `<UTC time> <LEVEL> <source>: <message>`, the message on one line and capped.
pub fn line(now_ms: u64, level: Level, source: &str, message: &str) -> String {
    let one_line = message.replace('\r', "\\r").replace('\n', "\\n");
    let message = match one_line.char_indices().nth(MAX_MESSAGE) {
        Some((cut, _)) => format!("{}…", &one_line[..cut]),
        None => one_line,
    };
    format!("{} {} {source}: {message}", utc(now_ms), level.label())
}

fn utc(ms: u64) -> String {
    let secs = ms / 1000;
    let (year, month, day) = civil_from_days((secs / 86_400) as i64);
    let rem = secs % 86_400;
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60,
        ms % 1000
    )
}

/// Date of a day count since 1970-01-01 (Howard Hinnant's `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

pub struct Log {
    dir: PathBuf,
    max_bytes: u64,
    file: Mutex<Option<(File, u64)>>,
}

impl Log {
    pub fn open(dir: &Path) -> io::Result<Log> {
        Self::with_limit(dir, MAX_BYTES)
    }

    fn with_limit(dir: &Path, max_bytes: u64) -> io::Result<Log> {
        fs::create_dir_all(dir)?;
        Ok(Log {
            dir: dir.to_path_buf(),
            max_bytes,
            file: Mutex::new(None),
        })
    }

    pub fn write(&self, level: Level, source: &str, message: &str) {
        let text = format!("{}\n", line(now_ms(), level, source, message));
        let mut slot = self.file.lock().unwrap_or_else(|p| p.into_inner());
        // Losing a diagnostic line must never disturb the app.
        let _ = self.append(&mut slot, text.as_bytes());
    }

    fn append(&self, slot: &mut Option<(File, u64)>, bytes: &[u8]) -> io::Result<()> {
        if slot.is_none() {
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(self.path(0))?;
            let len = file.metadata()?.len();
            *slot = Some((file, len));
        }
        let size = slot.as_ref().map_or(0, |(_, len)| *len);
        if size > 0 && size + bytes.len() as u64 > self.max_bytes {
            *slot = None;
            self.rotate()?;
            *slot = Some((File::create(self.path(0))?, 0));
        }
        let (file, len) = slot.as_mut().expect("opened above");
        file.write_all(bytes)?;
        *len += bytes.len() as u64;
        Ok(())
    }

    fn rotate(&self) -> io::Result<()> {
        let _ = fs::remove_file(self.path(KEEP - 1));
        for n in (0..KEEP - 1).rev() {
            if self.path(n).exists() {
                fs::rename(self.path(n), self.path(n + 1))?;
            }
        }
        Ok(())
    }

    fn path(&self, n: usize) -> PathBuf {
        match n {
            0 => self.dir.join(FILE_NAME),
            n => self.dir.join(format!("{FILE_NAME}.{n}")),
        }
    }
}

static GLOBAL: OnceLock<Log> = OnceLock::new();

/// Sends `info`, `warn` and `error` to a log in `dir`; until then they go to stderr.
pub fn init(dir: &Path) -> io::Result<()> {
    let _ = GLOBAL.set(Log::open(dir)?);
    Ok(())
}

pub fn info(source: &str, message: &str) {
    emit(Level::Info, source, message);
}

pub fn warn(source: &str, message: &str) {
    emit(Level::Warn, source, message);
}

pub fn error(source: &str, message: &str) {
    emit(Level::Error, source, message);
}

fn emit(level: Level, source: &str, message: &str) {
    match GLOBAL.get() {
        Some(log) => log.write(level, source, message),
        None => eprintln!("{}", line(now_ms(), level, source, message)),
    }
}

/// Logs every panic, then lets the previous hook run (release builds abort right after).
pub fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = info.payload();
        let message = payload
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| payload.downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "non-text panic".to_string());
        let at = info
            .location()
            .map(|l| format!(" at {}:{}", l.file(), l.line()))
            .unwrap_or_default();
        error("panic", &format!("{message}{at}"));
        previous(info);
    }));
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(dir: &Path, name: &str) -> String {
        fs::read_to_string(dir.join(name)).unwrap_or_default()
    }

    #[test]
    fn line_has_utc_time_level_source_and_message() {
        // 2026-10-17T03:04:05.678Z
        let ms = 1_792_206_245_678;
        assert_eq!(
            line(ms, Level::Warn, "watchdog", "app CPU 97%"),
            "2026-10-17T03:04:05.678Z WARN watchdog: app CPU 97%"
        );
    }

    #[test]
    fn line_keeps_the_message_on_one_line_and_caps_it() {
        let l = line(0, Level::Error, "ui", "a\nb\r\nc");
        assert_eq!(l, "1970-01-01T00:00:00.000Z ERROR ui: a\\nb\\r\\nc");
        let long = "x".repeat(MAX_MESSAGE + 50);
        let capped = line(0, Level::Info, "s", &long);
        assert!(
            capped.ends_with(&format!("{}…", "x".repeat(MAX_MESSAGE))),
            "{}",
            capped.len()
        );
    }

    #[test]
    fn write_appends_lines_to_the_log_file() {
        let dir = tempfile::tempdir().unwrap();
        let log = Log::open(dir.path()).unwrap();
        log.write(Level::Info, "app", "started");
        log.write(Level::Error, "pane", "spawn failed");
        let text = read(dir.path(), FILE_NAME);
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].ends_with(" INFO app: started"), "{}", lines[0]);
        assert!(
            lines[1].ends_with(" ERROR pane: spawn failed"),
            "{}",
            lines[1]
        );
    }

    #[test]
    fn open_creates_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("Logs/dev.agentdeck.desktop");
        Log::open(&nested).unwrap().write(Level::Info, "app", "x");
        assert!(read(&nested, FILE_NAME).contains("app: x"));
    }

    #[test]
    fn rotates_before_passing_the_limit_and_keeps_three_files() {
        let dir = tempfile::tempdir().unwrap();
        // Each line is 24 (time) + 1 + 4 + 1 + "s: " 3 + 10 + newline = 44 bytes.
        let log = Log::with_limit(dir.path(), 100).unwrap();
        for i in 0..10 {
            log.write(Level::Info, "s", &format!("message-{i:02}"));
        }
        let live = read(dir.path(), FILE_NAME);
        let one = read(dir.path(), &format!("{FILE_NAME}.1"));
        let two = read(dir.path(), &format!("{FILE_NAME}.2"));
        assert!(!dir.path().join(format!("{FILE_NAME}.3")).exists());
        // Two lines fit in 100 bytes; the third rotates.
        assert_eq!(live.lines().count(), 2, "{live}");
        assert!(live.contains("message-08") && live.contains("message-09"));
        assert!(one.contains("message-06") && one.contains("message-07"));
        assert!(two.contains("message-04") && two.contains("message-05"));
        assert!(fs::metadata(dir.path().join(FILE_NAME)).unwrap().len() <= 100);
    }

    #[test]
    fn a_panic_in_any_thread_is_logged_with_its_location() {
        let dir = tempfile::tempdir().unwrap();
        init(dir.path()).unwrap();
        install_panic_hook();
        let _ = std::thread::spawn(|| panic!("boom in a pane thread")).join();
        let text = read(dir.path(), FILE_NAME);
        assert!(
            text.contains("ERROR panic: boom in a pane thread at src/diag.rs:"),
            "{text}"
        );
    }

    #[test]
    fn rotation_counts_what_an_earlier_run_left() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(FILE_NAME), "x".repeat(90)).unwrap();
        let log = Log::with_limit(dir.path(), 100).unwrap();
        log.write(Level::Info, "s", "message-00");
        assert_eq!(read(dir.path(), &format!("{FILE_NAME}.1")), "x".repeat(90));
        assert!(read(dir.path(), FILE_NAME).contains("message-00"));
    }
}
