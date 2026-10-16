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

/// One tool call: the agent that made it (`main` for the main agent), the tool and
/// its input as JSON. Without serde_json's `preserve_order` feature object keys are
/// sorted, so the same input gives the same text whatever order the hook sent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApprovalKey {
    pub agent: String,
    pub tool: String,
    pub input: String,
}

/// What a hook means for the pane. Only `Apply` goes to the state machine as is;
/// the tracker decides whether a `ToolDone` answers the pending approval (D3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HookSignal {
    Apply(Signal),
    ApprovalRequested {
        reason: String,
        key: Option<ApprovalKey>,
    },
    ToolDone(ApprovalKey),
}

pub fn signal_of(event: &serde_json::Value, workspace: &Path) -> Option<HookSignal> {
    let str_field = |key: &str| event.get(key).and_then(|v| v.as_str());
    let apply = |signal| Some(HookSignal::Apply(signal));
    match str_field("hook_event_name")? {
        "UserPromptSubmit" => apply(Signal::PromptSent),
        "PermissionRequest" => Some(HookSignal::ApprovalRequested {
            reason: permission_reason(event, workspace),
            key: Some(approval_key(event)),
        }),
        "Notification" => match str_field("notification_type")? {
            "permission_prompt" | "elicitation_dialog" => Some(HookSignal::ApprovalRequested {
                reason: cap(str_field("message")
                    .filter(|m| !m.trim().is_empty())
                    .unwrap_or("Waiting for you")),
                key: None,
            }),
            "idle_prompt" => apply(Signal::TurnFinished),
            _ => None,
        },
        "PreToolUse" if str_field("tool_name") == Some("AskUserQuestion") => {
            Some(HookSignal::ApprovalRequested {
                reason: "Question".into(),
                key: Some(approval_key(event)),
            })
        }
        "PostToolUse" | "PostToolUseFailure" => Some(HookSignal::ToolDone(approval_key(event))),
        "PermissionDenied" => apply(Signal::ApprovalAnswered),
        "Stop" => apply(Signal::TurnFinished),
        "StopFailure" => apply(Signal::ErrorOccurred(
            str_field("error").unwrap_or("unknown").into(),
        )),
        _ => None,
    }
}

fn approval_key(event: &serde_json::Value) -> ApprovalKey {
    let str_field = |key: &str| event.get(key).and_then(|v| v.as_str()).unwrap_or("");
    ApprovalKey {
        agent: event
            .get("agent_id")
            .and_then(|v| v.as_str())
            .unwrap_or("main")
            .to_string(),
        tool: str_field("tool_name").to_string(),
        input: event
            .get("tool_input")
            .unwrap_or(&serde_json::Value::Null)
            .to_string(),
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

    fn sig(v: serde_json::Value) -> Option<HookSignal> {
        signal_of(&v, ws())
    }

    fn apply(s: Signal) -> Option<HookSignal> {
        Some(HookSignal::Apply(s))
    }

    /// The reason of an approval request, whatever its key.
    fn approval_reason(v: serde_json::Value) -> Option<String> {
        match sig(v) {
            Some(HookSignal::ApprovalRequested { reason, .. }) => Some(reason),
            other => panic!("expected an approval request, got {other:?}"),
        }
    }

    fn keyless(s: &str) -> Option<HookSignal> {
        Some(HookSignal::ApprovalRequested {
            reason: s.into(),
            key: None,
        })
    }

    fn key(agent: &str, tool: &str, input: &str) -> ApprovalKey {
        ApprovalKey {
            agent: agent.into(),
            tool: tool.into(),
            input: input.into(),
        }
    }

    #[test]
    fn simple_events() {
        assert_eq!(
            sig(json!({"hook_event_name": "UserPromptSubmit"})),
            apply(Signal::PromptSent)
        );
        assert_eq!(
            sig(json!({"hook_event_name": "Stop"})),
            apply(Signal::TurnFinished)
        );
        assert_eq!(
            sig(json!({"hook_event_name": "PermissionDenied"})),
            apply(Signal::ApprovalAnswered)
        );
    }

    #[test]
    fn finished_tool_calls_carry_their_key() {
        for name in ["PostToolUse", "PostToolUseFailure"] {
            assert_eq!(
                sig(
                    json!({"hook_event_name": name, "agent_id": "a1", "tool_name": "Edit", "tool_input": {"file_path": "x"}})
                ),
                Some(HookSignal::ToolDone(key(
                    "a1",
                    "Edit",
                    r#"{"file_path":"x"}"#
                ))),
                "{name}"
            );
            assert_eq!(
                sig(json!({"hook_event_name": name})),
                Some(HookSignal::ToolDone(key("main", "", "null"))),
                "{name}"
            );
        }
    }

    #[test]
    fn approval_keys_match_whatever_the_field_order() {
        let request = sig(json!({
            "hook_event_name": "PermissionRequest",
            "tool_name": "Edit",
            "tool_input": {"file_path": "/work/proj/a.rs", "old_string": "x", "new_string": {"b": 1, "a": [2, 3]}}
        }));
        let done = sig(json!({
            "hook_event_name": "PostToolUse",
            "tool_input": {"new_string": {"a": [2, 3], "b": 1}, "old_string": "x", "file_path": "/work/proj/a.rs"},
            "tool_name": "Edit"
        }));
        let Some(HookSignal::ApprovalRequested { key: Some(k), .. }) = request else {
            panic!("expected a keyed request, got {request:?}");
        };
        assert_eq!(k.agent, "main");
        assert_eq!(done, Some(HookSignal::ToolDone(k)));
    }

    #[test]
    fn pre_tool_use() {
        assert_eq!(
            sig(
                json!({"hook_event_name": "PreToolUse", "tool_name": "AskUserQuestion", "agent_id": "a1", "tool_input": {"questions": []}})
            ),
            Some(HookSignal::ApprovalRequested {
                reason: "Question".into(),
                key: Some(key("a1", "AskUserQuestion", r#"{"questions":[]}"#)),
            })
        );
        assert_eq!(
            sig(json!({"hook_event_name": "PreToolUse", "tool_name": "Bash"})),
            None
        );
    }

    #[test]
    fn stop_failure() {
        assert_eq!(
            sig(json!({"hook_event_name": "StopFailure", "error": "overloaded"})),
            apply(Signal::ErrorOccurred("overloaded".into()))
        );
        assert_eq!(
            sig(json!({"hook_event_name": "StopFailure"})),
            apply(Signal::ErrorOccurred("unknown".into()))
        );
    }

    #[test]
    fn permission_request_reasons() {
        let req = |tool: &str, input: serde_json::Value| {
            approval_reason(
                json!({"hook_event_name": "PermissionRequest", "tool_name": tool, "tool_input": input}),
            )
        };
        let r = |s: &str| Some(s.to_string());
        assert_eq!(
            req("Edit", json!({"file_path": "/work/proj/src/main.rs"})),
            r("Edit src/main.rs")
        );
        assert_eq!(
            req("Read", json!({"file_path": "/etc/hosts"})),
            r("Read /etc/hosts")
        );
        assert_eq!(
            req("NotebookEdit", json!({"notebook_path": "a.ipynb"})),
            r("NotebookEdit a.ipynb")
        );
        assert_eq!(
            req("Bash", json!({"command": "npm test\nnpm run lint"})),
            r("Bash npm test")
        );
        assert_eq!(
            req("WebFetch", json!({"url": "https://x.dev"})),
            r("WebFetch https://x.dev")
        );
        assert_eq!(req("Grep", json!({"pattern": "foo"})), r("Grep foo"));
        assert_eq!(
            req("WebSearch", json!({"query": "rust"})),
            r("WebSearch rust")
        );
        assert_eq!(
            req("Edit", json!({"command": "c", "file_path": "/work/proj/a"})),
            r("Edit a")
        );
        assert_eq!(req("Task", json!({})), r("Task"));
        assert_eq!(
            sig(
                json!({"hook_event_name": "PermissionRequest", "tool_name": "Task", "agent_id": "a2"})
            ),
            Some(HookSignal::ApprovalRequested {
                reason: "Task".into(),
                key: Some(key("a2", "Task", "null")),
            })
        );
    }

    #[test]
    fn long_reasons_are_capped_by_chars() {
        let command = "chạy kiểm thử toàn bộ dự án và báo cáo kết quả chi tiết ".repeat(4);
        assert!(command.chars().count() >= 200);
        let r = approval_reason(
            json!({"hook_event_name": "PermissionRequest", "tool_name": "Bash", "tool_input": {"command": command}}),
        )
        .unwrap();
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
            keyless(&message)
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
            keyless("Claude needs your permission")
        );
        assert_eq!(
            n("elicitation_dialog"),
            keyless("Claude needs your permission")
        );
        assert_eq!(n("idle_prompt"), apply(Signal::TurnFinished));
        assert_eq!(n("auth_success"), None);
        assert_eq!(
            sig(
                json!({"hook_event_name": "Notification", "notification_type": "permission_prompt"})
            ),
            keyless("Waiting for you")
        );
        for blank in ["", "   \n"] {
            assert_eq!(
                sig(
                    json!({"hook_event_name": "Notification", "notification_type": "permission_prompt", "message": blank})
                ),
                keyless("Waiting for you")
            );
        }
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
