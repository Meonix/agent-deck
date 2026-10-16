use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const FILE: &str = "status-latency.jsonl";
const TMP: &str = "status-latency.jsonl.tmp";
/// The report window of SRS-FR-039.
pub const WINDOW_MS: u64 = 14 * 24 * 60 * 60 * 1000;
/// BO-01: a change counts when the board showed it within 3 s.
pub const TARGET_MS: u64 = 3000;

/// One state change: when it was reported to the app and when the board showed it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatencyRecord {
    pub session: String,
    pub state: String,
    pub reported_at: u64,
    pub shown_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct LatencyReport {
    pub within: u64,
    pub total: u64,
}

pub struct StatusLatencyLog {
    dir: PathBuf,
}

impl StatusLatencyLog {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    pub fn append(&self, record: &LatencyRecord) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let mut line = serde_json::to_vec(record).map_err(io::Error::other)?;
        line.push(b'\n');
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.dir.join(FILE))?
            .write_all(&line)
    }

    pub fn report(&self, now: u64) -> io::Result<LatencyReport> {
        let mut report = LatencyReport {
            within: 0,
            total: 0,
        };
        for record in self.in_window(now)? {
            report.total += 1;
            if record.shown_at.saturating_sub(record.reported_at) <= TARGET_MS {
                report.within += 1;
            }
        }
        Ok(report)
    }

    /// Rewrites the file with only the records inside the report window.
    pub fn prune(&self, now: u64) -> io::Result<()> {
        if !self.dir.join(FILE).exists() {
            return Ok(());
        }
        let mut kept = Vec::new();
        for record in self.in_window(now)? {
            kept.extend(serde_json::to_vec(&record).map_err(io::Error::other)?);
            kept.push(b'\n');
        }
        let tmp = self.dir.join(TMP);
        fs::write(&tmp, kept)?;
        fs::rename(&tmp, self.dir.join(FILE))
    }

    fn in_window(&self, now: u64) -> io::Result<Vec<LatencyRecord>> {
        let text = match fs::read_to_string(self.dir.join(FILE)) {
            Ok(text) => text,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e),
        };
        let since = now.saturating_sub(WINDOW_MS);
        Ok(text
            .lines()
            .filter_map(|line| serde_json::from_str::<LatencyRecord>(line).ok())
            .filter(|record| record.shown_at >= since)
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: u64 = 24 * 60 * 60 * 1000;
    const NOW: u64 = 100 * DAY;

    fn record(reported_at: u64, shown_at: u64) -> LatencyRecord {
        LatencyRecord {
            session: "s-1".into(),
            state: "Needs Approval".into(),
            reported_at,
            shown_at,
        }
    }

    fn log() -> (tempfile::TempDir, StatusLatencyLog) {
        let dir = tempfile::tempdir().unwrap();
        let log = StatusLatencyLog::new(dir.path().join("data"));
        (dir, log)
    }

    #[test]
    fn no_file_means_no_data() {
        let (_dir, log) = log();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 0,
                total: 0
            }
        );
    }

    #[test]
    fn appended_records_are_counted_and_kept_as_json_lines() {
        let (_dir, log) = log();
        log.append(&record(NOW - 1000, NOW - 750)).unwrap();
        log.append(&record(NOW - 9000, NOW - 1000)).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 1,
                total: 2
            }
        );

        let text = fs::read_to_string(log.dir.join(FILE)).unwrap();
        let first: serde_json::Value = serde_json::from_str(text.lines().next().unwrap()).unwrap();
        assert_eq!(
            first,
            serde_json::json!({"session": "s-1", "state": "Needs Approval", "reportedAt": NOW - 1000, "shownAt": NOW - 750})
        );
    }

    #[test]
    fn exactly_three_seconds_is_within() {
        let (_dir, log) = log();
        log.append(&record(NOW - 5000, NOW - 2000)).unwrap();
        log.append(&record(NOW - 5001, NOW - 2000)).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 1,
                total: 2
            }
        );
    }

    #[test]
    fn records_older_than_fourteen_days_are_left_out() {
        let (_dir, log) = log();
        log.append(&record(NOW - 15 * DAY, NOW - 15 * DAY + 10))
            .unwrap();
        log.append(&record(NOW - WINDOW_MS - 1, NOW - WINDOW_MS - 1))
            .unwrap();
        log.append(&record(NOW - WINDOW_MS, NOW - WINDOW_MS))
            .unwrap();
        log.append(&record(NOW - 10, NOW)).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 2,
                total: 2
            }
        );
    }

    #[test]
    fn unreadable_lines_are_skipped() {
        let (_dir, log) = log();
        log.append(&record(NOW - 10, NOW)).unwrap();
        let mut file = OpenOptions::new()
            .append(true)
            .open(log.dir.join(FILE))
            .unwrap();
        file.write_all(b"not json\n{\"session\":1}\n").unwrap();
        log.append(&record(NOW - 20, NOW)).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 2,
                total: 2
            }
        );
    }

    #[test]
    fn prune_keeps_only_the_window() {
        let (_dir, log) = log();
        log.append(&record(NOW - 20 * DAY, NOW - 20 * DAY)).unwrap();
        log.append(&record(NOW - 10, NOW)).unwrap();
        log.prune(NOW).unwrap();
        let text = fs::read_to_string(log.dir.join(FILE)).unwrap();
        assert_eq!(text.lines().count(), 1);
        assert!(!log.dir.join(TMP).exists());
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 1,
                total: 1
            }
        );
    }

    #[test]
    fn prune_without_a_file_does_nothing() {
        let (_dir, log) = log();
        log.prune(NOW).unwrap();
        assert!(!log.dir.join(FILE).exists());
    }
}
