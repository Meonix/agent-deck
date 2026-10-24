use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Local, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const FILE: &str = "session-progress.json";
const TMP: &str = "session-progress.json.tmp";
const BAK: &str = "session-progress.json.bak";

const CHUNK_CHARS: usize = 40_000;
const TOOL_INPUT_CHARS: usize = 120;
const TOOL_ERROR_CHARS: usize = 200;

/// What is stored; `Unset` exists only while a session has no record.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tracking {
    On,
    Off,
}

/// What a pane shows: `Unset` is a new session nobody has answered for yet.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackingState {
    Unset,
    On,
    Off,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    pub summary: String,
    pub result: String,
    pub done: bool,
    /// Local `HH:MM`.
    pub started_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProgressRecord {
    pub tracking: Tracking,
    pub checkpoints: Vec<Checkpoint>,
    pub collapsed: bool,
    /// Bytes of the history file already summarised.
    pub offset: u64,
}

#[derive(Serialize, Deserialize)]
struct Stored {
    version: u32,
    records: HashMap<String, ProgressRecord>,
}

/// Progress per Claude Code session id, kept whole in `session-progress.json` (SRS-FR-129).
pub struct ProgressStore {
    dir: PathBuf,
    records: HashMap<String, ProgressRecord>,
    /// Set when the existing file could not be read or moved aside: it is never written over.
    read_only: bool,
}

impl ProgressStore {
    /// Same failure policy as `GoalStore::load`.
    pub fn load(dir: PathBuf) -> Self {
        let (records, read_only) = match Self::read(&dir) {
            Ok(records) => (records, false),
            Err(e) => {
                crate::diag::error("session_progress", &format!("cannot read {FILE}: {e}"));
                (HashMap::new(), true)
            }
        };
        ProgressStore {
            dir,
            records,
            read_only,
        }
    }

    fn read(dir: &Path) -> io::Result<HashMap<String, ProgressRecord>> {
        let file = dir.join(FILE);
        let bytes = match fs::read(&file) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(HashMap::new()),
            Err(e) => return Err(e),
        };
        match serde_json::from_slice::<Stored>(&bytes) {
            Ok(stored) => Ok(stored.records),
            Err(_) => {
                fs::rename(&file, dir.join(BAK))?;
                Ok(HashMap::new())
            }
        }
    }

    pub fn get(&self, session_id: &str) -> Option<ProgressRecord> {
        self.records.get(session_id).cloned()
    }

    /// A session with no record is asked about when it was opened new, and not tracked when resumed
    /// (SRS-FR-130).
    pub fn tracking_for(&self, session_id: &str, opened_new: bool) -> TrackingState {
        match self.records.get(session_id) {
            Some(r) if r.tracking == Tracking::On => TrackingState::On,
            Some(_) => TrackingState::Off,
            None if opened_new => TrackingState::Unset,
            None => TrackingState::Off,
        }
    }

    /// The record stays in memory for this run even when the write fails.
    pub fn set(&mut self, session_id: &str, record: ProgressRecord) {
        self.records.insert(session_id.to_string(), record);
        self.persist();
    }

    pub fn remove(&mut self, session_id: &str) {
        if self.records.remove(session_id).is_some() {
            self.persist();
        }
    }

    /// Drops the records of sessions whose history is gone; `exists` is the caller's check.
    pub fn prune_missing(&mut self, exists: impl Fn(&str) -> bool) {
        let before = self.records.len();
        self.records.retain(|id, _| exists(id));
        if self.records.len() != before {
            self.persist();
        }
    }

    fn persist(&self) {
        if self.read_only {
            return;
        }
        if let Err(e) = self.save() {
            crate::diag::error("session_progress", &format!("cannot write {FILE}: {e}"));
        }
    }

    fn save(&self) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let stored = Stored {
            version: 1,
            records: self.records.clone(),
        };
        let json = serde_json::to_vec_pretty(&stored).map_err(io::Error::other)?;
        let tmp = self.dir.join(TMP);
        fs::write(&tmp, json)?;
        fs::rename(&tmp, self.dir.join(FILE))
    }
}

/// A slice of the condensed history and the byte offset it ends at.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Chunk {
    pub text: String,
    pub end_offset: u64,
    pub first_time: String,
}

/// History records after `offset` as compact text lines (SRS-FR-124). Only whole lines are read.
/// Nothing condensed gives no chunk, and the caller keeps its old offset.
pub fn condense(bytes: &[u8], offset: u64) -> Vec<Chunk> {
    let now = Local::now().format("%H:%M").to_string();
    condense_at(bytes, offset, &Local, &now)
}

/// A chunk being filled: `end` is where a run that stops after it resumes.
#[derive(Default)]
struct Pending {
    text: String,
    chars: usize,
    first_time: Option<String>,
    end: usize,
}

impl Pending {
    fn fits(&self, line_chars: usize) -> bool {
        self.chars + 1 + line_chars <= CHUNK_CHARS
    }

    fn push(&mut self, line: &str, line_chars: usize, time: Option<&str>) {
        if !self.text.is_empty() {
            self.text.push('\n');
            self.chars += 1;
        }
        self.text.push_str(line);
        self.chars += line_chars;
        if self.first_time.is_none() {
            self.first_time = time.map(str::to_string);
        }
    }

    fn flush(&mut self, now: &str, out: &mut Vec<Chunk>) {
        if self.text.is_empty() {
            return;
        }
        let done = std::mem::take(self);
        out.push(Chunk {
            text: done.text,
            end_offset: done.end as u64,
            first_time: done.first_time.unwrap_or_else(|| now.to_string()),
        });
        self.end = done.end;
    }
}

/// A record's lines stay in one chunk when they fit in one; a larger record is split by line and
/// every piece but the last ends before the record, so a failed run re-reads it.
fn condense_at<Tz: TimeZone>(bytes: &[u8], offset: u64, tz: &Tz, now: &str) -> Vec<Chunk>
where
    Tz::Offset: std::fmt::Display,
{
    let start = usize::try_from(offset).unwrap_or(usize::MAX);
    let Some(rest) = bytes.get(start..) else {
        return Vec::new();
    };
    let mut chunks = Vec::new();
    let mut cur = Pending {
        end: start,
        ..Pending::default()
    };
    let mut pos = start;
    for raw in rest.split_inclusive(|&b| b == b'\n') {
        if raw.last() != Some(&b'\n') {
            break;
        }
        pos += raw.len();
        let Ok(record) = serde_json::from_slice::<Value>(raw) else {
            continue;
        };
        let time = record["timestamp"].as_str().and_then(|ts| hhmm(ts, tz));
        let lines: Vec<(String, usize)> = record_lines(&record)
            .iter()
            .map(|text| {
                let text = truncate(text, CHUNK_CHARS - 10);
                let line = match &time {
                    Some(t) => format!("[{t}] {text}"),
                    None => text,
                };
                let chars = line.chars().count();
                (line, chars)
            })
            .collect();
        if lines.is_empty() {
            continue;
        }
        let record_chars = lines.iter().map(|(_, c)| c).sum::<usize>() + lines.len() - 1;
        if record_chars <= CHUNK_CHARS && !cur.fits(record_chars) {
            cur.flush(now, &mut chunks);
        }
        for (line, chars) in &lines {
            if !cur.fits(*chars) {
                cur.flush(now, &mut chunks);
            }
            cur.push(line, *chars, time.as_deref());
        }
        cur.end = pos;
    }
    cur.flush(now, &mut chunks);
    chunks
}

fn hhmm<Tz: TimeZone>(ts: &str, tz: &Tz) -> Option<String>
where
    Tz::Offset: std::fmt::Display,
{
    let at = DateTime::parse_from_rfc3339(ts).ok()?;
    Some(at.with_timezone(tz).format("%H:%M").to_string())
}

fn truncate(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

/// The condensed lines one history record contributes, without their time prefix.
fn record_lines(record: &Value) -> Vec<String> {
    let kind = record["type"].as_str();
    if kind == Some("user") && record["isMeta"].as_bool() == Some(true) {
        return Vec::new();
    }
    let content = &record["message"]["content"];
    let mut lines = Vec::new();
    match (kind, content) {
        (Some("user"), Value::String(text)) => {
            lines.extend(crate::session_list::prompt_text(text).map(|t| format!("user: {t}")));
        }
        (Some("user"), Value::Array(parts)) => {
            for part in parts {
                match part["type"].as_str() {
                    Some("text") => lines.extend(
                        part["text"]
                            .as_str()
                            .and_then(crate::session_list::prompt_text)
                            .map(|t| format!("user: {t}")),
                    ),
                    Some("tool_result") if part["is_error"].as_bool() == Some(true) => {
                        let body = tool_result_text(&part["content"]);
                        lines.push(format!(
                            "tool error: {}",
                            truncate(&one_line(&body), TOOL_ERROR_CHARS)
                        ));
                    }
                    _ => {}
                }
            }
        }
        (Some("assistant"), Value::Array(parts)) => {
            for part in parts {
                match part["type"].as_str() {
                    Some("text") => {
                        if let Some(t) = part["text"]
                            .as_str()
                            .map(str::trim)
                            .filter(|t| !t.is_empty())
                        {
                            lines.push(format!("assistant: {t}"));
                        }
                    }
                    Some("tool_use") => lines.push(tool_line(part)),
                    _ => {}
                }
            }
        }
        _ => {}
    }
    lines
}

fn tool_result_text(content: &Value) -> String {
    match content {
        Value::String(s) => s.clone(),
        Value::Array(parts) => parts
            .iter()
            .filter_map(|p| p["text"].as_str())
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
}

fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn tool_line(part: &Value) -> String {
    let name = part["name"].as_str().unwrap_or("?");
    let input = &part["input"];
    let main = [
        "command",
        "file_path",
        "path",
        "pattern",
        "url",
        "description",
    ]
    .iter()
    .find_map(|key| input[*key].as_str().filter(|s| !s.is_empty()))
    .map_or_else(|| input.to_string(), str::to_string);
    format!(
        "tool: {name} — {}",
        truncate(&one_line(&main), TOOL_INPUT_CHARS)
    )
}

/// Applies the model's proposal under the app's rules (SRS-FR-126, SRS-FR-127): old items keep
/// their order and start time, `done` never reverts, items the model dropped are kept, extras are
/// appended with a valid time, and blank summaries are ignored.
pub fn merge(
    old: &[Checkpoint],
    proposed: Vec<Checkpoint>,
    fallback_time: &str,
) -> Vec<Checkpoint> {
    let mut merged: Vec<Checkpoint> = old.to_vec();
    for (i, p) in proposed.into_iter().enumerate() {
        if p.summary.trim().is_empty() {
            continue;
        }
        if i < old.len() {
            let kept = &mut merged[i];
            kept.summary = p.summary;
            kept.result = p.result;
            kept.done = kept.done || p.done;
        } else {
            let started_at = if valid_time(&p.started_at) {
                p.started_at
            } else {
                fallback_time.to_string()
            };
            merged.push(Checkpoint { started_at, ..p });
        }
    }
    merged
}

fn valid_time(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 5 && b[2] == b':' && [0, 1, 3, 4].iter().all(|&i| b[i].is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;
    use serde_json::json;
    use tempfile::tempdir;

    fn cp(summary: &str, result: &str, done: bool, at: &str) -> Checkpoint {
        Checkpoint {
            summary: summary.into(),
            result: result.into(),
            done,
            started_at: at.into(),
        }
    }

    fn record(offset: u64) -> ProgressRecord {
        ProgressRecord {
            tracking: Tracking::On,
            checkpoints: vec![cp("a", "b", false, "09:05")],
            collapsed: true,
            offset,
        }
    }

    // S1: store

    #[test]
    fn record_round_trips_through_the_file() {
        let dir = tempdir().unwrap();
        let mut store = ProgressStore::load(dir.path().to_path_buf());
        store.set("s1", record(42));
        let again = ProgressStore::load(dir.path().to_path_buf());
        assert_eq!(again.get("s1"), Some(record(42)));
        let file: Value =
            serde_json::from_slice(&fs::read(dir.path().join(FILE)).unwrap()).unwrap();
        assert_eq!(file["version"], 1);
        assert_eq!(file["records"]["s1"]["tracking"], "on");
        assert_eq!(
            file["records"]["s1"]["checkpoints"][0]["startedAt"],
            "09:05"
        );
    }

    #[test]
    fn remove_deletes_the_record_from_the_file() {
        let dir = tempdir().unwrap();
        let mut store = ProgressStore::load(dir.path().to_path_buf());
        store.set("s1", record(1));
        store.set("s2", record(2));
        store.remove("s1");
        let again = ProgressStore::load(dir.path().to_path_buf());
        assert_eq!(again.get("s1"), None);
        assert_eq!(again.get("s2"), Some(record(2)));
    }

    #[test]
    fn prune_missing_drops_records_without_history() {
        let dir = tempdir().unwrap();
        let mut store = ProgressStore::load(dir.path().to_path_buf());
        store.set("keep", record(1));
        store.set("gone", record(2));
        store.prune_missing(|id| id == "keep");
        let again = ProgressStore::load(dir.path().to_path_buf());
        assert!(again.get("keep").is_some());
        assert!(again.get("gone").is_none());
    }

    #[test]
    fn no_record_is_unset_when_new_and_off_when_resumed() {
        let dir = tempdir().unwrap();
        let mut store = ProgressStore::load(dir.path().to_path_buf());
        assert_eq!(store.tracking_for("s1", true), TrackingState::Unset);
        assert_eq!(store.tracking_for("s1", false), TrackingState::Off);
        store.set("s1", record(0));
        assert_eq!(store.tracking_for("s1", true), TrackingState::On);
        let off = ProgressRecord {
            tracking: Tracking::Off,
            ..record(0)
        };
        store.set("s1", off);
        assert_eq!(store.tracking_for("s1", true), TrackingState::Off);
    }

    #[test]
    fn corrupt_file_is_kept_as_bak_and_store_starts_empty() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(FILE), "{ nope").unwrap();
        let mut store = ProgressStore::load(dir.path().to_path_buf());
        assert!(store.get("s1").is_none());
        assert_eq!(fs::read_to_string(dir.path().join(BAK)).unwrap(), "{ nope");
        store.set("s1", record(1));
        assert!(
            ProgressStore::load(dir.path().to_path_buf())
                .get("s1")
                .is_some()
        );
    }

    #[test]
    fn unreadable_file_leaves_the_store_in_memory_only() {
        let dir = tempdir().unwrap();
        // A directory where the file should be cannot be read as a file.
        fs::create_dir(dir.path().join(FILE)).unwrap();
        let mut store = ProgressStore::load(dir.path().to_path_buf());
        store.set("s1", record(1));
        assert!(store.get("s1").is_some());
        assert!(dir.path().join(FILE).is_dir());
        assert!(!dir.path().join(TMP).exists());
    }

    // S2: condenser

    fn line(v: Value) -> String {
        format!("{v}\n")
    }

    fn user(ts: &str, content: Value) -> String {
        line(json!({"type": "user", "timestamp": ts, "message": {"content": content}}))
    }

    fn assistant(ts: &str, parts: Value) -> String {
        line(json!({"type": "assistant", "timestamp": ts, "message": {"content": parts}}))
    }

    const NOW: &str = "13:37";
    const UTC: FixedOffset = FixedOffset::east_opt(0).unwrap();

    fn condense_utc(text: &str, offset: u64) -> Vec<Chunk> {
        condense_at(text.as_bytes(), offset, &UTC, NOW)
    }

    #[test]
    fn condenses_prompts_text_tool_calls_and_tool_errors() {
        let history = [
            user("2026-10-25T09:05:00.000Z", json!("fix the bug")),
            assistant(
                "2026-10-25T09:06:30.000Z",
                json!([
                    {"type": "text", "text": "Looking."},
                    {"type": "tool_use", "name": "Bash", "input": {"command": "cargo test", "description": "x"}},
                    {"type": "tool_use", "name": "Read", "input": {"file_path": "/a/b.rs"}},
                    {"type": "tool_use", "name": "Odd", "input": {"zzz": 1}},
                ]),
            ),
            user(
                "2026-10-25T09:07:00.000Z",
                json!([{"type": "tool_result", "tool_use_id": "t", "is_error": true, "content": "boom"}]),
            ),
        ]
        .concat();
        let chunks = condense_utc(&history, 0);
        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0].text,
            "[09:05] user: fix the bug\n\
             [09:06] assistant: Looking.\n\
             [09:06] tool: Bash — cargo test\n\
             [09:06] tool: Read — /a/b.rs\n\
             [09:06] tool: Odd — {\"zzz\":1}\n\
             [09:07] tool error: boom"
        );
        assert_eq!(chunks[0].first_time, "09:05");
        assert_eq!(chunks[0].end_offset, history.len() as u64);
    }

    #[test]
    fn skips_meta_tool_output_and_local_command_records() {
        let history = [
            line(json!({"type": "user", "isMeta": true, "timestamp": "2026-10-25T09:00:00Z", "message": {"content": "meta"}})),
            user("2026-10-25T09:01:00Z", json!("<local-command-stdout>x</local-command-stdout>")),
            user(
                "2026-10-25T09:02:00Z",
                json!([{"type": "tool_result", "tool_use_id": "t", "content": "big output"}]),
            ),
            line(json!({"type": "summary", "summary": "s"})),
            assistant("2026-10-25T09:03:00Z", json!([{"type": "thinking", "thinking": "hm"}])),
        ]
        .concat();
        assert!(condense_utc(&history, 0).is_empty());
    }

    #[test]
    fn long_tool_input_and_error_are_cut() {
        let history = [
            assistant(
                "2026-10-25T09:00:00Z",
                json!([{"type": "tool_use", "name": "Bash", "input": {"command": "x".repeat(500)}}]),
            ),
            user(
                "2026-10-25T09:01:00Z",
                json!([{"type": "tool_result", "is_error": true, "content": "e".repeat(500)}]),
            ),
        ]
        .concat();
        let text = &condense_utc(&history, 0)[0].text;
        let mut lines = text.lines();
        assert_eq!(
            lines.next().unwrap().chars().count(),
            "[09:00] tool: Bash — ".chars().count() + 120
        );
        assert_eq!(
            lines.next().unwrap().chars().count(),
            "[09:01] tool error: ".chars().count() + 200
        );
    }

    #[test]
    fn partial_last_line_is_left_for_the_next_run() {
        let whole = user("2026-10-25T09:00:00Z", json!("one"));
        let partial = r#"{"type":"user","timestamp":"2026-10-25T09:01:00Z","mess"#;
        let history = format!("{whole}{partial}");
        let chunks = condense_utc(&history, 0);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].end_offset, whole.len() as u64);
        assert!(!chunks[0].text.contains("mess"));
    }

    #[test]
    fn nothing_new_gives_no_chunk() {
        let history = user("2026-10-25T09:00:00Z", json!("one"));
        assert!(condense_utc(&history, history.len() as u64).is_empty());
        assert!(condense_utc(&history, history.len() as u64 + 50).is_empty());
        assert!(condense_utc("", 0).is_empty());
    }

    #[test]
    fn reads_from_the_offset_only() {
        let first = user("2026-10-25T09:00:00Z", json!("old"));
        let second = user("2026-10-25T09:10:00Z", json!("new"));
        let history = format!("{first}{second}");
        let chunks = condense_utc(&history, first.len() as u64);
        assert_eq!(chunks[0].text, "[09:10] user: new");
        assert_eq!(chunks[0].end_offset, history.len() as u64);
    }

    #[test]
    fn times_are_converted_to_the_given_zone() {
        let history = user("2026-10-25T23:30:00Z", json!("late"));
        let plus7 = FixedOffset::east_opt(7 * 3600).unwrap();
        let chunks = condense_at(history.as_bytes(), 0, &plus7, NOW);
        assert_eq!(chunks[0].text, "[06:30] user: late");
    }

    #[test]
    fn local_time_has_hh_mm_shape() {
        let history = user("2026-10-25T09:00:00Z", json!("x"));
        let t = &condense(history.as_bytes(), 0)[0].first_time;
        assert!(valid_time(t), "{t}");
    }

    #[test]
    fn output_is_cut_into_chunks_of_at_most_40000_chars() {
        let mut history = String::new();
        let mut ends = Vec::new();
        for i in 0..10 {
            history += &user(
                &format!("2026-10-25T09:{i:02}:00Z"),
                json!("p".repeat(9_000)),
            );
            ends.push(history.len() as u64);
        }
        let chunks = condense_utc(&history, 0);
        assert!(chunks.len() > 1);
        assert!(chunks.iter().all(|c| c.text.chars().count() <= 40_000));
        assert_eq!(chunks.last().unwrap().end_offset, history.len() as u64);
        assert!(chunks.iter().all(|c| ends.contains(&c.end_offset)));
        assert!(chunks.windows(2).all(|w| w[0].end_offset < w[1].end_offset));
        assert_eq!(chunks[0].first_time, "09:00");
        let total: usize = chunks.iter().map(|c| c.text.matches("user:").count()).sum();
        assert_eq!(total, 10);
    }

    #[test]
    fn a_record_straddling_the_limit_moves_whole_to_the_next_chunk() {
        let first = user("2026-10-25T09:00:00Z", json!("p".repeat(38_500)));
        let tools: Vec<Value> = (0..20)
            .map(|i| json!({"type": "tool_use", "name": "Bash", "input": {"command": format!("{i}{}", "c".repeat(100))}}))
            .collect();
        let big = assistant("2026-10-25T09:01:00Z", json!(tools));
        let history = format!("{first}{big}");
        let chunks = condense_utc(&history, 0);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].end_offset, first.len() as u64);
        assert_eq!(chunks[1].end_offset, history.len() as u64);
        assert_eq!(chunks[1].text.lines().count(), 20);
    }

    #[test]
    fn a_record_larger_than_the_limit_is_split_and_reread_until_its_last_piece() {
        let first = user("2026-10-25T09:00:00Z", json!("one"));
        let tools: Vec<Value> = (0..5)
            .map(|_| json!({"type": "text", "text": "t".repeat(15_000)}))
            .collect();
        let big = assistant("2026-10-25T09:01:00Z", json!(tools));
        let history = format!("{first}{big}");
        let chunks = condense_utc(&history, 0);
        assert!(chunks.len() >= 2);
        let last = chunks.len() - 1;
        for c in &chunks[..last] {
            assert_eq!(c.end_offset, first.len() as u64);
        }
        assert_eq!(chunks[last].end_offset, history.len() as u64);
        assert!(chunks.iter().all(|c| c.text.chars().count() <= 40_000));
    }

    #[test]
    fn first_time_comes_from_the_first_timed_line_else_now() {
        let untimed = line(json!({"type": "user", "message": {"content": "no clock"}}));
        let timed = user("2026-10-25T09:20:00Z", json!("clock"));
        let chunks = condense_utc(&format!("{untimed}{timed}"), 0);
        assert_eq!(chunks[0].first_time, "09:20");
        let chunks = condense_utc(&untimed, 0);
        assert_eq!(chunks[0].first_time, NOW);
    }

    // S3: merge

    #[test]
    fn old_items_are_updated_in_order_and_done_never_reverts() {
        let old = [cp("a", "r", true, "09:00"), cp("b", "r", false, "09:10")];
        let merged = merge(
            &old,
            vec![
                cp("a2", "r2", false, "11:11"),
                cp("b2", "r3", true, "11:12"),
            ],
            "12:00",
        );
        assert_eq!(
            merged,
            [cp("a2", "r2", true, "09:00"), cp("b2", "r3", true, "09:10")]
        );
    }

    #[test]
    fn missing_old_items_are_kept() {
        let old = [cp("a", "r", false, "09:00"), cp("b", "r", true, "09:10")];
        let merged = merge(&old, vec![cp("a2", "r", false, "09:00")], "12:00");
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].summary, "a2");
        assert_eq!(merged[1], old[1]);
    }

    #[test]
    fn extras_are_appended_with_a_valid_time_or_the_fallback() {
        let old = [cp("a", "r", true, "09:00")];
        let merged = merge(
            &old,
            vec![
                cp("a", "r", true, "09:00"),
                cp("new1", "", false, "10:30"),
                cp("new2", "", false, "tomorrow"),
                cp("new3", "", false, "9:5"),
            ],
            "12:00",
        );
        let times: Vec<_> = merged.iter().map(|c| c.started_at.as_str()).collect();
        assert_eq!(times, ["09:00", "10:30", "12:00", "12:00"]);
    }

    #[test]
    fn blank_summary_ignores_the_proposed_item_entirely() {
        let old = [cp("a", "r", false, "09:00")];
        let merged = merge(
            &old,
            vec![cp("  ", "x", true, "09:00"), cp("", "", false, "10:00")],
            "12:00",
        );
        assert_eq!(merged, old);
    }

    #[test]
    fn empty_old_takes_all_valid_proposals() {
        let merged = merge(&[], vec![cp("x", "y", false, "08:00")], "12:00");
        assert_eq!(merged, [cp("x", "y", false, "08:00")]);
    }
}
