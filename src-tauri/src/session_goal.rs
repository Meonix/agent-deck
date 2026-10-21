use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const FILE: &str = "session-goals.json";
const TMP: &str = "session-goals.json.tmp";
const BAK: &str = "session-goals.json.bak";
const REMINDER_GOAL_CHARS: usize = 500;

/// The pane's message stream, as for `StatusOut`: `{"goal": text | null}`.
pub trait GoalOut: Send + Sync {
    fn send_json(&self, json: String);
}

#[derive(Serialize, Deserialize)]
struct Stored {
    version: u32,
    goals: HashMap<String, String>,
}

/// Goal per Claude Code session id, kept whole in `session-goals.json` (SRS-FR-096).
pub struct GoalStore {
    dir: PathBuf,
    goals: HashMap<String, String>,
}

impl GoalStore {
    /// A missing file starts empty; an unreadable one is kept as `.bak` for manual recovery.
    pub fn load(dir: PathBuf) -> Self {
        let goals = Self::read(&dir).unwrap_or_else(|e| {
            crate::diag::error("session_goal", &format!("cannot read {FILE}: {e}"));
            HashMap::new()
        });
        GoalStore { dir, goals }
    }

    fn read(dir: &Path) -> io::Result<HashMap<String, String>> {
        let file = dir.join(FILE);
        let bytes = match fs::read(&file) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(HashMap::new()),
            Err(e) => return Err(e),
        };
        match serde_json::from_slice::<Stored>(&bytes) {
            Ok(stored) => Ok(stored.goals),
            Err(_) => {
                fs::rename(&file, dir.join(BAK))?;
                Ok(HashMap::new())
            }
        }
    }

    pub fn get(&self, session_id: &str) -> Option<String> {
        self.goals.get(session_id).cloned()
    }

    /// The goal stays in memory for this run even when the write fails.
    pub fn set(&mut self, session_id: &str, text: &str) {
        self.goals.insert(session_id.to_string(), text.to_string());
        if let Err(e) = self.save() {
            crate::diag::error("session_goal", &format!("cannot write {FILE}: {e}"));
        }
    }

    fn save(&self) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let stored = Stored {
            version: 1,
            goals: self.goals.clone(),
        };
        let json = serde_json::to_vec_pretty(&stored).map_err(io::Error::other)?;
        let tmp = self.dir.join(TMP);
        fs::write(&tmp, json)?;
        fs::rename(&tmp, self.dir.join(FILE))
    }
}

/// One pane's goal logic: follows the pane's current session and answers its prompts.
///
/// Like `StatusTracker` it is a single ordered writer: messages are sent while
/// the session lock is held.
pub struct GoalKeeper {
    store: Arc<Mutex<GoalStore>>,
    session: Mutex<String>,
    out: Box<dyn GoalOut>,
}

impl GoalKeeper {
    pub fn new(store: Arc<Mutex<GoalStore>>, session_id: String, out: Box<dyn GoalOut>) -> Self {
        GoalKeeper {
            store,
            session: Mutex::new(session_id),
            out,
        }
    }

    /// Sends the stored goal of the current session, if any (a pane opened on a resume).
    pub fn announce(&self) {
        let Ok(session) = self.session.lock() else {
            return;
        };
        if let Some(goal) = self.stored(&session) {
            self.send(Some(&goal));
        }
    }

    /// Replaces the current session's goal; blank text changes nothing (SRS-FR-093).
    pub fn set(&self, text: &str) {
        let text = text.trim();
        if text.is_empty() {
            return;
        }
        let Ok(session) = self.session.lock() else {
            return;
        };
        if self.store_goal(&session, text) {
            self.send(Some(text));
        }
    }

    /// Follows the event's `session_id`, pins a first prompt (SRS-FR-091) and
    /// answers a `UserPromptSubmit` of a session with a goal (SRS-FR-094).
    /// Anything unusable answers `None` so the prompt goes through (SRS-FR-098).
    pub fn hook(&self, event: &Value) -> Option<Value> {
        let mut session = self.session.lock().ok()?;
        if let Some(id) = event["session_id"].as_str().filter(|id| !id.is_empty())
            && id != *session
        {
            *session = id.to_string();
            self.send(self.stored(&session).as_deref());
        }
        if event["hook_event_name"] != "UserPromptSubmit" {
            return None;
        }
        let mut goal = self.stored(&session);
        if goal.is_none() {
            let prompt = event["prompt"].as_str()?.trim();
            if prompt.is_empty() || !self.store_goal(&session, prompt) {
                return None;
            }
            self.send(Some(prompt));
            goal = Some(prompt.to_string());
        }
        goal.map(|goal| reminder_body(&goal))
    }

    fn stored(&self, session: &str) -> Option<String> {
        self.store.lock().ok()?.get(session)
    }

    fn store_goal(&self, session: &str, text: &str) -> bool {
        match self.store.lock() {
            Ok(mut store) => {
                store.set(session, text);
                true
            }
            Err(_) => false,
        }
    }

    fn send(&self, goal: Option<&str>) {
        self.out.send_json(json!({ "goal": goal }).to_string());
    }
}

/// The text Claude Code gets with each prompt of a session with a goal (SRS-FR-095).
pub fn focus_reminder(goal: &str) -> String {
    let goal: String = goal.chars().take(REMINDER_GOAL_CHARS).collect();
    format!(
        "agent-deck Session Goal: \"{goal}\". This session is for that one task. \
A prompt that serves it — fixing a bug that blocks it, running tests, committing, \
asking about work done for it — is in scope; do it. A prompt that asks for a \
separate change that could stand on its own is off-goal: do not carry it out; say \
in one sentence that it is a different task and suggest opening a new session for \
it. If the user then says to go ahead, do it."
    )
}

pub fn reminder_body(goal: &str) -> Value {
    json!({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": focus_reminder(goal),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn reminder_names_the_goal_and_the_off_goal_rule() {
        let text = focus_reminder("Sửa lỗi resume mất scrollback");
        assert!(text.starts_with(
            "agent-deck Session Goal: \"Sửa lỗi resume mất scrollback\". This session is for that one task."
        ));
        for part in [
            "fixing a bug that blocks it, running tests, committing",
            "is in scope; do it",
            "is off-goal: do not carry it out",
            "suggest opening a new session",
            "If the user then says to go ahead, do it.",
        ] {
            assert!(text.contains(part), "{part}: {text}");
        }
    }

    #[test]
    fn reminder_keeps_500_characters_of_a_long_goal() {
        let goal = "Sửa lỗi ".repeat(100);
        assert!(goal.chars().count() == 800);
        let text = focus_reminder(&goal);
        let kept: String = goal.chars().take(500).collect();
        assert!(text.contains(&format!("\"{kept}\"")));
        assert!(!text.contains(&goal.chars().take(501).collect::<String>()));
    }

    #[test]
    fn reminder_body_is_the_prompt_submit_context() {
        let body = reminder_body("goal");
        assert_eq!(
            body["hookSpecificOutput"]["hookEventName"],
            "UserPromptSubmit"
        );
        assert_eq!(
            body["hookSpecificOutput"]["additionalContext"],
            focus_reminder("goal")
        );
        assert_eq!(body.as_object().unwrap().len(), 1);
    }

    struct Outbox(Arc<Mutex<Vec<String>>>);

    impl GoalOut for Outbox {
        fn send_json(&self, json: String) {
            self.0.lock().unwrap().push(json);
        }
    }

    struct Fixture {
        dir: tempfile::TempDir,
        store: Arc<Mutex<GoalStore>>,
        sent: Arc<Mutex<Vec<String>>>,
        keeper: GoalKeeper,
    }

    impl Fixture {
        fn new() -> Self {
            let dir = tempdir().unwrap();
            let store = Arc::new(Mutex::new(GoalStore::load(dir.path().to_path_buf())));
            let sent = Arc::new(Mutex::new(Vec::new()));
            let keeper =
                GoalKeeper::new(store.clone(), "s1".into(), Box::new(Outbox(sent.clone())));
            Fixture {
                dir,
                store,
                sent,
                keeper,
            }
        }

        fn prompt(&self, session: &str, text: &str) -> Option<Value> {
            self.keeper.hook(&json!({
                "hook_event_name": "UserPromptSubmit",
                "session_id": session,
                "prompt": text,
            }))
        }

        fn take(&self) -> Vec<Value> {
            self.sent
                .lock()
                .unwrap()
                .drain(..)
                .map(|m| serde_json::from_str(&m).unwrap())
                .collect()
        }

        fn goal(&self, session: &str) -> Option<String> {
            self.store.lock().unwrap().get(session)
        }
    }

    #[test]
    fn first_prompt_is_pinned_sent_and_answered_with_the_reminder() {
        let f = Fixture::new();
        let answer = f.prompt("s1", "Sửa lỗi resume mất scrollback");
        assert_eq!(f.goal("s1").unwrap(), "Sửa lỗi resume mất scrollback");
        assert_eq!(f.take(), [json!({"goal": "Sửa lỗi resume mất scrollback"})]);
        assert_eq!(answer, Some(reminder_body("Sửa lỗi resume mất scrollback")));
    }

    #[test]
    fn later_prompt_keeps_the_goal_and_still_gets_the_reminder() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume mất scrollback");
        f.take();
        let answer = f.prompt("s1", "chạy test");
        assert_eq!(f.goal("s1").unwrap(), "Sửa lỗi resume mất scrollback");
        assert!(f.take().is_empty());
        assert_eq!(answer, Some(reminder_body("Sửa lỗi resume mất scrollback")));
    }

    #[test]
    fn new_session_after_clear_sends_null_then_pins_the_next_prompt() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume mất scrollback");
        f.take();
        let answer = f.keeper.hook(&json!({
            "hook_event_name": "SessionStart",
            "session_id": "s2",
        }));
        assert_eq!(answer, None);
        assert_eq!(f.take(), [json!({"goal": null})]);
        f.prompt("s2", "Thêm nút export CSV");
        assert_eq!(f.take(), [json!({"goal": "Thêm nút export CSV"})]);
        assert_eq!(f.goal("s1").unwrap(), "Sửa lỗi resume mất scrollback");
        assert_eq!(f.goal("s2").unwrap(), "Thêm nút export CSV");
    }

    #[test]
    fn prompt_of_a_new_session_sends_null_before_the_new_goal() {
        let f = Fixture::new();
        f.prompt("s1", "một");
        f.take();
        f.prompt("s2", "hai");
        assert_eq!(f.take(), [json!({"goal": null}), json!({"goal": "hai"})]);
    }

    #[test]
    fn switching_back_to_a_session_with_a_goal_sends_it() {
        let f = Fixture::new();
        f.prompt("s1", "một");
        f.prompt("s2", "hai");
        f.take();
        f.keeper
            .hook(&json!({"hook_event_name": "Stop", "session_id": "s1"}));
        assert_eq!(f.take(), [json!({"goal": "một"})]);
    }

    #[test]
    fn skill_command_is_kept_whole() {
        let f = Fixture::new();
        f.prompt("s1", "/dev-bug lỗi X");
        assert_eq!(f.goal("s1").unwrap(), "/dev-bug lỗi X");
    }

    #[test]
    fn set_replaces_and_sends_and_the_next_reminder_carries_it() {
        let f = Fixture::new();
        f.prompt("s1", "cũ");
        f.take();
        f.keeper.set("  Sửa resume mất scrollback trên Windows ");
        assert_eq!(
            f.take(),
            [json!({"goal": "Sửa resume mất scrollback trên Windows"})]
        );
        assert_eq!(
            f.prompt("s1", "x"),
            Some(reminder_body("Sửa resume mất scrollback trên Windows"))
        );
    }

    #[test]
    fn blank_set_changes_nothing() {
        let f = Fixture::new();
        f.prompt("s1", "cũ");
        f.take();
        f.keeper.set("  \n ");
        assert!(f.take().is_empty());
        assert_eq!(f.goal("s1").unwrap(), "cũ");
    }

    #[test]
    fn announce_sends_the_stored_goal_of_the_current_session_only() {
        let f = Fixture::new();
        f.keeper.announce();
        assert!(f.take().is_empty());
        f.store.lock().unwrap().set("s1", "đã lưu");
        f.keeper.announce();
        assert_eq!(f.take(), [json!({"goal": "đã lưu"})]);
    }

    #[test]
    fn goal_survives_a_new_store_on_the_same_dir() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume");
        f.keeper.set("Sửa resume trên Windows");
        let again = GoalStore::load(f.dir.path().to_path_buf());
        assert_eq!(again.get("s1").unwrap(), "Sửa resume trên Windows");
        assert!(!f.dir.path().join("session-goals.json.tmp").exists());
    }

    #[test]
    fn unreadable_file_is_kept_as_bak_and_the_store_starts_empty() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("session-goals.json"), "{not json").unwrap();
        let mut store = GoalStore::load(dir.path().to_path_buf());
        assert!(store.get("s1").is_none());
        assert_eq!(
            fs::read_to_string(dir.path().join("session-goals.json.bak")).unwrap(),
            "{not json"
        );
        store.set("s1", "mới");
        assert_eq!(
            GoalStore::load(dir.path().to_path_buf()).get("s1").unwrap(),
            "mới"
        );
    }

    #[test]
    fn write_failure_keeps_the_goal_in_memory() {
        let dir = tempdir().unwrap();
        let blocker = dir.path().join("file");
        fs::write(&blocker, "x").unwrap();
        let mut store = GoalStore::load(blocker.join("sub"));
        store.set("s1", "giữ trong bộ nhớ");
        assert_eq!(store.get("s1").unwrap(), "giữ trong bộ nhớ");
    }

    #[test]
    fn unusable_payloads_answer_nothing() {
        let f = Fixture::new();
        assert_eq!(f.keeper.hook(&json!({})), None);
        assert_eq!(f.keeper.hook(&json!("text")), None);
        for event in [
            json!({"hook_event_name": "UserPromptSubmit", "session_id": "s1"}),
            json!({"hook_event_name": "UserPromptSubmit", "session_id": "s1", "prompt": "  "}),
            json!({"hook_event_name": "UserPromptSubmit", "session_id": "s1", "prompt": 5}),
        ] {
            assert_eq!(f.keeper.hook(&event), None, "{event}");
        }
        assert!(f.take().is_empty());
        assert!(f.goal("s1").is_none());
    }

    #[test]
    fn prompt_without_session_id_uses_the_opened_session() {
        let f = Fixture::new();
        let answer = f
            .keeper
            .hook(&json!({"hook_event_name": "UserPromptSubmit", "prompt": "việc"}));
        assert_eq!(f.goal("s1").unwrap(), "việc");
        assert_eq!(answer, Some(reminder_body("việc")));
    }

    #[test]
    fn poisoned_store_answers_nothing() {
        let f = Fixture::new();
        let store = f.store.clone();
        let _ = std::thread::spawn(move || {
            let _guard = store.lock().unwrap();
            panic!("poison");
        })
        .join();
        assert_eq!(f.prompt("s1", "việc"), None);
        f.keeper.set("khác");
        f.keeper.announce();
    }
}
