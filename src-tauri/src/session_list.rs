//! The Claude Code sessions of a workspace, read from Claude Code's own session files.
//! The format is internal to Claude Code: membership needs only `cwd`; title and activity degrade.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::session_title::{UNTITLED, one_line};

const CHUNK: usize = 64 * 1024;
const HEAD_LIMIT: u64 = 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub title: String,
    pub last_activity: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SessionListing {
    pub sessions: Vec<SessionRow>,
    pub unreadable: usize,
}

/// What the end of a session file says, newest first.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TailFacts {
    pub last_activity: Option<u64>,
    pub ai_title: Option<String>,
    pub last_prompt: Option<String>,
}

impl TailFacts {
    /// RULE-01: Claude Code's title, else the newest prompt, else "(untitled)".
    pub fn title(&self) -> String {
        self.ai_title
            .clone()
            .or_else(|| self.last_prompt.clone())
            .unwrap_or_else(|| UNTITLED.to_string())
    }
}

/// Milliseconds since the epoch for `YYYY-MM-DDTHH:MM:SS[.fff]Z`, the form Claude Code writes.
pub fn parse_timestamp(text: &str) -> Option<u64> {
    let b = text.as_bytes();
    if b.len() < 20
        || b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
    {
        return None;
    }
    let num = |from: usize, to: usize| -> Option<u64> {
        let digits = text.get(from..to)?;
        digits
            .bytes()
            .all(|c| c.is_ascii_digit())
            .then(|| digits.parse().ok())?
    };
    let (year, month, day) = (num(0, 4)?, num(5, 7)?, num(8, 10)?);
    let (hour, minute, second) = (num(11, 13)?, num(14, 16)?, num(17, 19)?);
    let rest = &text[19..];
    let millis = match rest.strip_suffix('Z')? {
        "" => 0,
        fraction => {
            let digits = fraction.strip_prefix('.')?;
            if digits.is_empty() || !digits.bytes().all(|c| c.is_ascii_digit()) {
                return None;
            }
            let ms: String = digits.chars().chain("00".chars()).take(3).collect();
            ms.parse().ok()?
        }
    };
    if !(1..=12).contains(&month) || day == 0 || day > days_in_month(year, month) {
        return None;
    }
    if hour > 23 || minute > 59 || second > 59 {
        return None;
    }
    let days = days_from_civil(year as i64, month as i64, day as i64);
    let seconds = days.checked_mul(86_400)? + (hour * 3600 + minute * 60 + second) as i64;
    u64::try_from(seconds).ok().map(|s| s * 1000 + millis)
}

fn days_in_month(year: u64, month: u64) -> u64 {
    match month {
        2 if year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400)) => {
            29
        }
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

/// Days since 1970-01-01 (Howard Hinnant's `days_from_civil`).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Reads the file backwards in chunks until the newest timestamp and title are known.
pub fn read_tail(path: &Path) -> io::Result<TailFacts> {
    let mut file = File::open(path)?;
    let mut pos = file.metadata()?.len();
    let mut facts = TailFacts::default();
    // The start of the line cut by the previous chunk boundary.
    let mut carry: Vec<u8> = Vec::new();
    while pos > 0 && !(facts.last_activity.is_some() && facts.ai_title.is_some()) {
        let start = pos.saturating_sub(CHUNK as u64);
        let mut data = vec![0; (pos - start) as usize];
        file.seek(SeekFrom::Start(start))?;
        file.read_exact(&mut data)?;
        data.extend_from_slice(&carry);
        pos = start;
        let complete = if start == 0 {
            carry = Vec::new();
            &data[..]
        } else {
            match data.iter().position(|&b| b == b'\n') {
                Some(cut) => {
                    carry = data[..cut].to_vec();
                    &data[cut + 1..]
                }
                None => {
                    carry = data;
                    continue;
                }
            }
        };
        for line in complete.rsplit(|&b| b == b'\n') {
            note_line(line, &mut facts);
            if facts.last_activity.is_some() && facts.ai_title.is_some() {
                break;
            }
        }
    }
    Ok(facts)
}

fn note_line(line: &[u8], facts: &mut TailFacts) {
    let wanted = |needle: &[u8]| line.windows(needle.len()).any(|w| w == needle);
    // Cheap filter: most lines are conversation records that never need parsing.
    if !wanted(b"\"timestamp\"") && !wanted(b"\"ai-title\"") && !wanted(b"\"last-prompt\"") {
        return;
    }
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(line) else {
        return;
    };
    if facts.last_activity.is_none() {
        facts.last_activity = value
            .get("timestamp")
            .and_then(|t| t.as_str())
            .and_then(parse_timestamp);
    }
    let (slot, field) = match value.get("type").and_then(|t| t.as_str()) {
        Some("ai-title") => (&mut facts.ai_title, "aiTitle"),
        Some("last-prompt") => (&mut facts.last_prompt, "lastPrompt"),
        _ => return,
    };
    if slot.is_none() {
        *slot = value
            .get(field)
            .and_then(|v| v.as_str())
            .map(one_line)
            .filter(|s| !s.is_empty());
    }
}

/// Every session of `workspace` (RULE-02), newest first, and how many of its files could not be read.
pub fn scan_sessions(projects_dir: &Path, workspace: &Path) -> SessionListing {
    let home_folder = encoded(workspace);
    let mut matches = CwdMatcher::new(workspace);
    let mut listing = SessionListing {
        sessions: Vec::new(),
        unreadable: 0,
    };
    for (folder, file) in session_files(projects_dir) {
        let ours = folder == home_folder;
        let Some(cwd) = first_cwd(&file) else {
            listing.unreadable += usize::from(ours);
            continue;
        };
        if !matches.is(&cwd) {
            continue;
        }
        let Ok(facts) = read_tail(&file) else {
            listing.unreadable += usize::from(ours);
            continue;
        };
        let last_activity = facts.last_activity.unwrap_or_else(|| modified_ms(&file));
        listing.sessions.push(SessionRow {
            id: file
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            title: facts.title(),
            last_activity,
        });
    }
    listing.sessions.sort_by(|a, b| {
        b.last_activity
            .cmp(&a.last_activity)
            .then_with(|| a.id.cmp(&b.id))
    });
    listing
}

/// How Claude Code names a project folder today: every non-alphanumeric character becomes `-`.
fn encoded(path: &Path) -> String {
    path.to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

/// `(project folder name, session file)` for every `*.jsonl` one level below `projects_dir`.
fn session_files(projects_dir: &Path) -> Vec<(String, PathBuf)> {
    let Ok(folders) = fs::read_dir(projects_dir) else {
        return Vec::new();
    };
    let mut files = Vec::new();
    for folder in folders.flatten() {
        let Ok(entries) = fs::read_dir(folder.path()) else {
            continue;
        };
        let name = folder.file_name().to_string_lossy().into_owned();
        for entry in entries.flatten() {
            let path = entry.path();
            let is_file = entry.file_type().is_ok_and(|t| t.is_file());
            if is_file && path.extension().is_some_and(|e| e == "jsonl") {
                files.push((name.clone(), path));
            }
        }
    }
    files
}

/// The folder the session started in: the first record's `cwd`, looked for in the head only.
fn first_cwd(file: &Path) -> Option<String> {
    let reader = BufReader::new(File::open(file).ok()?.take(HEAD_LIMIT));
    reader.split(b'\n').map_while(Result::ok).find_map(|line| {
        let value = serde_json::from_slice::<serde_json::Value>(&line).ok()?;
        value.get("cwd")?.as_str().map(str::to_owned)
    })
}

fn modified_ms(file: &Path) -> u64 {
    fs::metadata(file)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64)
}

/// Exact path match, or a start path (e.g. through a symlink) that canonicalises to the workspace.
struct CwdMatcher<'a> {
    workspace: &'a Path,
    seen: HashMap<String, bool>,
}

impl<'a> CwdMatcher<'a> {
    fn new(workspace: &'a Path) -> Self {
        Self {
            workspace,
            seen: HashMap::new(),
        }
    }

    fn is(&mut self, cwd: &str) -> bool {
        if Path::new(cwd) == self.workspace {
            return true;
        }
        let workspace = self.workspace;
        *self
            .seen
            .entry(cwd.to_owned())
            .or_insert_with(|| dunce::canonicalize(cwd).is_ok_and(|p| p == workspace))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant, SystemTime};
    use tempfile::TempDir;

    const WS: &str = "/Users/me/Project/agent-deck";

    fn line(value: serde_json::Value) -> String {
        format!("{value}\n")
    }

    fn session(cwd: &str, ts: &str, title: Option<&str>) -> String {
        let mut text = line(serde_json::json!({"type": "mode", "mode": "default"}));
        text += &line(
            serde_json::json!({"type": "user", "cwd": cwd, "timestamp": "2026-10-01T00:00:00.000Z"}),
        );
        text += &line(serde_json::json!({"type": "assistant", "cwd": cwd, "timestamp": ts}));
        if let Some(title) = title {
            text += &line(serde_json::json!({"type": "ai-title", "aiTitle": title}));
        }
        text
    }

    fn write(root: &TempDir, folder: &str, id: &str, text: &str) -> PathBuf {
        let dir = root.path().join(folder);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(format!("{id}.jsonl"));
        fs::write(&path, text).unwrap();
        path
    }

    fn ids(listing: &SessionListing) -> Vec<&str> {
        listing.sessions.iter().map(|s| s.id.as_str()).collect()
    }

    #[test]
    fn parses_claude_timestamps() {
        assert_eq!(parse_timestamp("1970-01-01T00:00:00.000Z"), Some(0));
        assert_eq!(
            parse_timestamp("2026-10-16T07:12:33.123Z"),
            Some(1_792_134_753_123)
        );
        assert_eq!(
            parse_timestamp("2024-02-29T23:59:59Z"),
            Some(1_709_251_199_000)
        );
        assert_eq!(
            parse_timestamp("2026-10-16T07:12:33.5Z"),
            Some(1_792_134_753_500)
        );
        for bad in [
            "",
            "2026-10-16",
            "2026-13-01T00:00:00Z",
            "2026-10-16T07:12:33+02:00",
            "x026-10-16T07:12:33Z",
        ] {
            assert_eq!(parse_timestamp(bad), None, "{bad}");
        }
    }

    #[test]
    fn tail_gives_the_newest_timestamp_and_titles() {
        let root = TempDir::new().unwrap();
        let mut text = session(WS, "2026-10-16T07:00:00.000Z", Some("Old title"));
        text += &line(serde_json::json!({"type": "last-prompt", "lastPrompt": "first ask"}));
        text += &line(serde_json::json!({"type": "ai-title", "aiTitle": "New title"}));
        text += &line(serde_json::json!({"type": "user", "timestamp": "2026-10-16T08:00:00.000Z"}));
        text += &line(serde_json::json!({"type": "last-prompt", "lastPrompt": "second ask"}));
        let facts = read_tail(&write(&root, "p", "s", &text)).unwrap();
        assert_eq!(
            facts.last_activity,
            parse_timestamp("2026-10-16T08:00:00.000Z")
        );
        assert_eq!(facts.ai_title.as_deref(), Some("New title"));
        assert_eq!(facts.title(), "New title");
    }

    #[test]
    fn tail_reads_records_split_across_chunks() {
        let root = TempDir::new().unwrap();
        let mut text = session(WS, "2026-10-16T07:00:00.000Z", Some("Before the filler"));
        let filler = line(serde_json::json!({"type": "user", "text": "x".repeat(CHUNK / 3)}));
        for _ in 0..7 {
            text += &filler;
        }
        text +=
            &line(serde_json::json!({"type": "last-prompt", "lastPrompt": "y".repeat(CHUNK + 10)}));
        let facts = read_tail(&write(&root, "p", "s", &text)).unwrap();
        assert_eq!(facts.ai_title.as_deref(), Some("Before the filler"));
        assert_eq!(
            facts.last_activity,
            parse_timestamp("2026-10-16T07:00:00.000Z")
        );
        assert!(facts.last_prompt.unwrap().starts_with("yyy"));
    }

    #[test]
    fn tail_without_timestamp_or_title() {
        let root = TempDir::new().unwrap();
        let path = write(&root, "p", "s", "{\"type\":\"mode\"}\nnot json\n");
        let facts = read_tail(&path).unwrap();
        assert_eq!(facts, TailFacts::default());
        assert_eq!(facts.title(), UNTITLED);
    }

    #[test]
    fn lists_only_sessions_started_exactly_in_the_workspace() {
        let root = TempDir::new().unwrap();
        let enc = "-Users-me-Project-agent-deck";
        write(
            &root,
            enc,
            "a",
            &session(WS, "2026-10-16T07:00:00.000Z", Some("A")),
        );
        // Same encoded folder, different path: /Users/me/Project/agent/deck.
        write(
            &root,
            enc,
            "collide",
            &session(
                "/Users/me/Project/agent/deck",
                "2026-10-16T07:00:00.000Z",
                None,
            ),
        );
        write(
            &root,
            "-Users-me-Project-agent-deck-ui",
            "sub",
            &session(
                "/Users/me/Project/agent-deck/ui",
                "2026-10-16T07:00:00.000Z",
                None,
            ),
        );
        // A folder name Claude Code might use one day: still found through `cwd`.
        write(
            &root,
            "renamed",
            "b",
            &session(WS, "2026-10-16T09:00:00.000Z", None),
        );
        // Not a session: a subfolder of a project folder.
        fs::create_dir_all(root.path().join(enc).join("a")).unwrap();
        let listing = scan_sessions(root.path(), Path::new(WS));
        assert_eq!(ids(&listing), ["b", "a"]);
        assert_eq!(listing.unreadable, 0);
        assert_eq!(listing.sessions[1].title, "A");
        assert_eq!(listing.sessions[0].title, UNTITLED);
        assert_eq!(
            Some(listing.sessions[0].last_activity),
            parse_timestamp("2026-10-16T09:00:00.000Z")
        );
    }

    #[test]
    fn start_folder_is_the_first_cwd() {
        let root = TempDir::new().unwrap();
        let mut moved = session(WS, "2026-10-16T07:00:00.000Z", None);
        moved += &line(
            serde_json::json!({"type": "user", "cwd": "/elsewhere", "timestamp": "2026-10-16T07:30:00.000Z"}),
        );
        write(&root, "p", "moved", &moved);
        write(
            &root,
            "q",
            "came",
            &session("/elsewhere", "2026-10-16T07:00:00.000Z", None).replace(
                "\"assistant\",\"cwd\":\"/elsewhere\"",
                &format!("\"assistant\",\"cwd\":\"{WS}\""),
            ),
        );
        assert_eq!(ids(&scan_sessions(root.path(), Path::new(WS))), ["moved"]);
    }

    #[test]
    fn symlinked_start_folder_matches() {
        let root = TempDir::new().unwrap();
        let real = root.path().join("real");
        fs::create_dir_all(&real).unwrap();
        let link = root.path().join("link");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let workspace = dunce::canonicalize(&real).unwrap();
        write(
            &root,
            "p",
            "via-link",
            &session(link.to_str().unwrap(), "2026-10-16T07:00:00.000Z", None),
        );
        assert_eq!(ids(&scan_sessions(root.path(), &workspace)), ["via-link"]);
    }

    #[test]
    fn newest_first_and_mtime_when_no_timestamp() {
        let root = TempDir::new().unwrap();
        write(
            &root,
            "p",
            "yesterday",
            &session(WS, "2026-10-15T07:00:00.000Z", None),
        );
        write(
            &root,
            "p",
            "today",
            &session(WS, "2026-10-16T07:00:00.000Z", None),
        );
        let bare = write(
            &root,
            "p",
            "bare",
            &line(serde_json::json!({"type": "mode", "cwd": WS})),
        );
        let listing = scan_sessions(root.path(), Path::new(WS));
        assert_eq!(ids(&listing), ["bare", "today", "yesterday"]);
        let mtime = fs::metadata(&bare)
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap();
        assert_eq!(listing.sessions[0].last_activity, mtime.as_millis() as u64);
    }

    #[test]
    fn no_sessions_gives_an_empty_listing() {
        let root = TempDir::new().unwrap();
        assert_eq!(
            scan_sessions(root.path(), Path::new(WS)),
            SessionListing {
                sessions: vec![],
                unreadable: 0
            }
        );
        assert_eq!(
            scan_sessions(&root.path().join("missing"), Path::new(WS)).sessions,
            vec![]
        );
    }

    #[test]
    fn unreadable_files_count_only_in_the_workspace_folder() {
        let root = TempDir::new().unwrap();
        let enc = "-Users-me-Project-agent-deck";
        for i in 0..8 {
            write(
                &root,
                enc,
                &format!("ok{i}"),
                &session(WS, "2026-10-16T07:00:00.000Z", None),
            );
        }
        write(&root, enc, "broken", "not json at all\n");
        write(
            &root,
            enc,
            "nocwd",
            &line(serde_json::json!({"type": "mode"})),
        );
        write(&root, "-Users-me-other", "elsewhere", "garbage\n");
        let listing = scan_sessions(root.path(), Path::new(WS));
        assert_eq!(listing.sessions.len(), 8);
        assert_eq!(listing.unreadable, 2);
    }

    #[test]
    fn scanning_leaves_files_untouched() {
        let root = TempDir::new().unwrap();
        let path = write(
            &root,
            "p",
            "s",
            &session(WS, "2026-10-16T07:00:00.000Z", Some("T")),
        );
        let old = SystemTime::now() - Duration::from_secs(3600);
        File::options()
            .write(true)
            .open(&path)
            .unwrap()
            .set_modified(old)
            .unwrap();
        let before = (
            fs::read(&path).unwrap(),
            fs::metadata(&path).unwrap().modified().unwrap(),
        );
        scan_sessions(root.path(), Path::new(WS));
        let after = (
            fs::read(&path).unwrap(),
            fs::metadata(&path).unwrap().modified().unwrap(),
        );
        assert_eq!(before, after);
    }

    /// SRS-NFR-003: 200 sessions, one of them 50 MB, within 3 s. Conversation records carry a
    /// `timestamp`, as every user and assistant record in real session files does.
    #[test]
    fn two_hundred_sessions_within_three_seconds() {
        let root = TempDir::new().unwrap();
        let filler = line(
            serde_json::json!({"type": "user", "timestamp": "2026-10-16T07:00:00.000Z", "text": "x".repeat(4000)}),
        );
        let medium = session(WS, "2026-10-16T07:00:00.000Z", None)
            + &filler.repeat(60)
            + &line(serde_json::json!({"type": "ai-title", "aiTitle": "Medium"}));
        for i in 0..199 {
            write(
                &root,
                "-Users-me-Project-agent-deck",
                &format!("s{i:03}"),
                &medium,
            );
        }
        let big = session(WS, "2026-10-16T07:00:00.000Z", None)
            + &filler.repeat(12_500)
            + &line(serde_json::json!({"type": "ai-title", "aiTitle": "Big"}));
        write(&root, "-Users-me-Project-agent-deck", "big", &big);
        for i in 0..100 {
            write(
                &root,
                &format!("-other-{i}"),
                "x",
                &session(&format!("/other/{i}"), "2026-10-16T07:00:00.000Z", None),
            );
        }
        let started = Instant::now();
        let listing = scan_sessions(root.path(), Path::new(WS));
        let took = started.elapsed();
        println!("200 sessions scanned in {took:?}");
        assert_eq!(listing.sessions.len(), 200);
        assert!(took < Duration::from_secs(3), "{took:?}");
    }
}

/// Real data check (task 3.2): `AD_WORKSPACE=<folder> cargo test --release real_projects -- --ignored --nocapture`.
/// Reads `~/.claude/projects` only.
#[cfg(test)]
mod real_data {
    use super::*;

    #[test]
    #[ignore = "reads this machine's Claude Code sessions"]
    fn real_projects() {
        let projects = PathBuf::from(std::env::var("HOME").unwrap()).join(".claude/projects");
        let workspace = PathBuf::from(std::env::var("AD_WORKSPACE").unwrap());
        let started = std::time::Instant::now();
        let listing = scan_sessions(&projects, &workspace);
        println!(
            "{} sessions, {} unreadable, in {:?}",
            listing.sessions.len(),
            listing.unreadable,
            started.elapsed()
        );
        for row in &listing.sessions {
            println!("  {} · {} · {}", row.id, row.title, row.last_activity);
        }
    }
}
