//! Chat items read from a Claude Code transcript (`<session id>.jsonl`).
//! The format is internal to Claude Code; a shape not known here is `Unrecognized`.

use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ChatItem {
    Prompt {
        key: String,
        text: String,
    },
    Reply {
        key: String,
        text: String,
    },
    Tool {
        key: String,
        id: String,
        name: String,
        arg: Option<String>,
    },
    Result {
        key: String,
        tool_id: String,
        text: String,
        is_error: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Parsed {
    Items(Vec<ChatItem>),
    Ignored,
    Unrecognized,
    Invalid,
}

const RESULT_CAP: usize = 8 * 1024;
const COMMAND_CAP: usize = 120;
const IMAGE: &str = "[ảnh]";
const WRAPPERS: [&str; 7] = [
    "<local-command-stdout>",
    "<local-command-stderr>",
    "<local-command-caveat>",
    "<system-reminder>",
    "<bash-stdout>",
    "<bash-stderr>",
    "<task-notification>",
];

pub const POLL_INTERVAL: Duration = Duration::from_millis(250);

pub fn parse_record(line: &str, cwd: &Path) -> Parsed {
    parse_line(line, cwd).0
}

/// Also says whether the record was a `user`/`assistant` one, which the unreadable rule counts.
fn parse_line(line: &str, cwd: &Path) -> (Parsed, bool) {
    let Ok(record) = serde_json::from_str::<Value>(line) else {
        return (Parsed::Invalid, false);
    };
    let is_user = match record["type"].as_str() {
        Some("user") => true,
        Some("assistant") => false,
        _ => return (Parsed::Ignored, false),
    };
    if record["isSidechain"] == true || record["isMeta"] == true {
        return (Parsed::Ignored, true);
    }
    let content = &record["message"]["content"];
    if !known_shape(content) {
        return (Parsed::Unrecognized, true);
    }
    let uuid = record["uuid"].as_str().unwrap_or_default();
    let items = if is_user {
        user_items(uuid, content)
    } else {
        assistant_items(uuid, content, cwd)
    };
    if items.is_empty() {
        (Parsed::Ignored, true)
    } else {
        (Parsed::Items(items), true)
    }
}

/// Where Claude Code writes the transcript of `session_id` started in `cwd`.
pub fn expected_path(projects_dir: &Path, cwd: &Path, session_id: &str) -> PathBuf {
    let folder: String = cwd
        .to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    projects_dir
        .join(folder)
        .join(format!("{session_id}.jsonl"))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TailUpdate {
    Reset(Vec<ChatItem>),
    Append(Vec<ChatItem>),
    Unreadable,
}

/// Reads the lines appended to a transcript since the last poll.
pub struct Tail {
    path: PathBuf,
    cwd: PathBuf,
    offset: u64,
    partial: Vec<u8>,
    hits: usize,
    misses: usize,
    reset_due: bool,
    unreadable_sent: bool,
}

impl Tail {
    pub fn new(path: PathBuf, cwd: PathBuf) -> Self {
        Self {
            path,
            cwd,
            offset: 0,
            partial: Vec::new(),
            hits: 0,
            misses: 0,
            reset_due: true,
            unreadable_sent: false,
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn switch(&mut self, path: PathBuf) {
        self.path = path;
        self.restart();
        self.unreadable_sent = false;
    }

    pub fn poll(&mut self) -> Option<TailUpdate> {
        let items = match self.read_new() {
            Ok(items) => items,
            Err(_) => {
                self.restart();
                return self.unreadable();
            }
        };
        if self.misses > 0 && self.hits == 0 {
            self.reset_due = true;
            return self.unreadable();
        }
        self.unreadable_sent = false;
        if self.reset_due {
            self.reset_due = false;
            Some(TailUpdate::Reset(items))
        } else if items.is_empty() {
            None
        } else {
            Some(TailUpdate::Append(items))
        }
    }

    fn restart(&mut self) {
        self.offset = 0;
        self.partial.clear();
        self.hits = 0;
        self.misses = 0;
        self.reset_due = true;
    }

    fn unreadable(&mut self) -> Option<TailUpdate> {
        if self.unreadable_sent {
            return None;
        }
        self.unreadable_sent = true;
        Some(TailUpdate::Unreadable)
    }

    fn read_new(&mut self) -> io::Result<Vec<ChatItem>> {
        let mut file = match File::open(&self.path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                if self.offset > 0 || !self.partial.is_empty() {
                    self.restart();
                }
                return Ok(Vec::new());
            }
            Err(error) => return Err(error),
        };
        if file.metadata()?.len() < self.offset {
            self.restart();
        }
        file.seek(SeekFrom::Start(self.offset))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        self.offset += bytes.len() as u64;
        self.partial.extend_from_slice(&bytes);
        let Some(end) = self.partial.iter().rposition(|&b| b == b'\n') else {
            return Ok(Vec::new());
        };
        let complete: Vec<u8> = self.partial.drain(..=end).collect();
        let mut items = Vec::new();
        for line in complete.split(|&b| b == b'\n') {
            let line = String::from_utf8_lossy(line);
            if line.trim().is_empty() {
                continue;
            }
            match parse_line(&line, &self.cwd) {
                (Parsed::Items(found), _) => {
                    self.hits += 1;
                    items.extend(found);
                }
                (Parsed::Ignored, true) => self.hits += 1,
                (Parsed::Unrecognized, _) => self.misses += 1,
                _ => {}
            }
        }
        Ok(items)
    }
}

enum Command {
    Switch(PathBuf),
    Stop,
}

/// Polls a `Tail` on its own thread and hands every update to `sink`.
pub struct TailThread {
    commands: Sender<Command>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl TailThread {
    pub fn spawn(
        mut tail: Tail,
        interval: Duration,
        sink: Box<dyn Fn(TailUpdate) + Send>,
    ) -> TailThread {
        let (commands, inbox) = mpsc::channel();
        let handle = thread::spawn(move || {
            loop {
                if let Some(update) = tail.poll() {
                    sink(update);
                }
                match inbox.recv_timeout(interval) {
                    Ok(Command::Switch(path)) => tail.switch(path),
                    Ok(Command::Stop) | Err(RecvTimeoutError::Disconnected) => return,
                    Err(RecvTimeoutError::Timeout) => {}
                }
            }
        });
        TailThread {
            commands,
            handle: Mutex::new(Some(handle)),
        }
    }

    pub fn switch(&self, path: PathBuf) {
        let _ = self.commands.send(Command::Switch(path));
    }

    pub fn stop(&self) {
        let _ = self.commands.send(Command::Stop);
        let handle = self.handle.lock().unwrap_or_else(|e| e.into_inner()).take();
        // A sink that stops its own thread must not join itself.
        if let Some(handle) = handle
            && handle.thread().id() != thread::current().id()
        {
            let _ = handle.join();
        }
    }
}

impl Drop for TailThread {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn tool_arg(name: &str, input: &Value, cwd: &Path) -> Option<String> {
    let field = |key: &str| input.get(key).and_then(Value::as_str);
    match name {
        "Read" | "Edit" | "MultiEdit" | "Write" => {
            field("file_path").map(|path| workspace_relative(path, cwd))
        }
        "NotebookEdit" => field("notebook_path").map(|path| workspace_relative(path, cwd)),
        "Bash" => field("command").map(first_line),
        "Grep" | "Glob" => field("pattern").map(str::to_string),
        "WebFetch" => field("url").map(str::to_string),
        "WebSearch" => field("query").map(str::to_string),
        _ => field("description").map(str::to_string),
    }
}

fn known_shape(content: &Value) -> bool {
    match content {
        Value::String(_) => true,
        Value::Array(blocks) => blocks.iter().all(|block| block["type"].is_string()),
        _ => false,
    }
}

fn key(uuid: &str, index: usize) -> String {
    format!("{uuid}:{index}")
}

fn user_items(uuid: &str, content: &Value) -> Vec<ChatItem> {
    let Value::Array(blocks) = content else {
        let text = content.as_str().unwrap_or_default();
        return prompt_text(text)
            .map(|text| {
                vec![ChatItem::Prompt {
                    key: key(uuid, 0),
                    text,
                }]
            })
            .unwrap_or_default();
    };
    let mut prompt_at = None;
    let mut parts = Vec::new();
    let mut items = Vec::new();
    for (index, block) in blocks.iter().enumerate() {
        match block["type"].as_str() {
            Some("text") | Some("image") if !is_wrapper(block_text(block).as_str()) => {
                prompt_at.get_or_insert((index, items.len()));
                parts.push(block_text(block));
            }
            Some("tool_result") => items.push(ChatItem::Result {
                key: key(uuid, index),
                tool_id: block["tool_use_id"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                text: cap(result_text(&block["content"])),
                is_error: block["is_error"] == true,
            }),
            _ => {}
        }
    }
    if let Some((index, position)) = prompt_at
        && let Some(text) = prompt_text(&parts.join("\n"))
    {
        items.insert(
            position,
            ChatItem::Prompt {
                key: key(uuid, index),
                text,
            },
        );
    }
    items
}

fn assistant_items(uuid: &str, content: &Value, cwd: &Path) -> Vec<ChatItem> {
    let Value::Array(blocks) = content else {
        let text = content.as_str().unwrap_or_default().to_string();
        return vec![ChatItem::Reply {
            key: key(uuid, 0),
            text,
        }];
    };
    blocks
        .iter()
        .enumerate()
        .filter_map(|(index, block)| match block["type"].as_str() {
            Some("text") => Some(ChatItem::Reply {
                key: key(uuid, index),
                text: block["text"].as_str()?.to_string(),
            }),
            Some("tool_use") => {
                let name = block["name"].as_str().unwrap_or_default();
                Some(ChatItem::Tool {
                    key: key(uuid, index),
                    id: block["id"].as_str().unwrap_or_default().to_string(),
                    name: name.to_string(),
                    arg: tool_arg(name, &block["input"], cwd),
                })
            }
            _ => None,
        })
        .collect()
}

/// `None` for Claude Code's own wrapper records, which Chat does not show.
fn prompt_text(text: &str) -> Option<String> {
    let trimmed = text.trim_start();
    if trimmed.is_empty() || is_wrapper(trimmed) {
        return None;
    }
    if let Some(name) = between(text, "<command-name>", "</command-name>") {
        let args = between(text, "<command-args>", "</command-args>").unwrap_or_default();
        return Some(
            format!("{} {}", name.trim(), args.trim())
                .trim_end()
                .to_string(),
        );
    }
    if let Some(command) = between(trimmed, "<bash-input>", "</bash-input>") {
        return Some(format!("! {}", command.trim()));
    }
    Some(text.to_string())
}

fn is_wrapper(text: &str) -> bool {
    let trimmed = text.trim_start();
    WRAPPERS.iter().any(|tag| trimmed.starts_with(tag))
}

fn between<'a>(text: &'a str, open: &str, close: &str) -> Option<&'a str> {
    let start = text.find(open)? + open.len();
    let len = text[start..].find(close)?;
    Some(&text[start..start + len])
}

fn block_text(block: &Value) -> String {
    match block["type"].as_str() {
        Some("image") => IMAGE.to_string(),
        _ => block["text"].as_str().unwrap_or_default().to_string(),
    }
}

fn result_text(content: &Value) -> String {
    match content {
        Value::String(text) => text.clone(),
        Value::Array(blocks) => blocks
            .iter()
            .filter(|block| matches!(block["type"].as_str(), Some("text") | Some("image")))
            .map(block_text)
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn cap(mut text: String) -> String {
    if text.len() > RESULT_CAP {
        text.truncate(text.floor_char_boundary(RESULT_CAP));
        text.push('…');
    }
    text
}

fn workspace_relative(path: &str, cwd: &Path) -> String {
    match Path::new(path).strip_prefix(cwd) {
        Ok(relative) if !relative.as_os_str().is_empty() => relative.to_string_lossy().into_owned(),
        _ => path.to_string(),
    }
}

fn first_line(command: &str) -> String {
    let line = command.lines().next().unwrap_or_default();
    if line.chars().count() <= COMMAND_CAP {
        return line.to_string();
    }
    let mut cut: String = line.chars().take(COMMAND_CAP - 1).collect();
    cut.push('…');
    cut
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const CWD: &str = "/work/app";

    fn parse(record: Value) -> Parsed {
        parse_record(&record.to_string(), Path::new(CWD))
    }

    fn user(uuid: &str, content: Value) -> Value {
        json!({"type": "user", "uuid": uuid, "isSidechain": false,
               "message": {"role": "user", "content": content}})
    }

    fn assistant(uuid: &str, block: Value) -> Value {
        json!({"type": "assistant", "uuid": uuid, "isSidechain": false,
               "message": {"role": "assistant", "content": [block]}})
    }

    fn items(parsed: Parsed) -> Vec<ChatItem> {
        match parsed {
            Parsed::Items(items) => items,
            other => panic!("expected items, got {other:?}"),
        }
    }

    fn prompt(key: &str, text: &str) -> ChatItem {
        ChatItem::Prompt {
            key: key.into(),
            text: text.into(),
        }
    }

    fn result(key: &str, tool_id: &str, text: &str, is_error: bool) -> ChatItem {
        ChatItem::Result {
            key: key.into(),
            tool_id: tool_id.into(),
            text: text.into(),
            is_error,
        }
    }

    #[test]
    fn user_string_is_a_prompt() {
        assert_eq!(
            items(parse(user("u1", json!("sửa lỗi đăng nhập")))),
            vec![prompt("u1:0", "sửa lỗi đăng nhập")]
        );
    }

    #[test]
    fn user_text_blocks_are_joined_into_one_prompt() {
        let content = json!([{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]);
        assert_eq!(
            items(parse(user("u1", content))),
            vec![prompt("u1:0", "a\nb")]
        );
    }

    #[test]
    fn image_in_a_prompt_is_shown_as_text() {
        let content = json!([{"type": "text", "text": "xem"},
                             {"type": "image", "source": {"type": "base64", "data": "iVBO"}}]);
        assert_eq!(
            items(parse(user("u1", content))),
            vec![prompt("u1:0", "xem\n[ảnh]")]
        );
    }

    #[test]
    fn slash_command_becomes_its_command_line() {
        let text = "<command-message>x</command-message>\n<command-name>/x</command-name>\n<command-args>a</command-args>";
        assert_eq!(
            items(parse(user("u1", json!(text)))),
            vec![prompt("u1:0", "/x a")]
        );
    }

    #[test]
    fn slash_command_without_args() {
        let text = "<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>";
        assert_eq!(
            items(parse(user("u1", json!(text)))),
            vec![prompt("u1:0", "/clear")]
        );
    }

    #[test]
    fn bash_input_becomes_a_bang_prompt() {
        let text = "<bash-input> git status</bash-input>";
        assert_eq!(
            items(parse(user("u1", json!(text)))),
            vec![prompt("u1:0", "! git status")]
        );
    }

    #[test]
    fn claude_code_wrappers_are_ignored() {
        for text in [
            "<local-command-stdout>Catch you later!</local-command-stdout>",
            "<local-command-stderr>boom</local-command-stderr>",
            "<local-command-caveat>The command below was run directly</local-command-caveat>",
            "<system-reminder>\nnote\n</system-reminder>",
            "<bash-stdout>(Bash completed with no output)</bash-stdout><bash-stderr></bash-stderr>",
            "<bash-stderr>err</bash-stderr>",
            "<task-notification>\n<task-id>a6fd</task-id>\n<status>completed</status>\n</task-notification>",
        ] {
            assert_eq!(parse(user("u1", json!(text))), Parsed::Ignored, "{text}");
        }
    }

    #[test]
    fn wrapper_in_a_text_block_is_ignored() {
        let content = json!([{"type": "text", "text": "<system-reminder>x</system-reminder>"}]);
        assert_eq!(parse(user("u1", content)), Parsed::Ignored);
    }

    #[test]
    fn wrapper_block_before_the_prompt_is_dropped_alone() {
        let content = json!([
            {"type": "text", "text": "<system-reminder>\nnote\n</system-reminder>"},
            {"type": "text", "text": "viết test cho login"}]);
        assert_eq!(
            items(parse(user("u1", content))),
            vec![prompt("u1:1", "viết test cho login")]
        );
    }

    #[test]
    fn meta_and_sidechain_records_are_ignored() {
        let mut meta = user("u1", json!("Base directory for this skill"));
        meta["isMeta"] = json!(true);
        assert_eq!(parse(meta), Parsed::Ignored);

        let mut side = assistant("a1", json!({"type": "text", "text": "subagent reply"}));
        side["isSidechain"] = json!(true);
        assert_eq!(parse(side), Parsed::Ignored);
    }

    #[test]
    fn thinking_is_ignored() {
        let thinking = json!({"type": "thinking", "thinking": "", "signature": "CAQS"});
        assert_eq!(parse(assistant("a1", thinking)), Parsed::Ignored);
        let redacted = json!({"type": "redacted_thinking", "data": "x"});
        assert_eq!(parse(assistant("a1", redacted)), Parsed::Ignored);
    }

    #[test]
    fn assistant_text_is_a_reply() {
        let block = json!({"type": "text", "text": "Đã sửa lỗi token hết hạn."});
        assert_eq!(
            items(parse(assistant("a1", block))),
            vec![ChatItem::Reply {
                key: "a1:0".into(),
                text: "Đã sửa lỗi token hết hạn.".into()
            }]
        );
    }

    #[test]
    fn tool_use_is_a_tool_with_its_argument() {
        let block = json!({"type": "tool_use", "id": "toolu_01", "name": "Read",
                           "input": {"file_path": "/work/app/src/login.ts"},
                           "caller": {"type": "direct"}});
        assert_eq!(
            items(parse(assistant("a1", block))),
            vec![ChatItem::Tool {
                key: "a1:0".into(),
                id: "toolu_01".into(),
                name: "Read".into(),
                arg: Some("src/login.ts".into()),
            }]
        );
    }

    #[test]
    fn thinking_before_text_keeps_the_block_index() {
        let record = json!({"type": "assistant", "uuid": "a1", "message": {"content": [
            {"type": "thinking", "thinking": ""},
            {"type": "text", "text": "ok"}]}});
        assert_eq!(
            items(parse(record)),
            vec![ChatItem::Reply {
                key: "a1:1".into(),
                text: "ok".into()
            }]
        );
    }

    #[test]
    fn tool_result_with_string_content() {
        let content = json!([{"tool_use_id": "toolu_01", "type": "tool_result",
                              "content": "Already up to date.", "is_error": false}]);
        assert_eq!(
            items(parse(user("u2", content))),
            vec![result("u2:0", "toolu_01", "Already up to date.", false)]
        );
    }

    #[test]
    fn tool_result_with_text_and_image_blocks() {
        let content = json!([{"tool_use_id": "toolu_01", "type": "tool_result", "content": [
            {"type": "text", "text": "line 1"},
            {"type": "image", "source": {"type": "base64", "data": "iVBO"}},
            {"type": "text", "text": "line 2"}]}]);
        assert_eq!(
            items(parse(user("u2", content))),
            vec![result("u2:0", "toolu_01", "line 1\n[ảnh]\nline 2", false)]
        );
    }

    #[test]
    fn tool_result_error() {
        let content = json!([{"type": "tool_result", "tool_use_id": "toolu_01",
                              "content": "Exit code 1", "is_error": true}]);
        assert_eq!(
            items(parse(user("u2", content))),
            vec![result("u2:0", "toolu_01", "Exit code 1", true)]
        );
    }

    #[test]
    fn long_tool_result_is_capped() {
        let long = "é".repeat(5000);
        let content = json!([{"type": "tool_result", "tool_use_id": "toolu_01", "content": long}]);
        let parsed = items(parse(user("u2", content)));
        let [ChatItem::Result { text, .. }] = parsed.as_slice() else {
            panic!("expected one result");
        };
        assert!(text.ends_with('…'));
        let body = text.strip_suffix('…').unwrap();
        assert!(body.len() <= 8 * 1024);
        assert!(long.starts_with(body));
        assert!(body.len() > 8 * 1024 - 4);
    }

    #[test]
    fn result_at_the_cap_is_kept_whole() {
        let exact = "a".repeat(8 * 1024);
        let content = json!([{"type": "tool_result", "tool_use_id": "t", "content": exact}]);
        assert_eq!(
            items(parse(user("u2", content))),
            vec![result("u2:0", "t", &exact, false)]
        );
    }

    #[test]
    fn several_blocks_get_their_own_keys() {
        let content = json!([
            {"type": "tool_result", "tool_use_id": "t1", "content": "one"},
            {"type": "tool_result", "tool_use_id": "t2", "content": "two"}]);
        assert_eq!(
            items(parse(user("u3", content))),
            vec![
                result("u3:0", "t1", "one", false),
                result("u3:1", "t2", "two", false)
            ]
        );
    }

    #[test]
    fn other_record_types_are_ignored() {
        for kind in [
            "attachment",
            "system",
            "mode",
            "ai-title",
            "file-history-snapshot",
        ] {
            let record = json!({"type": kind, "uuid": "x", "content": 3});
            assert_eq!(parse(record), Parsed::Ignored, "{kind}");
        }
    }

    #[test]
    fn not_json_is_invalid() {
        assert_eq!(
            parse_record("{\"type\":\"user\",", Path::new(CWD)),
            Parsed::Invalid
        );
        assert_eq!(parse_record("", Path::new(CWD)), Parsed::Invalid);
    }

    #[test]
    fn unknown_content_shapes_are_unrecognized() {
        assert_eq!(parse(user("u1", json!(42))), Parsed::Unrecognized);
        assert_eq!(
            parse(json!({"type": "user", "uuid": "u1", "message": {}})),
            Parsed::Unrecognized
        );
        assert_eq!(
            parse(json!({"type": "assistant", "uuid": "a1"})),
            Parsed::Unrecognized
        );
        assert_eq!(parse(user("u1", json!(["text"]))), Parsed::Unrecognized);
        assert_eq!(
            parse(user("u1", json!([{"text": "no type"}]))),
            Parsed::Unrecognized
        );
    }

    #[test]
    fn items_serialize_with_kind_and_camel_case() {
        let item = result("u2:0", "toolu_01", "ok", true);
        assert_eq!(
            serde_json::to_value(item).unwrap(),
            json!({"kind": "result", "key": "u2:0", "toolId": "toolu_01", "text": "ok", "isError": true})
        );
        let tool = ChatItem::Tool {
            key: "a:0".into(),
            id: "t".into(),
            name: "Bash".into(),
            arg: None,
        };
        assert_eq!(
            serde_json::to_value(tool).unwrap(),
            json!({"kind": "tool", "key": "a:0", "id": "t", "name": "Bash", "arg": null})
        );
    }

    fn arg(name: &str, input: Value) -> Option<String> {
        tool_arg(name, &input, Path::new(CWD))
    }

    #[test]
    fn file_tools_show_the_path_relative_to_the_workspace() {
        for name in ["Read", "Edit", "MultiEdit", "Write"] {
            assert_eq!(
                arg(name, json!({"file_path": "/work/app/src/login.ts"})).as_deref(),
                Some("src/login.ts"),
                "{name}"
            );
        }
    }

    #[test]
    fn notebook_edit_shows_its_notebook_path() {
        assert_eq!(
            arg(
                "NotebookEdit",
                json!({"notebook_path": "/work/app/nb/a.ipynb", "new_source": "x"})
            )
            .as_deref(),
            Some("nb/a.ipynb")
        );
        assert_eq!(
            arg("NotebookEdit", json!({"notebook_path": "/tmp/b.ipynb"})).as_deref(),
            Some("/tmp/b.ipynb")
        );
    }

    #[test]
    fn file_outside_the_workspace_stays_absolute() {
        assert_eq!(
            arg("Read", json!({"file_path": "/etc/hosts"})).as_deref(),
            Some("/etc/hosts")
        );
        assert_eq!(
            arg("Read", json!({"file_path": "/work/application/x.ts"})).as_deref(),
            Some("/work/application/x.ts")
        );
    }

    #[test]
    fn bash_shows_the_first_line_capped() {
        assert_eq!(
            arg(
                "Bash",
                json!({"command": "npm test\necho done", "description": "Run tests"})
            )
            .as_deref(),
            Some("npm test")
        );
        let long = format!("echo {}", "x".repeat(200));
        let shown = arg("Bash", json!({"command": long})).unwrap();
        assert_eq!(shown.chars().count(), 120);
        assert!(shown.ends_with('…'));
        assert!(long.starts_with(shown.strip_suffix('…').unwrap()));
        let exact = "y".repeat(120);
        assert_eq!(
            arg("Bash", json!({"command": exact})).as_deref(),
            Some(exact.as_str())
        );
    }

    #[test]
    fn search_and_web_tools() {
        assert_eq!(
            arg("Grep", json!({"pattern": "fn main", "path": "src"})).as_deref(),
            Some("fn main")
        );
        assert_eq!(
            arg("Glob", json!({"pattern": "**/*.rs"})).as_deref(),
            Some("**/*.rs")
        );
        assert_eq!(
            arg(
                "WebFetch",
                json!({"url": "https://example.com", "prompt": "p"})
            )
            .as_deref(),
            Some("https://example.com")
        );
        assert_eq!(
            arg("WebSearch", json!({"query": "tauri 2"})).as_deref(),
            Some("tauri 2")
        );
    }

    #[test]
    fn agent_task_and_others_show_their_description() {
        for name in ["Agent", "Task", "SomethingNew"] {
            assert_eq!(
                arg(
                    name,
                    json!({"description": "Explore repo", "prompt": "long"})
                )
                .as_deref(),
                Some("Explore repo"),
                "{name}"
            );
        }
    }

    #[test]
    fn no_argument_when_nothing_fits() {
        assert_eq!(arg("TodoWrite", json!({"todos": []})), None);
        assert_eq!(arg("Read", json!({})), None);
        assert_eq!(arg("Bash", json!({"command": 3})), None);
        assert_eq!(arg("Skill", json!("not an object")), None);
    }
}

#[cfg(test)]
mod tail_tests {
    use super::*;
    use serde_json::json;
    use std::fs::{self, OpenOptions};
    use std::io::Write;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};
    use tempfile::TempDir;

    const CWD: &str = "/work/app";

    fn prompt_line(uuid: &str, text: &str) -> String {
        json!({"type": "user", "uuid": uuid, "message": {"role": "user", "content": text}})
            .to_string()
            + "\n"
    }

    fn unrecognized_line(uuid: &str) -> String {
        json!({"type": "assistant", "uuid": uuid, "message": {"content": 7}}).to_string() + "\n"
    }

    fn prompt(uuid: &str, text: &str) -> ChatItem {
        ChatItem::Prompt {
            key: format!("{uuid}:0"),
            text: text.into(),
        }
    }

    fn append(path: &Path, text: &str) {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .unwrap();
        file.write_all(text.as_bytes()).unwrap();
    }

    fn tail_at(dir: &TempDir, name: &str) -> (PathBuf, Tail) {
        let path = dir.path().join(name);
        (path.clone(), Tail::new(path, PathBuf::from(CWD)))
    }

    #[test]
    fn first_poll_resets_with_all_items_then_appends() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        append(&path, &(prompt_line("a", "một") + &prompt_line("b", "hai")));
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![
                prompt("a", "một"),
                prompt("b", "hai")
            ]))
        );
        assert_eq!(tail.poll(), None);
        append(&path, &prompt_line("c", "ba"));
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Append(vec![prompt("c", "ba")]))
        );
        assert_eq!(tail.poll(), None);
    }

    #[test]
    fn first_poll_resets_even_with_no_items() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        append(&path, &(json!({"type": "system"}).to_string() + "\n"));
        assert_eq!(tail.poll(), Some(TailUpdate::Reset(vec![])));
        assert_eq!(tail.poll(), None);
    }

    #[test]
    fn partial_last_line_waits_for_its_newline() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        let line = prompt_line("a", "một");
        let (head, rest) = line.split_at(10);
        append(&path, head);
        assert_eq!(tail.poll(), Some(TailUpdate::Reset(vec![])));
        assert_eq!(tail.poll(), None);
        append(&path, rest);
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Append(vec![prompt("a", "một")]))
        );
    }

    #[test]
    fn shorter_file_restarts_from_zero_with_a_reset() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        append(&path, &(prompt_line("a", "một") + &prompt_line("b", "hai")));
        tail.poll();
        fs::write(&path, prompt_line("c", "ba")).unwrap();
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![prompt("c", "ba")]))
        );
    }

    #[test]
    fn missing_file_resets_with_no_items_and_is_not_unreadable() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        assert_eq!(tail.poll(), Some(TailUpdate::Reset(vec![])));
        assert_eq!(tail.poll(), None);
        assert!(!path.exists(), "the tail must never create the file");
        append(&path, &prompt_line("a", "một"));
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Append(vec![prompt("a", "một")]))
        );
    }

    #[test]
    fn read_error_is_unreadable_once_then_reset_when_readable() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        fs::create_dir(&path).unwrap();
        assert_eq!(tail.poll(), Some(TailUpdate::Unreadable));
        assert_eq!(tail.poll(), None);
        fs::remove_dir(&path).unwrap();
        append(&path, &prompt_line("a", "một"));
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![prompt("a", "một")]))
        );
    }

    #[test]
    fn only_unrecognized_records_are_unreadable_once() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        append(
            &path,
            &(unrecognized_line("a") + &json!({"type": "system"}).to_string() + "\n"),
        );
        assert_eq!(tail.poll(), Some(TailUpdate::Unreadable));
        append(&path, &unrecognized_line("b"));
        assert_eq!(tail.poll(), None);
    }

    #[test]
    fn a_readable_record_after_unrecognized_ones_resets() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        append(&path, &unrecognized_line("a"));
        assert_eq!(tail.poll(), Some(TailUpdate::Unreadable));
        append(&path, &prompt_line("b", "hai"));
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![prompt("b", "hai")]))
        );
    }

    #[test]
    fn readable_after_unrecognized_following_a_reset_resets_again() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        assert_eq!(tail.poll(), Some(TailUpdate::Reset(vec![])));
        append(&path, &unrecognized_line("a"));
        assert_eq!(tail.poll(), Some(TailUpdate::Unreadable));
        append(&path, &prompt_line("b", "hai"));
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![prompt("b", "hai")]))
        );
    }

    #[test]
    fn ignored_user_records_count_as_readable() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        let meta = json!({"type": "user", "isMeta": true, "message": {"content": "x"}});
        append(&path, &(meta.to_string() + "\n" + &unrecognized_line("a")));
        assert_eq!(tail.poll(), Some(TailUpdate::Reset(vec![])));
    }

    #[test]
    fn one_invalid_line_among_good_ones_is_skipped() {
        let dir = TempDir::new().unwrap();
        let (path, mut tail) = tail_at(&dir, "s.jsonl");
        append(
            &path,
            &(prompt_line("a", "một") + "{not json\n" + &prompt_line("b", "hai")),
        );
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![
                prompt("a", "một"),
                prompt("b", "hai")
            ]))
        );
    }

    #[test]
    fn switch_restarts_on_the_new_file_and_never_reads_the_old_one() {
        let dir = TempDir::new().unwrap();
        let (old, mut tail) = tail_at(&dir, "old.jsonl");
        append(&old, &prompt_line("a", "cũ"));
        tail.poll();
        let new = dir.path().join("new.jsonl");
        append(&new, &prompt_line("b", "mới"));
        tail.switch(new.clone());
        assert_eq!(tail.path(), new.as_path());
        assert_eq!(
            tail.poll(),
            Some(TailUpdate::Reset(vec![prompt("b", "mới")]))
        );
        append(&old, &prompt_line("c", "cũ nữa"));
        assert_eq!(tail.poll(), None);
    }

    #[test]
    fn expected_path_encodes_the_cwd() {
        assert_eq!(
            expected_path(
                Path::new("/home/u/.claude/projects"),
                Path::new("/Users/me/my_app.v2"),
                "abc-123"
            ),
            PathBuf::from("/home/u/.claude/projects/-Users-me-my-app-v2/abc-123.jsonl")
        );
        assert_eq!(
            expected_path(Path::new("/p"), Path::new("/Users/me/dự án"), "s"),
            PathBuf::from("/p/-Users-me-d---n/s.jsonl")
        );
    }

    #[test]
    fn poll_thread_delivers_each_entry_within_a_second_and_stops() {
        let dir = TempDir::new().unwrap();
        let (path, tail) = tail_at(&dir, "s.jsonl");
        let (tx, rx) = mpsc::channel();
        let thread = TailThread::spawn(
            tail,
            POLL_INTERVAL,
            Box::new(move |update| {
                let _ = tx.send((Instant::now(), update));
            }),
        );
        let (_, first) = rx.recv_timeout(Duration::from_secs(1)).unwrap();
        assert_eq!(first, TailUpdate::Reset(vec![]));

        let mut written = Vec::new();
        for n in 0..20 {
            append(&path, &prompt_line(&format!("u{n}"), "x"));
            written.push(Instant::now());
            std::thread::sleep(Duration::from_millis(90));
        }
        let mut delivered = vec![None; 20];
        while delivered.iter().any(Option::is_none) {
            let (at, update) = rx.recv_timeout(Duration::from_secs(2)).unwrap();
            let TailUpdate::Append(items) = update else {
                panic!("expected append, got {update:?}");
            };
            for item in items {
                let ChatItem::Prompt { key, .. } = item else {
                    panic!("unexpected {item:?}")
                };
                let n: usize = key[1..key.len() - 2].parse().unwrap();
                delivered[n] = Some(at);
            }
        }
        for (n, at) in delivered.into_iter().enumerate() {
            let lag = at.unwrap() - written[n];
            assert!(lag <= Duration::from_secs(1), "entry {n} took {lag:?}");
        }

        let asked = Instant::now();
        thread.stop();
        assert!(
            asked.elapsed() < POLL_INTERVAL * 2,
            "stop took {:?}",
            asked.elapsed()
        );
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(1)),
            Err(mpsc::RecvTimeoutError::Disconnected),
            "the thread must exit and drop its sink"
        );
    }

    #[test]
    fn dropping_the_poll_thread_stops_it() {
        let dir = TempDir::new().unwrap();
        let (_, tail) = tail_at(&dir, "s.jsonl");
        let (tx, rx) = mpsc::channel();
        let thread = TailThread::spawn(
            tail,
            POLL_INTERVAL,
            Box::new(move |update| {
                let _ = tx.send(update);
            }),
        );
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        drop(thread);
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(1)),
            Err(mpsc::RecvTimeoutError::Disconnected)
        );
    }

    #[test]
    fn poll_thread_switch_resets_on_the_new_file() {
        let dir = TempDir::new().unwrap();
        let (_, tail) = tail_at(&dir, "old.jsonl");
        let new = dir.path().join("new.jsonl");
        append(&new, &prompt_line("b", "mới"));
        let (tx, rx) = mpsc::channel();
        let thread = TailThread::spawn(
            tail,
            POLL_INTERVAL,
            Box::new(move |update| {
                let _ = tx.send(update);
            }),
        );
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(1)).unwrap(),
            TailUpdate::Reset(vec![])
        );
        thread.switch(new);
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(1)).unwrap(),
            TailUpdate::Reset(vec![prompt("b", "mới")])
        );
    }
}
