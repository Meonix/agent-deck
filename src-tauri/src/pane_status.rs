use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;

use crate::hooks::HookSink;
use crate::status::{
    ApprovalKey, HookSignal, Signal, State, StatusChange, StatusMachine, signal_of,
};

/// The pane's message stream: status changes and, last, `{"exited": code}`.
pub trait StatusOut: Send + Sync {
    fn send_json(&self, json: String);
}

/// One pane's state machine, fed by its hook events and its process exit.
///
/// It is the pane's single ordered writer: every message is sent while its own
/// (leaf) lock is held, so a status can never overtake or follow the exit.
pub struct StatusTracker {
    inner: Mutex<Tracked>,
    workspace: PathBuf,
    out: Box<dyn StatusOut>,
}

struct Tracked {
    machine: StatusMachine,
    /// A hook request or the exit has reached this pane (D5).
    tracked: bool,
    /// `{"exited"}` has been sent; later hooks are dropped.
    finished: bool,
    /// The user closed the pane: hooks are dropped and the exit sends no status (D4).
    closed: bool,
    /// The tool call the current `Needs Approval` waits for, when its hook named one.
    pending: Option<ApprovalKey>,
}

impl Tracked {
    fn silent(&self) -> bool {
        self.finished || self.closed
    }

    fn apply(&mut self, signal: HookSignal, now: u64) -> bool {
        let (signal, key) = match signal {
            HookSignal::Apply(signal) => (signal, None),
            HookSignal::ApprovalRequested { reason, key } => {
                (Signal::ApprovalRequested(reason), key)
            }
            HookSignal::ToolDone(key) if self.pending.as_ref() == Some(&key) => {
                (Signal::ApprovalAnswered, None)
            }
            HookSignal::ToolDone(_) => return false,
        };
        let changed = self.machine.apply(signal, now).is_some();
        if self.machine.state() != State::NeedsApproval {
            self.pending = None;
        } else if self.pending.is_none() {
            self.pending = key;
        }
        changed
    }
}

impl StatusTracker {
    pub fn new(workspace: PathBuf, out: Box<dyn StatusOut>, now: u64) -> Self {
        StatusTracker {
            inner: Mutex::new(Tracked {
                machine: StatusMachine::new(now),
                tracked: false,
                finished: false,
                closed: false,
                pending: None,
            }),
            workspace,
            out,
        }
    }

    /// Sends the final status, if the exit changes it, then `{"exited": code}`.
    pub fn exited(&self, code: Option<i32>, now: u64) {
        let mut inner = self.inner.lock().unwrap();
        if inner.finished {
            return;
        }
        inner.finished = true;
        if !inner.closed {
            inner.tracked = true;
            if let Some(change) = inner.machine.exit(code, now) {
                self.out.send_json(status_json(&change, true));
            }
        }
        self.out.send_json(exit_json(code));
    }

    /// Input written to the pane. While it waits for approval, an answer key ends
    /// the wait, because no hook fires when the user answers a dialog (D3 c).
    pub fn user_input(&self, data: &[u8], now: u64) {
        let mut inner = self.inner.lock().unwrap();
        if inner.silent() || inner.machine.state() != State::NeedsApproval || !is_answer_key(data) {
            return;
        }
        if inner.apply(HookSignal::Apply(Signal::ApprovalAnswered), now) {
            let tracked = inner.tracked;
            self.out
                .send_json(status_json(&inner.machine.current(), tracked));
        }
    }

    pub fn close_by_user(&self) {
        self.inner.lock().unwrap().closed = true;
    }
}

/// D3 (c): Enter, a lone Esc, Shift+Tab ("allow all edits") or a menu digit. Focus,
/// cursor and device reports, mouse reports and arrows are other ESC sequences.
fn is_answer_key(data: &[u8]) -> bool {
    data.iter().any(|b| matches!(b, b'\r' | b'\n'))
        || data == b"\x1b"
        || data == b"\x1b[Z"
        || matches!(data, [d] if d.is_ascii_digit())
}

impl HookSink for StatusTracker {
    fn hook(&self, event: Value) {
        let signal = signal_of(&event, &self.workspace);
        let mut inner = self.inner.lock().unwrap();
        if inner.silent() {
            return;
        }
        let first = !inner.tracked;
        inner.tracked = true;
        let changed = signal.is_some_and(|s| inner.apply(s, now_ms()));
        if changed || first {
            self.out
                .send_json(status_json(&inner.machine.current(), true));
        }
    }
}

#[derive(Serialize)]
struct StatusMessage<'a> {
    status: StatusBody<'a>,
}

#[derive(Serialize)]
struct StatusBody<'a> {
    #[serde(flatten)]
    change: &'a StatusChange,
    tracked: bool,
}

fn status_json(change: &StatusChange, tracked: bool) -> String {
    let message = StatusMessage {
        status: StatusBody { change, tracked },
    };
    serde_json::to_string(&message).expect("status serializes")
}

pub fn exit_json(code: Option<i32>) -> String {
    serde_json::json!({ "exited": code }).to_string()
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    #[derive(Clone, Default)]
    struct Outbox(Arc<Mutex<Vec<String>>>);

    impl StatusOut for Outbox {
        fn send_json(&self, json: String) {
            self.0.lock().unwrap().push(json);
        }
    }

    impl Outbox {
        fn take(&self) -> Vec<Value> {
            self.0
                .lock()
                .unwrap()
                .drain(..)
                .map(|s| serde_json::from_str(&s).unwrap())
                .collect()
        }
    }

    fn tracker(now: u64) -> (StatusTracker, Outbox) {
        let out = Outbox::default();
        (
            StatusTracker::new("/work/proj".into(), Box::new(out.clone()), now),
            out,
        )
    }

    #[test]
    fn message_has_the_exact_shape() {
        let change = StatusChange {
            state: crate::status::State::NeedsApproval,
            since: 1760000000000,
            reason: Some("Edit src/main.rs".into()),
        };
        assert_eq!(
            status_json(&change, true),
            r#"{"status":{"state":"Needs Approval","since":1760000000000,"reason":"Edit src/main.rs","tracked":true}}"#
        );
        let change = StatusChange {
            state: crate::status::State::Idle,
            since: 5,
            reason: None,
        };
        assert_eq!(
            status_json(&change, false),
            r#"{"status":{"state":"Idle","since":5,"reason":null,"tracked":false}}"#
        );
    }

    #[test]
    fn first_hook_marks_the_pane_tracked_even_without_a_change() {
        let (t, out) = tracker(1000);
        t.hook(json!({"hook_event_name": "SessionStart", "session_id": "s"}));
        assert_eq!(
            out.take(),
            [json!({"status": {"state": "Idle", "since": 1000, "reason": null, "tracked": true}})]
        );

        t.hook(json!({"hook_event_name": "SessionStart"}));
        assert_eq!(out.take(), Vec::<Value>::new());
    }

    #[test]
    fn changes_are_sent_and_keep_signals_are_not() {
        let (t, out) = tracker(1000);
        let before = now_ms();
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        let sent = out.take();
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0]["status"]["state"], "Running");
        assert!(sent[0]["status"]["since"].as_u64().unwrap() >= before);

        t.hook(json!({
            "hook_event_name": "PermissionRequest",
            "tool_name": "Edit",
            "tool_input": {"file_path": "/work/proj/src/main.rs"}
        }));
        let sent = out.take();
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0]["status"]["state"], "Needs Approval");
        assert_eq!(sent[0]["status"]["reason"], "Edit src/main.rs");
        assert_eq!(sent[0]["status"]["tracked"], true);

        // A prompt while waiting is a "keep" cell; an unknown event has no signal.
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        t.hook(json!({"hook_event_name": "SessionEnd"}));
        assert_eq!(out.take(), Vec::<Value>::new());
    }

    #[test]
    fn exit_code_zero_ends_the_session() {
        let (t, out) = tracker(1000);
        t.hook(json!({"hook_event_name": "SessionStart"}));
        out.take();
        t.exited(Some(0), 2000);
        assert_eq!(
            out.take(),
            [
                json!({"status": {"state": "Ended", "since": 2000, "reason": null, "tracked": true}}),
                json!({"exited": 0})
            ]
        );
    }

    #[test]
    fn killed_process_is_an_error() {
        let (t, out) = tracker(1000);
        t.exited(None, 2000);
        assert_eq!(
            out.take(),
            [
                json!({"status": {"state": "Error", "since": 2000, "reason": "killed", "tracked": true}}),
                json!({"exited": null})
            ]
        );
    }

    #[test]
    fn exit_without_a_change_still_sends_exited() {
        let (t, out) = tracker(1000);
        t.hook(json!({"hook_event_name": "StopFailure", "error": "overloaded"}));
        out.take();
        // Error + killed is a keep cell: no status, only the exit.
        t.exited(None, 2000);
        assert_eq!(out.take(), [json!({"exited": null})]);
    }

    /// RULE-08 / R3: nothing may follow `{"exited"}`, or a finished pane would
    /// come back on the board.
    #[test]
    fn nothing_is_sent_after_the_exit() {
        let (t, out) = tracker(1000);
        t.exited(Some(0), 2000);
        out.take();

        t.hook(json!({"hook_event_name": "SessionStart"}));
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        t.exited(None, 3000);
        assert_eq!(out.take(), Vec::<Value>::new());
    }

    fn states(out: &Outbox) -> Vec<String> {
        out.take()
            .iter()
            .map(|m| m["status"]["state"].as_str().unwrap_or("-").to_string())
            .collect()
    }

    fn tool_event(name: &str, agent: Option<&str>, tool: &str, input: Value) -> Value {
        let mut event = json!({"hook_event_name": name, "tool_name": tool, "tool_input": input});
        if let Some(agent) = agent {
            event["agent_id"] = json!(agent);
        }
        event
    }

    /// Running, then `Needs Approval` for agent A editing `src/main.rs`.
    fn waiting_for_agent_a() -> (StatusTracker, Outbox) {
        let (t, out) = tracker(1000);
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        t.hook(tool_event(
            "PermissionRequest",
            Some("A"),
            "Edit",
            json!({"file_path": "/work/proj/src/main.rs", "old_string": "a", "new_string": "b"}),
        ));
        assert_eq!(states(&out), ["Running", "Needs Approval"]);
        (t, out)
    }

    /// F-I1: other agents' tool events leave a pending approval alone.
    #[test]
    fn other_agents_tool_events_do_not_answer_a_pending_approval() {
        let (t, out) = waiting_for_agent_a();
        let read = json!({"file_path": "/work/proj/README.md"});
        t.hook(tool_event("PreToolUse", Some("B"), "Read", read.clone()));
        t.hook(tool_event("PostToolUse", Some("B"), "Read", read.clone()));
        t.hook(tool_event("PostToolUseFailure", Some("B"), "Read", read));
        // Same agent, other tool call: not the one waiting either.
        t.hook(tool_event(
            "PostToolUse",
            Some("A"),
            "Edit",
            json!({"file_path": "/work/proj/other.rs"}),
        ));
        t.hook(tool_event(
            "PreToolUse",
            None,
            "Bash",
            json!({"command": "ls"}),
        ));
        assert_eq!(states(&out), Vec::<String>::new());

        // Key fields in another order are the same tool call.
        t.hook(tool_event(
            "PostToolUse",
            Some("A"),
            "Edit",
            json!({"new_string": "b", "old_string": "a", "file_path": "/work/proj/src/main.rs"}),
        ));
        assert_eq!(states(&out), ["Running"]);
    }

    #[test]
    fn a_failed_matching_tool_call_answers_too() {
        let (t, out) = waiting_for_agent_a();
        t.hook(tool_event(
            "PostToolUseFailure",
            Some("A"),
            "Edit",
            json!({"file_path": "/work/proj/src/main.rs", "old_string": "a", "new_string": "b"}),
        ));
        assert_eq!(states(&out), ["Running"]);
    }

    #[test]
    fn the_main_agent_is_keyed_without_an_agent_id() {
        let (t, out) = tracker(1000);
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        t.hook(tool_event(
            "PermissionRequest",
            None,
            "Bash",
            json!({"command": "npm test"}),
        ));
        t.hook(tool_event(
            "PostToolUse",
            Some("A"),
            "Bash",
            json!({"command": "npm test"}),
        ));
        assert_eq!(states(&out), ["Running", "Needs Approval"]);
        t.hook(tool_event(
            "PostToolUse",
            None,
            "Bash",
            json!({"command": "npm test"}),
        ));
        assert_eq!(states(&out), ["Running"]);
    }

    #[test]
    fn a_question_is_answered_by_its_own_tool_call() {
        let (t, out) = tracker(1000);
        let input = json!({"questions": [{"question": "Which?"}]});
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        t.hook(tool_event(
            "PreToolUse",
            None,
            "AskUserQuestion",
            input.clone(),
        ));
        assert_eq!(states(&out), ["Running", "Needs Approval"]);
        t.hook(tool_event("PostToolUse", None, "AskUserQuestion", input));
        assert_eq!(states(&out), ["Running"]);
    }

    #[test]
    fn a_keyless_request_keeps_the_pending_key() {
        let (t, out) = waiting_for_agent_a();
        t.hook(json!({"hook_event_name": "Notification", "notification_type": "permission_prompt", "message": "Claude needs your permission"}));
        assert_eq!(states(&out), Vec::<String>::new());
        t.hook(tool_event(
            "PostToolUse",
            Some("A"),
            "Edit",
            json!({"file_path": "/work/proj/src/main.rs", "old_string": "a", "new_string": "b"}),
        ));
        assert_eq!(states(&out), ["Running"]);
    }

    #[test]
    fn the_pending_key_is_dropped_when_the_wait_ends() {
        let (t, out) = waiting_for_agent_a();
        let input =
            json!({"file_path": "/work/proj/src/main.rs", "old_string": "a", "new_string": "b"});
        t.hook(json!({"hook_event_name": "Stop"}));
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        // A keyless wait: the old key must not answer it.
        t.hook(
            json!({"hook_event_name": "Notification", "notification_type": "permission_prompt"}),
        );
        t.hook(tool_event("PostToolUse", Some("A"), "Edit", input));
        assert_eq!(states(&out), ["Idle", "Running", "Needs Approval"]);
    }

    #[test]
    fn permission_denied_answers_only_its_own_pending_approval() {
        let input =
            json!({"file_path": "/work/proj/src/main.rs", "old_string": "a", "new_string": "b"});
        let (t, out) = waiting_for_agent_a();
        t.hook(tool_event(
            "PermissionDenied",
            Some("B"),
            "Edit",
            input.clone(),
        ));
        assert_eq!(states(&out), Vec::<&str>::new());
        t.hook(tool_event("PermissionDenied", Some("A"), "Edit", input));
        assert_eq!(states(&out), ["Running"]);
    }

    /// F-I2: after a denied dialog or an Esc interrupt only `idle_prompt` follows.
    #[test]
    fn idle_prompt_finishes_the_turn() {
        let (t, out) = tracker(1000);
        let idle = json!({"hook_event_name": "Notification", "notification_type": "idle_prompt", "message": "Claude is waiting for your input"});
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        t.hook(idle.clone());
        assert_eq!(states(&out), ["Running", "Idle"]);

        let (t, out) = waiting_for_agent_a();
        t.hook(idle);
        assert_eq!(states(&out), ["Idle"]);
    }

    /// F-I3: no hook fires when the user answers a dialog; the key they press does.
    #[test]
    fn an_answer_key_typed_while_waiting_answers_the_approval() {
        for key in [&b"1"[..], b"\r", b"\x1b", b"y\r", b"\n", b"\x1b[Z"] {
            let (t, out) = waiting_for_agent_a();
            t.user_input(key, 5000);
            assert_eq!(
                out.take(),
                [
                    json!({"status": {"state": "Running", "since": 5000, "reason": null, "tracked": true}})
                ],
                "{key:?}"
            );
        }
    }

    #[test]
    fn terminal_reports_and_other_keys_do_not_answer() {
        let (t, out) = waiting_for_agent_a();
        for data in [
            &b"\x1b[I"[..],
            b"\x1b[O",
            b"\x1b[12;5R",
            b"\x1b[?1;2c",
            b"\x1b[A",
            b"\x1b[B",
            b"\x1b[M #!",
            b"\x1b[<0;10;5M",
            b"\x1b[200~pasted\x1b[201~",
            b"x",
            b"12",
            b"",
        ] {
            t.user_input(data, 5000);
        }
        assert_eq!(out.take(), Vec::<Value>::new());
    }

    #[test]
    fn input_outside_a_wait_sends_nothing() {
        let (t, out) = tracker(1000);
        t.hook(json!({"hook_event_name": "UserPromptSubmit"}));
        out.take();
        t.user_input(b"\r", 5000);
        t.user_input(b"1", 5000);
        assert_eq!(out.take(), Vec::<Value>::new());
    }

    /// Once answered by a key, the tool's own `PostToolUse` must not re-arm anything.
    #[test]
    fn a_key_answer_clears_the_pending_key() {
        let (t, out) = waiting_for_agent_a();
        t.user_input(b"1", 5000);
        t.hook(
            json!({"hook_event_name": "Notification", "notification_type": "permission_prompt"}),
        );
        t.hook(tool_event(
            "PostToolUse",
            Some("A"),
            "Edit",
            json!({"file_path": "/work/proj/src/main.rs", "old_string": "a", "new_string": "b"}),
        ));
        assert_eq!(states(&out), ["Running", "Needs Approval"]);
    }

    /// F-M3: a pane the user closed must not flash `Error · killed` on its way out.
    #[test]
    fn a_pane_closed_by_the_user_sends_only_the_exit() {
        let (t, out) = waiting_for_agent_a();
        t.close_by_user();
        t.hook(json!({"hook_event_name": "Stop"}));
        t.user_input(b"\r", 5000);
        t.exited(None, 6000);
        assert_eq!(out.take(), [json!({"exited": null})]);
        t.exited(None, 7000);
        assert_eq!(out.take(), Vec::<Value>::new());
    }

    /// F-M2: the app saw the exit, so an untracked pane's crash reaches the board.
    #[test]
    fn an_exit_marks_an_untracked_pane_tracked() {
        let (t, out) = tracker(1000);
        t.exited(Some(3), 2000);
        assert_eq!(
            out.take(),
            [
                json!({"status": {"state": "Error", "since": 2000, "reason": "exit code 3", "tracked": true}}),
                json!({"exited": 3})
            ]
        );
    }

    #[test]
    fn exit_message_is_json_with_the_code() {
        assert_eq!(exit_json(Some(7)), r#"{"exited":7}"#);
        assert_eq!(exit_json(None), r#"{"exited":null}"#);
    }

    #[test]
    fn now_ms_is_unix_milliseconds() {
        let now = now_ms();
        assert!(now > 1_700_000_000_000 && now < 4_000_000_000_000, "{now}");
    }
}
