use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const FILE: &str = "status-latency.jsonl";
const TMP: &str = "status-latency.jsonl.tmp";
/// The report window of SRS-FR-039.
pub const WINDOW_MS: u64 = 14 * 24 * 60 * 60 * 1000;
/// BO-01: a change counts when the board showed it within 3 s.
pub const TARGET_MS: u64 = 3000;

/// The names a record may carry, so a record can never hold anything but a state (SRS-NFR-007).
pub const STATE_NAMES: [&str; 5] = ["Running", "Needs Approval", "Idle", "Error", "Ended"];

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
        let path = self.dir.join(FILE);
        let mut line = Vec::new();
        // A line cut off by a crash must not swallow this record.
        if !ends_with_newline(&path)? {
            line.push(b'\n');
        }
        line.extend(serde_json::to_vec(record).map_err(io::Error::other)?);
        line.push(b'\n');
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?
            .write_all(&line)
    }

    pub fn report(&self, now: u64) -> io::Result<LatencyReport> {
        let since = now.saturating_sub(WINDOW_MS);
        let mut report = LatencyReport {
            within: 0,
            total: 0,
        };
        for record in self.records()?.iter().filter(|r| r.shown_at >= since) {
            report.total += 1;
            if record.shown_at.saturating_sub(record.reported_at) <= TARGET_MS {
                report.within += 1;
            }
        }
        Ok(report)
    }

    /// Rewrites the file with only the records inside the report window, when any is older.
    pub fn prune(&self, now: u64) -> io::Result<()> {
        let since = now.saturating_sub(WINDOW_MS);
        let records = self.records()?;
        if records.iter().all(|r| r.shown_at >= since) {
            return Ok(());
        }
        let mut kept = Vec::new();
        for record in records.iter().filter(|r| r.shown_at >= since) {
            kept.extend(serde_json::to_vec(record).map_err(io::Error::other)?);
            kept.push(b'\n');
        }
        let tmp = self.dir.join(TMP);
        let mut file = File::create(&tmp)?;
        file.write_all(&kept)?;
        // Durable before the rename replaces the only copy of the trial's records.
        file.sync_all()?;
        fs::rename(&tmp, self.dir.join(FILE))
    }

    /// Every readable record; lines that are cut off, not JSON or not UTF-8 are skipped.
    fn records(&self) -> io::Result<Vec<LatencyRecord>> {
        let bytes = match fs::read(self.dir.join(FILE)) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e),
        };
        Ok(bytes
            .split(|b| *b == b'\n')
            .filter_map(|line| serde_json::from_slice::<LatencyRecord>(line).ok())
            .collect())
    }
}

fn ends_with_newline(path: &std::path::Path) -> io::Result<bool> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(true),
        Err(e) => return Err(e),
    };
    if file.metadata()?.len() == 0 {
        return Ok(true);
    }
    file.seek(SeekFrom::End(-1))?;
    let mut last = [0u8; 1];
    file.read_exact(&mut last)?;
    Ok(last[0] == b'\n')
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
    fn a_line_cut_off_by_a_crash_does_not_swallow_the_next_record() {
        let (_dir, log) = log();
        log.append(&record(NOW - 10, NOW)).unwrap();
        let mut file = OpenOptions::new()
            .append(true)
            .open(log.dir.join(FILE))
            .unwrap();
        file.write_all(b"{\"session\":\"s-1\",\"sta").unwrap();
        log.append(&record(NOW - 20, NOW)).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 2,
                total: 2
            }
        );
        log.prune(NOW).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 2,
                total: 2
            }
        );
    }

    #[test]
    fn bytes_that_are_not_utf8_only_cost_their_line() {
        let (_dir, log) = log();
        log.append(&record(NOW - 10, NOW)).unwrap();
        let mut file = OpenOptions::new()
            .append(true)
            .open(log.dir.join(FILE))
            .unwrap();
        file.write_all(b"\xff\xfe broken\n").unwrap();
        log.append(&record(NOW - 20, NOW)).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 2,
                total: 2
            }
        );
        log.prune(NOW).unwrap();
        assert_eq!(
            log.report(NOW).unwrap(),
            LatencyReport {
                within: 2,
                total: 2
            }
        );
    }

    #[test]
    fn prune_leaves_the_file_alone_when_nothing_is_old() {
        let (_dir, log) = log();
        log.append(&record(NOW - 10, NOW)).unwrap();
        let mut file = OpenOptions::new()
            .append(true)
            .open(log.dir.join(FILE))
            .unwrap();
        file.write_all(b"kept as is\n").unwrap();
        log.prune(NOW).unwrap();
        let text = fs::read_to_string(log.dir.join(FILE)).unwrap();
        assert!(text.ends_with("kept as is\n"));
    }

    #[test]
    fn state_names_are_exactly_the_states_the_tracker_sends() {
        use crate::status::State::*;
        let sent: Vec<String> = [Running, NeedsApproval, Idle, Error, Ended]
            .iter()
            .map(|s| {
                serde_json::to_value(s)
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .to_string()
            })
            .collect();
        assert_eq!(sent, STATE_NAMES);
    }

    #[test]
    fn prune_without_a_file_does_nothing() {
        let (_dir, log) = log();
        log.prune(NOW).unwrap();
        assert!(!log.dir.join(FILE).exists());
    }
}
