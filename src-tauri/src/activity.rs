//! A pane's Activity Bar state, fed by its hook events and its status line input,
//! sent as `{"activity"}` on the pane channel on every change (SRS-FR-152).

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};

use crate::hooks::HookSink;
use crate::pane_status::StatusOut;
use crate::transcript::tool_arg;

struct Tool {
    id: String,
    name: String,
    arg: Option<String>,
}

pub struct Activity {
    cwd: PathBuf,
    tool: Option<Tool>,
    context: Option<u8>,
    shells: BTreeSet<String>,
    subagents: BTreeSet<String>,
}

impl Activity {
    pub fn new(cwd: &Path) -> Self {
        Activity {
            cwd: cwd.to_path_buf(),
            tool: None,
            context: None,
            shells: BTreeSet::new(),
            subagents: BTreeSet::new(),
        }
    }

    /// The `{"activity"}` message when the event changed it.
    pub fn apply_hook(&mut self, event: &Value) -> Option<Value> {
        let before = self.snapshot();
        let tool_use_id = event["tool_use_id"].as_str();
        match event["hook_event_name"].as_str().unwrap_or_default() {
            "PreToolUse" => {
                let input = &event["tool_input"];
                for key in ["shell_id", "bash_id", "task_id"] {
                    if let Some(id) = input[key].as_str() {
                        self.shells.remove(id);
                    }
                }
                let name = event["tool_name"].as_str().unwrap_or_default();
                self.tool = Some(Tool {
                    id: tool_use_id.unwrap_or_default().to_string(),
                    name: name.to_string(),
                    arg: tool_arg(name, input, &self.cwd),
                });
            }
            "PostToolUse" | "PostToolUseFailure" | "PermissionDenied" => {
                if let Some(id) = event["tool_response"]["backgroundTaskId"].as_str() {
                    self.shells.insert(id.to_string());
                }
                if self.tool.as_ref().map(|t| t.id.as_str()) == tool_use_id {
                    self.tool = None;
                }
            }
            "UserPromptSubmit" | "StopFailure" => self.tool = None,
            "Stop" => {
                self.tool = None;
                self.set_shells(event);
            }
            "SubagentStart" => {
                if let Some(id) = event["agent_id"].as_str() {
                    self.subagents.insert(id.to_string());
                }
            }
            "SubagentStop" => {
                if let Some(id) = event["agent_id"].as_str() {
                    self.subagents.remove(id);
                }
                self.set_shells(event);
            }
            "SessionStart" if event["source"] == "clear" => {
                self.tool = None;
                self.subagents.clear();
            }
            _ => {}
        }
        self.changed_from(before)
    }

    /// The `{"activity"}` message when the status line input changed it.
    pub fn apply_status_line(&mut self, input: &Value) -> Option<Value> {
        let before = self.snapshot();
        if let Some(used) = input["context_window"]["used_percentage"].as_f64() {
            self.context = Some(used.round().clamp(0.0, 100.0) as u8);
        }
        self.changed_from(before)
    }

    /// A shell that ended by itself is only dropped here: no hook fires for it.
    fn set_shells(&mut self, event: &Value) {
        if let Some(tasks) = event["background_tasks"].as_array() {
            self.shells = tasks
                .iter()
                .filter(|t| t["type"] == "shell" && t["status"] == "running")
                .filter_map(|t| t["id"].as_str().map(str::to_string))
                .collect();
        }
    }

    fn changed_from(&self, before: Value) -> Option<Value> {
        let now = self.snapshot();
        (now != before).then_some(now)
    }

    fn snapshot(&self) -> Value {
        let tool = self.tool.as_ref();
        json!({"activity": {
            "tool": tool.map(|t| t.name.clone()),
            "arg": tool.and_then(|t| t.arg.clone()),
            "context": self.context,
            "shells": self.shells.len(),
            "subagents": self.subagents.len(),
        }})
    }
}

/// Ties a pane's `Activity` to its channel; sending under the lock keeps the order.
pub struct PaneActivity {
    state: Mutex<Activity>,
    out: Arc<dyn StatusOut>,
}

impl PaneActivity {
    pub fn new(cwd: &Path, out: Arc<dyn StatusOut>) -> Self {
        PaneActivity {
            state: Mutex::new(Activity::new(cwd)),
            out,
        }
    }

    pub fn hook(&self, event: &Value) {
        let mut state = self.state.lock().unwrap();
        if let Some(message) = state.apply_hook(event) {
            self.out.send_json(message.to_string());
        }
    }

    pub fn status_line(&self, input: &Value) {
        let mut state = self.state.lock().unwrap();
        if let Some(message) = state.apply_status_line(input) {
            self.out.send_json(message.to_string());
        }
    }
}

/// The sink of a pane's status line token: its input has no `hook_event_name`.
pub struct StatusLineSink(pub Arc<PaneActivity>);

impl HookSink for StatusLineSink {
    fn hook(&self, event: Value) {
        self.0.status_line(&event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn activity() -> Activity {
        Activity::new(Path::new("/w"))
    }

    fn snap(
        tool: Option<&str>,
        arg: Option<&str>,
        context: Option<u8>,
        shells: usize,
        subagents: usize,
    ) -> Option<Value> {
        Some(json!({"activity": {
            "tool": tool, "arg": arg, "context": context,
            "shells": shells, "subagents": subagents,
        }}))
    }

    fn pre(id: &str, name: &str, input: Value) -> Value {
        json!({
            "hook_event_name": "PreToolUse",
            "session_id": "s1",
            "transcript_path": "/p/s1.jsonl",
            "tool_name": name,
            "tool_input": input,
            "tool_use_id": id,
        })
    }

    fn post(id: &str, response: Value) -> Value {
        json!({
            "hook_event_name": "PostToolUse",
            "session_id": "s1",
            "transcript_path": "/p/s1.jsonl",
            "tool_name": "Bash",
            "tool_use_id": id,
            "tool_response": response,
        })
    }

    fn event(name: &str, extra: Value) -> Value {
        let mut event = json!({"hook_event_name": name, "session_id": "s1"});
        for (k, v) in extra.as_object().unwrap() {
            event[k] = v.clone();
        }
        event
    }

    fn npm_test() -> Value {
        pre(
            "toolu_1",
            "Bash",
            json!({"command": "npm test", "description": "Run the tests"}),
        )
    }

    #[test]
    fn pre_tool_use_sets_the_tool_and_its_post_clears_it() {
        let mut a = activity();
        assert_eq!(
            a.apply_hook(&npm_test()),
            snap(Some("Bash"), Some("npm test"), None, 0, 0)
        );
        let done = post(
            "toolu_1",
            json!({"stdout": "ok", "stderr": "", "interrupted": false}),
        );
        assert_eq!(a.apply_hook(&done), snap(None, None, None, 0, 0));
    }

    #[test]
    fn post_of_another_tool_keeps_the_running_one() {
        let mut a = activity();
        a.apply_hook(&npm_test());
        assert_eq!(a.apply_hook(&post("toolu_other", json!({}))), None);
    }

    #[test]
    fn failure_denial_prompt_and_stop_clear_the_tool() {
        for ending in [
            event(
                "PostToolUseFailure",
                json!({"tool_use_id": "toolu_1", "error": "x"}),
            ),
            event("PermissionDenied", json!({"tool_use_id": "toolu_1"})),
            event("UserPromptSubmit", json!({"prompt": "next"})),
            event("Stop", json!({})),
            event("StopFailure", json!({})),
        ] {
            let mut a = activity();
            a.apply_hook(&npm_test());
            assert_eq!(
                a.apply_hook(&ending),
                snap(None, None, None, 0, 0),
                "{ending}"
            );
        }
    }

    #[test]
    fn tool_arg_is_the_same_as_on_chat_cards() {
        let mut a = activity();
        let read = pre("toolu_2", "Read", json!({"file_path": "/w/src/login.ts"}));
        assert_eq!(
            a.apply_hook(&read),
            snap(Some("Read"), Some("src/login.ts"), None, 0, 0)
        );
    }

    #[test]
    fn background_shell_is_counted_until_a_tool_stops_it() {
        let mut a = activity();
        let started = pre(
            "toolu_3",
            "Bash",
            json!({"command": "npm run dev", "run_in_background": true}),
        );
        a.apply_hook(&started);
        let posted = post(
            "toolu_3",
            json!({"stdout": "", "stderr": "", "interrupted": false, "backgroundTaskId": "bg08ys50j"}),
        );
        assert_eq!(a.apply_hook(&posted), snap(None, None, None, 1, 0));

        let kill = pre("toolu_4", "KillShell", json!({"shell_id": "bg08ys50j"}));
        assert_eq!(
            a.apply_hook(&kill),
            snap(Some("KillShell"), None, None, 0, 0)
        );
    }

    #[test]
    fn task_stop_and_bash_id_also_stop_a_known_shell() {
        for key in ["bash_id", "task_id"] {
            let mut a = activity();
            a.apply_hook(&post("t", json!({"backgroundTaskId": "bg1"})));
            let stop = pre("t2", "TaskStop", json!({key: "bg1"}));
            assert_eq!(
                a.apply_hook(&stop).unwrap()["activity"]["shells"],
                0,
                "{key}"
            );
        }
    }

    #[test]
    fn stopping_an_unknown_shell_keeps_the_count() {
        let mut a = activity();
        a.apply_hook(&post("t", json!({"backgroundTaskId": "bg1"})));
        let stop = pre("t2", "KillShell", json!({"shell_id": "bg-other"}));
        assert_eq!(a.apply_hook(&stop).unwrap()["activity"]["shells"], 1);
    }

    #[test]
    fn stop_sets_shells_from_its_running_shell_tasks() {
        let mut a = activity();
        a.apply_hook(&post("t", json!({"backgroundTaskId": "bg-old"})));
        let stop = event(
            "Stop",
            json!({"background_tasks": [
                {"id": "bg08ys50j", "type": "shell", "status": "running", "command": "npm run dev"},
                {"id": "bg2", "type": "shell", "status": "running", "command": "tail -f log"},
                {"id": "bg3", "type": "shell", "status": "completed"},
                {"id": "a1", "type": "agent", "status": "running"},
            ]}),
        );
        assert_eq!(a.apply_hook(&stop), snap(None, None, None, 2, 0));

        let later = event("Stop", json!({"background_tasks": []}));
        assert_eq!(a.apply_hook(&later), snap(None, None, None, 0, 0));
    }

    #[test]
    fn stop_without_background_tasks_keeps_the_shells() {
        let mut a = activity();
        a.apply_hook(&post("t", json!({"backgroundTaskId": "bg1"})));
        assert_eq!(a.apply_hook(&event("Stop", json!({}))), None);
    }

    #[test]
    fn subagents_are_counted_from_start_to_stop() {
        let mut a = activity();
        let start = |id: &str| {
            event(
                "SubagentStart",
                json!({"agent_id": id, "agent_type": "Explore"}),
            )
        };
        assert_eq!(a.apply_hook(&start("a1")), snap(None, None, None, 0, 1));
        assert_eq!(a.apply_hook(&start("a2")), snap(None, None, None, 0, 2));
        let stop = event(
            "SubagentStop",
            json!({"agent_id": "a1", "agent_type": "Explore", "background_tasks": [
                {"id": "bg1", "type": "shell", "status": "running"},
            ]}),
        );
        assert_eq!(a.apply_hook(&stop), snap(None, None, None, 1, 1));
    }

    #[test]
    fn status_line_sets_the_rounded_context_share() {
        let mut a = activity();
        let input = |used: Value| json!({"session_id": "s1", "context_window": {"used_percentage": used, "context_window_size": 200000}});
        assert_eq!(
            a.apply_status_line(&input(json!(41.6))),
            snap(None, None, Some(42), 0, 0)
        );
        assert_eq!(a.apply_status_line(&input(Value::Null)), None);
        assert_eq!(a.apply_status_line(&json!({})), None);
        assert_eq!(
            a.apply_status_line(&input(json!(12.2))),
            snap(None, None, Some(12), 0, 0)
        );
    }

    #[test]
    fn session_start_after_clear_drops_the_tool_and_subagents() {
        let mut a = activity();
        a.apply_status_line(&json!({"context_window": {"used_percentage": 41.6}}));
        a.apply_hook(&post("t", json!({"backgroundTaskId": "bg1"})));
        a.apply_hook(&event("SubagentStart", json!({"agent_id": "a1"})));
        a.apply_hook(&npm_test());

        let clear = event("SessionStart", json!({"source": "clear"}));
        assert_eq!(a.apply_hook(&clear), snap(None, None, Some(42), 1, 0));
    }

    #[test]
    fn session_start_of_another_source_changes_nothing() {
        let mut a = activity();
        a.apply_hook(&npm_test());
        assert_eq!(
            a.apply_hook(&event("SessionStart", json!({"source": "resume"}))),
            None
        );
    }

    #[test]
    fn a_snapshot_is_sent_only_on_change() {
        let mut a = activity();
        assert_eq!(a.apply_hook(&event("UserPromptSubmit", json!({}))), None);
        assert!(a.apply_hook(&npm_test()).is_some());
        assert_eq!(a.apply_hook(&npm_test()), None);
        assert_eq!(a.apply_hook(&event("Notification", json!({}))), None);
    }

    #[derive(Clone, Default)]
    struct Outbox(Arc<Mutex<Vec<String>>>);

    impl StatusOut for Outbox {
        fn send_json(&self, json: String) {
            self.0.lock().unwrap().push(json);
        }
    }

    #[test]
    fn pane_activity_sends_each_change_once_on_the_channel() {
        let out = Outbox::default();
        let pane = Arc::new(PaneActivity::new(Path::new("/w"), Arc::new(out.clone())));
        let status = StatusLineSink(pane.clone());

        pane.hook(&npm_test());
        pane.hook(&npm_test());
        status.hook(json!({"context_window": {"used_percentage": 41.6}}));

        let sent: Vec<Value> = out
            .0
            .lock()
            .unwrap()
            .iter()
            .map(|m| serde_json::from_str(m).unwrap())
            .collect();
        assert_eq!(
            sent,
            [
                snap(Some("Bash"), Some("npm test"), None, 0, 0).unwrap(),
                snap(Some("Bash"), Some("npm test"), Some(42), 0, 0).unwrap(),
            ]
        );
    }
}
