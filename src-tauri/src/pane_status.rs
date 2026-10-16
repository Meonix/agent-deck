use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;

use crate::hooks::HookSink;
use crate::status::{StatusChange, StatusMachine, signal_of};

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
    /// A hook request has reached this pane (D5).
    tracked: bool,
    /// `{"exited"}` has been sent; later hooks are dropped.
    finished: bool,
}

impl StatusTracker {
    pub fn new(workspace: PathBuf, out: Box<dyn StatusOut>, now: u64) -> Self {
        StatusTracker {
            inner: Mutex::new(Tracked {
                machine: StatusMachine::new(now),
                tracked: false,
                finished: false,
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
        if let Some(change) = inner.machine.exit(code, now) {
            self.out.send_json(status_json(&change, inner.tracked));
        }
        self.out.send_json(exit_json(code));
    }
}

impl HookSink for StatusTracker {
    fn hook(&self, event: Value) {
        let signal = signal_of(&event, &self.workspace);
        let mut inner = self.inner.lock().unwrap();
        if inner.finished {
            return;
        }
        let first = !inner.tracked;
        inner.tracked = true;
        let changed = signal
            .and_then(|s| inner.machine.apply(s, now_ms()))
            .is_some();
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
                json!({"status": {"state": "Error", "since": 2000, "reason": "killed", "tracked": false}}),
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
