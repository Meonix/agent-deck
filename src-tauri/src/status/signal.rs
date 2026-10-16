use std::path::Path;

use super::machine::Signal;

const MAX_REASON_CHARS: usize = 60;
const TARGET_KEYS: [&str; 6] = [
    "file_path",
    "notebook_path",
    "command",
    "url",
    "pattern",
    "query",
];

pub fn signal_of(event: &serde_json::Value, workspace: &Path) -> Option<Signal> {
    let str_field = |key: &str| event.get(key).and_then(|v| v.as_str());
    match str_field("hook_event_name")? {
        "UserPromptSubmit" => Some(Signal::PromptSent),
        "PermissionRequest" => Some(Signal::ApprovalRequested(permission_reason(
            event, workspace,
        ))),
        "Notification" => match str_field("notification_type")? {
            "permission_prompt" | "elicitation_dialog" => Some(Signal::ApprovalRequested(cap(
                str_field("message").unwrap_or("Waiting for you"),
            ))),
            _ => None,
        },
        "PreToolUse" if str_field("tool_name") == Some("AskUserQuestion") => {
            Some(Signal::ApprovalRequested("Question".into()))
        }
        "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PermissionDenied" => {
            Some(Signal::ApprovalAnswered)
        }
        "Stop" => Some(Signal::TurnFinished),
        "StopFailure" => Some(Signal::ErrorOccurred(
            str_field("error").unwrap_or("unknown").into(),
        )),
        _ => None,
    }
}

fn permission_reason(event: &serde_json::Value, workspace: &Path) -> String {
    let tool = event
        .get("tool_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Tool");
    let target = event.get("tool_input").and_then(|input| {
        TARGET_KEYS.iter().find_map(|key| {
            let text = input.get(*key)?.as_str()?;
            Some(match *key {
                "file_path" => relative_to(text, workspace),
                "command" => text.lines().next().unwrap_or("").to_string(),
                _ => text.to_string(),
            })
        })
    });
    match target {
        Some(t) if !t.is_empty() => cap(&format!("{tool} {t}")),
        _ => cap(tool),
    }
}

fn relative_to(path: &str, workspace: &Path) -> String {
    match Path::new(path).strip_prefix(workspace) {
        Ok(rel) => rel.to_string_lossy().into_owned(),
        Err(_) => path.to_string(),
    }
}

fn cap(text: &str) -> String {
    if text.chars().count() <= MAX_REASON_CHARS {
        return text.to_string();
    }
    let mut out: String = text.chars().take(MAX_REASON_CHARS - 1).collect();
    out.push('…');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ws() -> &'static Path {
        Path::new("/work/proj")
    }

    fn sig(v: serde_json::Value) -> Option<Signal> {
        signal_of(&v, ws())
    }

    fn approval(s: &str) -> Option<Signal> {
        Some(Signal::ApprovalRequested(s.into()))
    }

    #[test]
    fn simple_events() {
        assert_eq!(
            sig(json!({"hook_event_name": "UserPromptSubmit"})),
            Some(Signal::PromptSent)
        );
        assert_eq!(
            sig(json!({"hook_event_name": "Stop"})),
            Some(Signal::TurnFinished)
        );
        for name in ["PostToolUse", "PostToolUseFailure", "PermissionDenied"] {
            assert_eq!(
                sig(json!({"hook_event_name": name})),
                Some(Signal::ApprovalAnswered),
                "{name}"
            );
        }
    }

    #[test]
    fn pre_tool_use() {
        assert_eq!(
            sig(json!({"hook_event_name": "PreToolUse", "tool_name": "AskUserQuestion"})),
            approval("Question")
        );
        assert_eq!(
            sig(json!({"hook_event_name": "PreToolUse", "tool_name": "Bash"})),
            Some(Signal::ApprovalAnswered)
        );
    }

    #[test]
    fn stop_failure() {
        assert_eq!(
            sig(json!({"hook_event_name": "StopFailure", "error": "overloaded"})),
            Some(Signal::ErrorOccurred("overloaded".into()))
        );
        assert_eq!(
            sig(json!({"hook_event_name": "StopFailure"})),
            Some(Signal::ErrorOccurred("unknown".into()))
        );
    }

    #[test]
    fn permission_request_reasons() {
        let req = |tool: &str, input: serde_json::Value| {
            sig(
                json!({"hook_event_name": "PermissionRequest", "tool_name": tool, "tool_input": input}),
            )
        };
        assert_eq!(
            req("Edit", json!({"file_path": "/work/proj/src/main.rs"})),
            approval("Edit src/main.rs")
        );
        assert_eq!(
            req("Read", json!({"file_path": "/etc/hosts"})),
            approval("Read /etc/hosts")
        );
        assert_eq!(
            req("NotebookEdit", json!({"notebook_path": "a.ipynb"})),
            approval("NotebookEdit a.ipynb")
        );
        assert_eq!(
            req("Bash", json!({"command": "npm test\nnpm run lint"})),
            approval("Bash npm test")
        );
        assert_eq!(
            req("WebFetch", json!({"url": "https://x.dev"})),
            approval("WebFetch https://x.dev")
        );
        assert_eq!(req("Grep", json!({"pattern": "foo"})), approval("Grep foo"));
        assert_eq!(
            req("WebSearch", json!({"query": "rust"})),
            approval("WebSearch rust")
        );
        assert_eq!(
            req("Edit", json!({"command": "c", "file_path": "/work/proj/a"})),
            approval("Edit a")
        );
        assert_eq!(req("Task", json!({})), approval("Task"));
        assert_eq!(
            sig(json!({"hook_event_name": "PermissionRequest", "tool_name": "Task"})),
            approval("Task")
        );
    }

    #[test]
    fn long_reasons_are_capped_by_chars() {
        let command = "chạy kiểm thử toàn bộ dự án và báo cáo kết quả chi tiết ".repeat(4);
        assert!(command.chars().count() >= 200);
        let Some(Signal::ApprovalRequested(r)) = sig(
            json!({"hook_event_name": "PermissionRequest", "tool_name": "Bash", "tool_input": {"command": command}}),
        ) else {
            panic!("expected approval");
        };
        assert_eq!(r.chars().count(), 60);
        assert!(r.ends_with('…'));
        assert!(r.starts_with("Bash chạy kiểm thử"));
    }

    #[test]
    fn exactly_sixty_chars_is_not_cut() {
        let message = "a".repeat(60);
        assert_eq!(
            sig(
                json!({"hook_event_name": "Notification", "notification_type": "permission_prompt", "message": message.clone()})
            ),
            approval(&message)
        );
    }

    #[test]
    fn notifications() {
        let n = |t: &str| {
            sig(
                json!({"hook_event_name": "Notification", "notification_type": t, "message": "Claude needs your permission"}),
            )
        };
        assert_eq!(
            n("permission_prompt"),
            approval("Claude needs your permission")
        );
        assert_eq!(
            n("elicitation_dialog"),
            approval("Claude needs your permission")
        );
        assert_eq!(n("idle_prompt"), None);
        assert_eq!(
            sig(
                json!({"hook_event_name": "Notification", "notification_type": "permission_prompt"})
            ),
            approval("Waiting for you")
        );
        assert_eq!(sig(json!({"hook_event_name": "Notification"})), None);
    }

    #[test]
    fn ignored_and_garbage_input() {
        assert_eq!(sig(json!({"hook_event_name": "SessionStart"})), None);
        assert_eq!(sig(json!({"hook_event_name": "SessionEnd"})), None);
        assert_eq!(sig(json!({"hook_event_name": 5})), None);
        assert_eq!(sig(json!({})), None);
        assert_eq!(sig(json!([])), None);
        assert_eq!(sig(json!("Stop")), None);
    }
}
