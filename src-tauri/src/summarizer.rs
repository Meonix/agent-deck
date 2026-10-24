//! The Claude Code run that turns condensed session history into a proposed checkpoint list.

use std::fmt;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::Value;

use crate::session_progress::Checkpoint;

const DEADLINE: Duration = Duration::from_secs(25);

const SCHEMA: &str = r#"{"type":"object","properties":{"checkpoints":{"type":"array","items":{"type":"object","properties":{"summary":{"type":"string"},"result":{"type":"string"},"done":{"type":"boolean"},"started_at":{"type":"string"}},"required":["summary","result","done","started_at"],"additionalProperties":false}}},"required":["checkpoints"],"additionalProperties":false}"#;

#[derive(Debug, PartialEq, Eq)]
pub enum SummaryError {
    Spawn(String),
    Timeout,
    Exit(Option<i32>),
    Output(String),
}

impl fmt::Display for SummaryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SummaryError::Spawn(e) => write!(f, "could not start claude: {e}"),
            SummaryError::Timeout => write!(f, "claude did not answer within 25 s"),
            SummaryError::Exit(Some(code)) => write!(f, "claude exited with code {code}"),
            SummaryError::Exit(None) => write!(f, "claude was stopped by a signal"),
            SummaryError::Output(e) => write!(f, "unusable claude output: {e}"),
        }
    }
}

/// Returns the proposed full list; the caller merges it into its own.
pub trait Summarizer: Send + Sync {
    fn summarize(&self, prompt: &str) -> Result<Vec<Checkpoint>, SummaryError>;
}

pub struct ClaudeSummarizer {
    pub program: PathBuf,
    pub env: Vec<(String, String)>,
    pub cwd: PathBuf,
}

impl ClaudeSummarizer {
    pub fn args(&self) -> Vec<String> {
        [
            "-p",
            "--model",
            "haiku",
            "--safe-mode",
            "--no-session-persistence",
            "--tools",
            "",
            "--output-format",
            "json",
            "--json-schema",
            SCHEMA,
            "--max-budget-usd",
            "0.05",
        ]
        .map(String::from)
        .to_vec()
    }
}

impl Summarizer for ClaudeSummarizer {
    fn summarize(&self, prompt: &str) -> Result<Vec<Checkpoint>, SummaryError> {
        let mut child = Command::new(&self.program)
            .args(self.args())
            .env_clear()
            .envs(self.env.iter().map(|(k, v)| (k, v)))
            .current_dir(&self.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| SummaryError::Spawn(e.to_string()))?;

        // Threads, so a full pipe can never stall the deadline below.
        let mut stdin = child.stdin.take().expect("piped stdin");
        let prompt = prompt.to_owned();
        std::thread::spawn(move || {
            let _ = stdin.write_all(prompt.as_bytes());
        });
        let stdout = drain(child.stdout.take().expect("piped stdout"));
        let stderr = drain(child.stderr.take().expect("piped stderr"));

        let start = Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) if start.elapsed() >= DEADLINE => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(SummaryError::Timeout);
                }
                Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                Err(e) => return Err(SummaryError::Spawn(e.to_string())),
            }
        };
        let stdout = stdout.join().unwrap_or_default();
        let stderr = stderr.join().unwrap_or_default();
        if !status.success() {
            crate::diag::error("summarizer", &format!("claude stderr: {}", stderr.trim()));
            return Err(SummaryError::Exit(status.code()));
        }
        parse_output(&stdout)
    }
}

fn drain<R: Read + Send + 'static>(mut pipe: R) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = pipe.read_to_end(&mut buf);
        String::from_utf8_lossy(&buf).into_owned()
    })
}

#[derive(Deserialize)]
struct Proposed {
    checkpoints: Vec<ProposedCheckpoint>,
}

/// The model-facing shape: `started_at` is snake_case there, unlike the pane wire format.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProposedCheckpoint {
    summary: String,
    result: String,
    done: bool,
    started_at: String,
}

pub fn parse_output(stdout: &str) -> Result<Vec<Checkpoint>, SummaryError> {
    let bad = |what: &str| SummaryError::Output(what.to_owned());
    let envelope: Value =
        serde_json::from_str(stdout.trim()).map_err(|e| SummaryError::Output(e.to_string()))?;
    if envelope["is_error"].as_bool().unwrap_or(false) {
        return Err(bad("claude reported an error"));
    }
    let answer = match envelope.get("structured_output").filter(|v| v.is_object()) {
        Some(v) => v.clone(),
        None => {
            let text = envelope["result"]
                .as_str()
                .ok_or_else(|| bad("no result in output"))?;
            serde_json::from_str(strip_fence(text))
                .map_err(|e| SummaryError::Output(format!("result is not JSON: {e}")))?
        }
    };
    let proposed: Proposed = serde_json::from_value(answer)
        .map_err(|e| SummaryError::Output(format!("schema mismatch: {e}")))?;
    Ok(proposed
        .checkpoints
        .into_iter()
        .map(|c| Checkpoint {
            summary: c.summary,
            result: c.result,
            done: c.done,
            started_at: c.started_at,
        })
        .collect())
}

fn strip_fence(text: &str) -> &str {
    let text = text.trim();
    text.strip_prefix("```json")
        .or_else(|| text.strip_prefix("```"))
        .and_then(|rest| rest.trim_end().strip_suffix("```"))
        .unwrap_or(text)
        .trim()
}

pub fn prompt(goal: Option<&str>, current: &[Checkpoint], chunk: &str) -> String {
    let list: Vec<Value> = current
        .iter()
        .map(|c| {
            serde_json::json!({
                "summary": c.summary,
                "result": c.result,
                "done": c.done,
                "started_at": c.started_at,
            })
        })
        .collect();
    let list = serde_json::to_string(&serde_json::json!({ "checkpoints": list }))
        .unwrap_or_else(|_| "{\"checkpoints\":[]}".into());
    format!(
        "You keep a short progress list for a coding session. Read the new session text below and \
return the updated checkpoint list.\n\n\
Session Goal: {goal}\n\n\
Current checkpoint list:\n{list}\n\n\
Rules:\n\
- A checkpoint is one major piece of work serving the goal. Small steps for the work in progress \
(reading files, running commands or tests, fixing small mistakes of that same work) belong to the \
checkpoint in progress. Work clearly different from the work in progress is a new checkpoint.\n\
- Mark a checkpoint done only when the text shows its work finished: the assistant said it is \
done, it was committed, or its checks passed. Moving to other work without such a sign leaves it \
not done.\n\
- Return the full list: every current checkpoint first, in the same order, then any new ones. \
Never mark a done checkpoint as not done.\n\
- Write summary and result in the language the user writes in. summary at most 80 characters, \
result at most 60 (may be empty).\n\
- started_at must be one of the [HH:MM] times in the text.\n\n\
New session text:\n=====\n{chunk}",
        goal = goal.unwrap_or("(none)"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cp(summary: &str, done: bool, at: &str) -> Checkpoint {
        Checkpoint {
            summary: summary.into(),
            result: String::new(),
            done,
            started_at: at.into(),
        }
    }

    fn summarizer() -> ClaudeSummarizer {
        ClaudeSummarizer {
            program: PathBuf::from("claude"),
            env: vec![],
            cwd: PathBuf::from("."),
        }
    }

    #[test]
    fn args_are_the_fixed_headless_set() {
        let args = summarizer().args();
        assert_eq!(args.len(), 13);
        let fixed = [
            "-p",
            "--model",
            "haiku",
            "--safe-mode",
            "--no-session-persistence",
            "--tools",
            "",
            "--output-format",
            "json",
            "--json-schema",
        ];
        assert_eq!(&args[..10], &fixed);
        assert_eq!(args[10], SCHEMA);
        assert_eq!(&args[11..], &["--max-budget-usd", "0.05"]);
    }

    #[test]
    fn schema_is_valid_json_and_closed() {
        let v: Value = serde_json::from_str(SCHEMA).unwrap();
        assert_eq!(v["additionalProperties"], false);
        assert_eq!(v["required"][0], "checkpoints");
        let item = &v["properties"]["checkpoints"]["items"];
        assert_eq!(item["additionalProperties"], false);
        assert_eq!(item["required"].as_array().unwrap().len(), 4);
    }

    #[test]
    fn parses_structured_output_first() {
        let out = r#"{"type":"result","is_error":false,"result":"ignored","structured_output":{"checkpoints":[{"summary":"A","result":"r","done":true,"started_at":"09:05"}]}}"#;
        let list = parse_output(out).unwrap();
        assert_eq!(
            list,
            vec![Checkpoint {
                summary: "A".into(),
                result: "r".into(),
                done: true,
                started_at: "09:05".into()
            }]
        );
    }

    #[test]
    fn parses_result_text_and_fenced_json() {
        let body =
            r#"{"checkpoints":[{"summary":"B","result":"","done":false,"started_at":"10:00"}]}"#;
        let plain = serde_json::json!({"is_error": false, "result": body}).to_string();
        assert_eq!(parse_output(&plain).unwrap()[0].summary, "B");
        let fenced =
            serde_json::json!({"is_error": false, "result": format!("```json\n{body}\n```")})
                .to_string();
        assert_eq!(parse_output(&fenced).unwrap()[0].started_at, "10:00");
    }

    #[test]
    fn rejects_errors_and_bad_shapes() {
        let is_err = r#"{"is_error":true,"result":"boom"}"#;
        assert!(matches!(parse_output(is_err), Err(SummaryError::Output(_))));
        assert!(matches!(
            parse_output("not json"),
            Err(SummaryError::Output(_))
        ));
        assert!(matches!(
            parse_output(r#"{"is_error":false}"#),
            Err(SummaryError::Output(_))
        ));
        let not_json = r#"{"is_error":false,"result":"hello"}"#;
        assert!(matches!(
            parse_output(not_json),
            Err(SummaryError::Output(_))
        ));
        let missing = r#"{"is_error":false,"structured_output":{"checkpoints":[{"summary":"x"}]}}"#;
        assert!(matches!(
            parse_output(missing),
            Err(SummaryError::Output(_))
        ));
    }

    #[test]
    fn prompt_holds_goal_list_rules_and_chunk() {
        let p = prompt(
            Some("Ship login"),
            &[cp("Wrote tests", true, "09:00")],
            "[09:10] user: hi",
        );
        assert!(p.contains("Ship login"));
        assert!(p.contains(r#""started_at":"09:00""#));
        assert!(p.contains("A checkpoint is one major piece of work serving the goal."));
        assert!(p.contains("Mark a checkpoint done only when the text shows its work finished"));
        assert!(p.contains("at most 80 characters"));
        assert!(p.trim_end().ends_with("[09:10] user: hi"));
        assert!(prompt(None, &[], "x").contains("(none)"));
    }

    #[cfg(unix)]
    fn script(dir: &std::path::Path, body: &str) -> ClaudeSummarizer {
        use std::os::unix::fs::PermissionsExt;
        let path = dir.join("fake-claude");
        std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        ClaudeSummarizer {
            program: path,
            env: vec![("PATH".into(), "/usr/bin:/bin".into())],
            cwd: dir.to_path_buf(),
        }
    }

    #[cfg(unix)]
    #[test]
    fn spawn_feeds_stdin_and_parses_stdout() {
        let dir = tempfile::tempdir().unwrap();
        let s = script(
            dir.path(),
            r#"cat >/dev/null; echo '{"is_error":false,"structured_output":{"checkpoints":[{"summary":"S","result":"","done":false,"started_at":"08:00"}]}}'"#,
        );
        assert_eq!(s.summarize("p").unwrap()[0].summary, "S");
    }

    #[cfg(unix)]
    #[test]
    fn spawn_maps_exit_and_missing_program() {
        let dir = tempfile::tempdir().unwrap();
        let s = script(dir.path(), "cat >/dev/null; exit 3");
        assert_eq!(s.summarize("p"), Err(SummaryError::Exit(Some(3))));
        let missing = ClaudeSummarizer {
            program: dir.path().join("nope"),
            env: vec![],
            cwd: dir.path().to_path_buf(),
        };
        assert!(matches!(
            missing.summarize("p"),
            Err(SummaryError::Spawn(_))
        ));
    }

    #[test]
    #[ignore = "runs the real claude and costs a fraction of a cent"]
    fn real_claude_returns_checkpoints() {
        let launch = crate::pane_commands::LaunchLookup::start();
        let launch = launch.get();
        let program = launch.claude.clone().expect("claude not found");
        let base: Vec<(String, String)> = std::env::vars().collect();
        let dir = tempfile::tempdir().unwrap();
        let s = ClaudeSummarizer {
            program,
            env: crate::launcher::session_env(&base, &launch.path),
            cwd: dir.path().to_path_buf(),
        };
        let chunk = "[09:00] user: Hãy thêm nút đăng xuất vào trang chính\n\
                     [09:01] assistant: Tôi sẽ thêm nút đăng xuất.\n\
                     [09:02] tool: Edit — src/Header.tsx\n\
                     [09:04] assistant: Xong, đã thêm nút đăng xuất và test đều qua.";
        let mut child = Command::new(&s.program)
            .args(s.args())
            .env_clear()
            .envs(s.env.iter().map(|(k, v)| (k, v)))
            .current_dir(&s.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let text = prompt(Some("Đăng xuất"), &[], chunk);
        child
            .stdin
            .take()
            .unwrap()
            .write_all(text.as_bytes())
            .unwrap();
        let out = child.wait_with_output().unwrap();
        let raw = String::from_utf8_lossy(&out.stdout);
        let envelope: Value = serde_json::from_str(&raw).unwrap();
        println!(
            "keys: {:?}",
            envelope.as_object().unwrap().keys().collect::<Vec<_>>()
        );
        println!("result: {}", envelope["result"]);
        println!("structured_output: {}", envelope["structured_output"]);
        let list = parse_output(&raw).unwrap();
        println!("{list:?}");
        assert!(!list.is_empty());
    }
}
