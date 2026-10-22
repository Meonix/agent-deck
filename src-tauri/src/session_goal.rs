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
    /// Set when the existing file could not be read or moved aside: it is never written over.
    read_only: bool,
}

impl GoalStore {
    /// A missing file starts empty; a corrupt one is kept as `.bak` for manual recovery. A file
    /// that cannot be read or moved aside leaves the store in memory only, so it is not clobbered.
    pub fn load(dir: PathBuf) -> Self {
        let (goals, read_only) = match Self::read(&dir) {
            Ok(goals) => (goals, false),
            Err(e) => {
                crate::diag::error("session_goal", &format!("cannot read {FILE}: {e}"));
                (HashMap::new(), true)
            }
        };
        GoalStore {
            dir,
            goals,
            read_only,
        }
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
        if self.read_only {
            return;
        }
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

    /// Replaces the current session's goal; an empty text is kept as the goal (SRS-FR-093).
    pub fn set(&self, text: &str) {
        let text = text.trim();
        let Ok(session) = self.session.lock() else {
            return;
        };
        if self.store_goal(&session, text) {
            self.send(Some(text));
        }
    }

    /// Follows the `session_id` of any event but `SessionEnd` (it may arrive after the next
    /// session's start) and pins a first prompt (SRS-FR-091).
    pub fn hook(&self, event: &Value) {
        if event["hook_event_name"] == "SessionEnd" {
            return;
        }
        let Ok(mut session) = self.session.lock() else {
            return;
        };
        if let Some(id) = event["session_id"].as_str().filter(|id| !id.is_empty())
            && id != *session
        {
            *session = id.to_string();
            self.send(self.stored(&session).as_deref());
        }
        if event["hook_event_name"] != "UserPromptSubmit" || self.stored(&session).is_some() {
            return;
        }
        let Some(prompt) = event["prompt"].as_str().map(str::trim) else {
            return;
        };
        if !prompt.is_empty() && self.store_goal(&session, prompt) {
            self.send(Some(prompt));
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

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

        fn prompt(&self, session: &str, text: &str) {
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
    fn first_prompt_is_pinned_and_sent() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume mất scrollback");
        assert_eq!(f.goal("s1").unwrap(), "Sửa lỗi resume mất scrollback");
        assert_eq!(f.take(), [json!({"goal": "Sửa lỗi resume mất scrollback"})]);
    }

    #[test]
    fn multi_line_first_prompt_keeps_its_lines() {
        let f = Fixture::new();
        f.prompt("s1", "  Sửa resume\n1. đọc log\n2. viết test \n");
        assert_eq!(f.goal("s1").unwrap(), "Sửa resume\n1. đọc log\n2. viết test");
    }

    #[test]
    fn later_prompt_keeps_the_goal() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume mất scrollback");
        f.take();
        f.prompt("s1", "chạy test");
        assert_eq!(f.goal("s1").unwrap(), "Sửa lỗi resume mất scrollback");
        assert!(f.take().is_empty());
    }

    #[test]
    fn new_session_after_clear_sends_null_then_pins_the_next_prompt() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume mất scrollback");
        f.take();
        f.keeper.hook(&json!({
            "hook_event_name": "SessionStart",
            "session_id": "s2",
        }));
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
    fn set_replaces_and_sends() {
        let f = Fixture::new();
        f.prompt("s1", "cũ");
        f.take();
        f.keeper.set("  Sửa resume mất scrollback trên Windows ");
        assert_eq!(
            f.take(),
            [json!({"goal": "Sửa resume mất scrollback trên Windows"})]
        );
        f.prompt("s1", "x");
        assert_eq!(f.goal("s1").unwrap(), "Sửa resume mất scrollback trên Windows");
    }

    #[test]
    fn cleared_goal_is_stored_sent_and_not_refilled() {
        let f = Fixture::new();
        f.prompt("s1", "cũ");
        f.take();
        f.keeper.set("  \n ");
        assert_eq!(f.take(), [json!({"goal": ""})]);
        assert_eq!(f.goal("s1").unwrap(), "");
        f.prompt("s1", "chạy test");
        assert!(f.take().is_empty());
        assert_eq!(f.goal("s1").unwrap(), "");
    }

    #[test]
    fn goal_typed_before_the_first_prompt_wins() {
        let f = Fixture::new();
        f.keeper.set("Sửa resume");
        f.take();
        f.prompt("s1", "chạy test");
        assert!(f.take().is_empty());
        assert_eq!(f.goal("s1").unwrap(), "Sửa resume");
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
    #[cfg(unix)]
    fn unreadable_file_is_never_overwritten() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempdir().unwrap();
        let file = dir.path().join("session-goals.json");
        let original = r#"{"version":1,"goals":{"old":"giữ lại"}}"#;
        fs::write(&file, original).unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read(&file).is_ok() {
            return;
        }
        let mut store = GoalStore::load(dir.path().to_path_buf());
        store.set("s1", "mới");
        assert_eq!(store.get("s1").unwrap(), "mới");
        fs::set_permissions(&file, fs::Permissions::from_mode(0o644)).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), original);
        assert!(!dir.path().join("session-goals.json.tmp").exists());
    }

    #[test]
    fn session_end_does_not_switch_the_session() {
        let f = Fixture::new();
        f.prompt("s1", "Sửa lỗi resume mất scrollback");
        f.keeper.hook(&json!({"hook_event_name": "SessionStart", "session_id": "s2"}));
        f.take();
        f.keeper.hook(&json!({"hook_event_name": "SessionEnd", "session_id": "s1"}));
        assert!(f.take().is_empty());
        f.keeper.set("mục tiêu mới");
        assert_eq!(f.goal("s2").unwrap(), "mục tiêu mới");
        assert_eq!(f.goal("s1").unwrap(), "Sửa lỗi resume mất scrollback");
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
    fn unusable_payloads_pin_nothing() {
        let f = Fixture::new();
        f.keeper.hook(&json!({}));
        f.keeper.hook(&json!("text"));
        for event in [
            json!({"hook_event_name": "UserPromptSubmit", "session_id": "s1"}),
            json!({"hook_event_name": "UserPromptSubmit", "session_id": "s1", "prompt": "  "}),
            json!({"hook_event_name": "UserPromptSubmit", "session_id": "s1", "prompt": 5}),
        ] {
            f.keeper.hook(&event);
        }
        assert!(f.take().is_empty());
        assert!(f.goal("s1").is_none());
    }

    #[test]
    fn prompt_without_session_id_uses_the_opened_session() {
        let f = Fixture::new();
        f.keeper
            .hook(&json!({"hook_event_name": "UserPromptSubmit", "prompt": "việc"}));
        assert_eq!(f.goal("s1").unwrap(), "việc");
    }

    #[test]
    fn poisoned_store_does_not_panic() {
        let f = Fixture::new();
        let store = f.store.clone();
        let _ = std::thread::spawn(move || {
            let _guard = store.lock().unwrap();
            panic!("poison");
        })
        .join();
        f.prompt("s1", "việc");
        f.keeper.set("khác");
        f.keeper.announce();
    }
}
