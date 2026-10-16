//! Session title per RULE-01, read from Claude Code's own session file.
//! The file format is internal to Claude Code; every failure degrades to `UNTITLED`.

use std::fs;
use std::path::{Path, PathBuf};

use crate::session_list::read_tail_until;

pub const UNTITLED: &str = "(untitled)";
const MAX_CHARS: usize = 80;

pub fn session_title(projects_dir: &Path, session_id: &str) -> String {
    find_session_file(projects_dir, session_id)
        .and_then(|file| read_tail_until(&file, |f| f.ai_title.is_some()).ok())
        .map_or_else(|| UNTITLED.to_string(), |facts| facts.title())
}

fn find_session_file(projects_dir: &Path, session_id: &str) -> Option<PathBuf> {
    let name = format!("{session_id}.jsonl");
    fs::read_dir(projects_dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path().join(&name))
        .find(|path| path.is_file())
}

pub(crate) fn one_line(text: &str) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= MAX_CHARS {
        return collapsed;
    }
    let mut cut: String = collapsed.chars().take(MAX_CHARS - 1).collect();
    cut.truncate(cut.trim_end().len());
    cut.push('…');
    cut
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_session(root: &TempDir, folder: &str, id: &str, lines: &[&str]) {
        let dir = root.path().join(folder);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(format!("{id}.jsonl")), lines.join("\n")).unwrap();
    }

    #[test]
    fn last_ai_title_wins() {
        let root = TempDir::new().unwrap();
        write_session(
            &root,
            "p",
            "s1",
            &[
                r#"{"type":"ai-title","aiTitle":"First"}"#,
                r#"{"type":"last-prompt","lastPrompt":"ignored"}"#,
                r#"{"type":"ai-title","aiTitle":"Second"}"#,
            ],
        );
        assert_eq!(session_title(root.path(), "s1"), "Second");
    }

    #[test]
    fn falls_back_to_last_prompt() {
        let root = TempDir::new().unwrap();
        write_session(
            &root,
            "p",
            "s1",
            &[
                r#"{"type":"last-prompt","lastPrompt":"one"}"#,
                r#"{"type":"last-prompt","leafUuid":"x"}"#,
                r#"{"type":"last-prompt","lastPrompt":"two"}"#,
            ],
        );
        assert_eq!(session_title(root.path(), "s1"), "two");
    }

    #[test]
    fn untitled_without_records_or_file() {
        let root = TempDir::new().unwrap();
        write_session(&root, "p", "s1", &[r#"{"type":"user"}"#]);
        assert_eq!(session_title(root.path(), "s1"), UNTITLED);
        assert_eq!(session_title(root.path(), "missing"), UNTITLED);
        assert_eq!(session_title(&root.path().join("nope"), "s1"), UNTITLED);
    }

    #[test]
    fn garbage_line_is_skipped() {
        let root = TempDir::new().unwrap();
        write_session(
            &root,
            "p",
            "s1",
            &[r#"{"type":"ai-title","aiTitle":"Good"}"#, "{not json", ""],
        );
        assert_eq!(session_title(root.path(), "s1"), "Good");
    }

    #[test]
    fn long_multiline_prompt_becomes_one_short_line() {
        let root = TempDir::new().unwrap();
        let prompt = format!("  {}\n\n\t{}  ", "a".repeat(150), "b".repeat(150));
        let line = serde_json::json!({"type":"last-prompt","lastPrompt":prompt}).to_string();
        write_session(&root, "p", "s1", &[&line]);
        let got = session_title(root.path(), "s1");
        assert!(!got.contains('\n') && !got.contains('\t'));
        assert!(got.chars().count() <= 80, "{got}");
        assert!(got.ends_with('…'));
        assert!(got.starts_with("aaa"));
    }

    #[test]
    fn found_in_any_project_subfolder() {
        let root = TempDir::new().unwrap();
        write_session(&root, "-a", "s0", &[r#"{"type":"ai-title","aiTitle":"A"}"#]);
        write_session(&root, "-b", "s1", &[r#"{"type":"ai-title","aiTitle":"B"}"#]);
        assert_eq!(session_title(root.path(), "s1"), "B");
    }

    #[test]
    fn large_file_with_title_at_the_end() {
        let root = TempDir::new().unwrap();
        let dir = root.path().join("p");
        fs::create_dir_all(&dir).unwrap();
        let filler = format!("{{\"type\":\"user\",\"text\":\"{}\"}}\n", "x".repeat(1000));
        let mut data = filler.repeat(20_000);
        data.push_str(r#"{"type":"ai-title","aiTitle":"Tail"}"#);
        fs::write(dir.join("s1.jsonl"), data).unwrap();
        assert_eq!(session_title(root.path(), "s1"), "Tail");
    }

    #[test]
    fn invalid_utf8_line_is_skipped() {
        let root = TempDir::new().unwrap();
        let dir = root.path().join("p");
        fs::create_dir_all(&dir).unwrap();
        let mut data = b"{\"type\":\"ai-title\",\"aiTitle\":\"Ok\"}\n".to_vec();
        data.extend_from_slice(b"{\"type\":\"ai-title\",\"aiTitle\":\"\xff\xfe\"}\n");
        fs::write(dir.join("s1.jsonl"), data).unwrap();
        assert_eq!(session_title(root.path(), "s1"), "Ok");
    }

    #[test]
    fn vietnamese_prompt_truncates_on_char_boundary() {
        let root = TempDir::new().unwrap();
        let prompt = "ứng dụng quản lý đồng thời nhiều phiên làm việc ".repeat(5);
        let line = serde_json::json!({"type":"last-prompt","lastPrompt":prompt}).to_string();
        write_session(&root, "p", "s1", &[&line]);
        let got = session_title(root.path(), "s1");
        assert_eq!(got.chars().count(), 80);
        assert!(got.ends_with('…'));
        assert!(got.starts_with("ứng dụng"));
    }
}
