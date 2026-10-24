use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};

use crate::session_progress::{
    ProgressRecord, ProgressStore, Tracking, TrackingState, condense, merge,
};
use crate::summarizer::{Summarizer, prompt};

/// The pane's message stream, as for `GoalOut`: `{"progress": {...}}`.
pub trait ProgressOut: Send + Sync {
    fn send_json(&self, json: String);
}

/// Claude Code's history file of a session, whole.
pub trait History: Send + Sync {
    fn read(&self, session: &str) -> Option<Vec<u8>>;
}

/// History files under `~/.claude/projects`.
pub struct ProjectsHistory(pub PathBuf);

impl History for ProjectsHistory {
    fn read(&self, session: &str) -> Option<Vec<u8>> {
        let file = crate::session_title::find_session_file(&self.0, session)?;
        std::fs::read(file).ok()
    }
}

/// Where an update run executes; production gives each run its own thread.
pub trait Runner: Send + Sync {
    fn run(&self, job: Box<dyn FnOnce() + Send>);
}

pub struct ThreadRunner;

impl Runner for ThreadRunner {
    fn run(&self, job: Box<dyn FnOnce() + Send>) {
        std::thread::spawn(job);
    }
}

pub type GoalSource = Arc<dyn Fn(&str) -> Option<String> + Send + Sync>;

/// What every keeper of the app shares.
#[derive(Clone)]
pub struct ProgressDeps {
    pub store: Arc<Mutex<ProgressStore>>,
    pub summarizer: Arc<dyn Summarizer>,
    pub history: Arc<dyn History>,
    pub goal: GoalSource,
    pub runner: Arc<dyn Runner>,
}

/// Runtime-only state of one session's updates; never stored.
#[derive(Default)]
struct Runs {
    running: bool,
    pending: bool,
    updating: bool,
    failed: bool,
}

struct State {
    session: String,
    opened_new: bool,
    runs: HashMap<String, Runs>,
}

struct Inner {
    deps: ProgressDeps,
    state: Mutex<State>,
    out: Box<dyn ProgressOut>,
}

/// One pane's progress logic (D2, D3). Messages are sent while the state lock is held, so they
/// leave in order; the summary itself runs with no lock held.
pub struct ProgressKeeper {
    inner: Arc<Inner>,
}

impl ProgressKeeper {
    pub fn new(
        deps: ProgressDeps,
        session_id: String,
        opened_new: bool,
        out: Box<dyn ProgressOut>,
    ) -> Self {
        ProgressKeeper {
            inner: Arc::new(Inner {
                deps,
                state: Mutex::new(State {
                    session: session_id,
                    opened_new,
                    runs: HashMap::new(),
                }),
                out,
            }),
        }
    }

    pub fn announce(&self) {
        if let Ok(state) = self.inner.state.lock() {
            self.inner.send(&state);
        }
    }

    /// Follows the `session_id` of any event but `SessionEnd`, as `GoalKeeper` does; a session
    /// started by `/clear` takes the previous one's choice (SRS-FR-131).
    pub fn hook(&self, event: &Value) {
        if event["hook_event_name"] == "SessionEnd" {
            return;
        }
        let start = {
            let Ok(mut state) = self.inner.state.lock() else {
                return;
            };
            if let Some(id) = event["session_id"].as_str().filter(|id| !id.is_empty())
                && id != state.session
            {
                self.inner.inherit(&state, id);
                state.session = id.to_string();
                self.inner.send(&state);
            }
            if event["hook_event_name"] == "Stop"
                && self.inner.tracking(&state) == TrackingState::On
            {
                self.inner.schedule(&mut state)
            } else {
                None
            }
        };
        if let Some(session) = start {
            self.start(session);
        }
    }

    /// Turning on summarises from the stored offset, which is 0 the first time (SRS-FR-117).
    pub fn set_tracking(&self, on: bool) {
        let start = {
            let Ok(mut state) = self.inner.state.lock() else {
                return;
            };
            let tracking = if on { Tracking::On } else { Tracking::Off };
            let session = state.session.clone();
            let stored =
                self.inner
                    .update_record(&session, |record| record.tracking = tracking, true);
            let start = if stored && on {
                self.inner.schedule(&mut state)
            } else {
                None
            };
            self.inner.send(&state);
            start
        };
        if let Some(session) = start {
            self.start(session);
        }
    }

    pub fn set_collapsed(&self, collapsed: bool) {
        let Ok(state) = self.inner.state.lock() else {
            return;
        };
        self.inner.update_record(
            &state.session,
            |record| {
                record.collapsed = collapsed;
            },
            false,
        );
        self.inner.send(&state);
    }

    /// Called with no lock held: a runner may run the job at once.
    fn start(&self, session: String) {
        let inner = self.inner.clone();
        self.inner
            .deps
            .runner
            .run(Box::new(move || inner.run(&session)));
    }
}

impl Inner {
    fn tracking(&self, state: &State) -> TrackingState {
        self.deps.store.lock().map_or(TrackingState::Off, |s| {
            s.tracking_for(&state.session, state.opened_new)
        })
    }

    fn inherit(&self, state: &State, new_session: &str) {
        let tracking = match self.tracking(state) {
            TrackingState::On => Tracking::On,
            TrackingState::Off => Tracking::Off,
            TrackingState::Unset => return,
        };
        let Ok(mut store) = self.deps.store.lock() else {
            return;
        };
        if store.get(new_session).is_none() {
            store.set(
                new_session,
                ProgressRecord {
                    tracking,
                    checkpoints: Vec::new(),
                    collapsed: false,
                    offset: 0,
                },
            );
        }
    }

    /// Applies `change` to the session's record; with `create`, a missing record starts empty.
    fn update_record(
        &self,
        session: &str,
        change: impl FnOnce(&mut ProgressRecord),
        create: bool,
    ) -> bool {
        let Ok(mut store) = self.deps.store.lock() else {
            return false;
        };
        let mut record = match store.get(session) {
            Some(record) => record,
            None if create => ProgressRecord {
                tracking: Tracking::Off,
                checkpoints: Vec::new(),
                collapsed: false,
                offset: 0,
            },
            None => return false,
        };
        change(&mut record);
        store.set(session, record);
        true
    }

    /// Single flight per session: the session to start a run for, or None when one is in flight
    /// and will run once more.
    fn schedule(&self, state: &mut State) -> Option<String> {
        let session = state.session.clone();
        let runs = state.runs.entry(session.clone()).or_default();
        if runs.running {
            runs.pending = true;
            None
        } else {
            runs.running = true;
            Some(session)
        }
    }

    fn run(&self, session: &str) {
        loop {
            self.run_once(session);
            let Ok(mut state) = self.state.lock() else {
                return;
            };
            let on = self
                .deps
                .store
                .lock()
                .is_ok_and(|s| s.tracking_for(session, false) == TrackingState::On);
            let runs = state.runs.entry(session.to_string()).or_default();
            if runs.pending && on {
                runs.pending = false;
                continue;
            }
            runs.pending = false;
            runs.running = false;
            if std::mem::take(&mut runs.updating) {
                self.send_for(&state, session);
            }
            return;
        }
    }

    /// Summarises each new chunk in turn and stores it; the first failure stops the run with the
    /// list and offset of the last good chunk (SRS-FR-128).
    fn run_once(&self, session: &str) {
        let Some(offset) = self.record(session).map(|r| r.offset) else {
            return;
        };
        let Some(bytes) = self.deps.history.read(session) else {
            return;
        };
        let chunks = condense(&bytes, offset);
        if chunks.is_empty() {
            return;
        }
        {
            let Ok(mut state) = self.state.lock() else {
                return;
            };
            let runs = state.runs.entry(session.to_string()).or_default();
            if !std::mem::replace(&mut runs.updating, true) {
                self.send_for(&state, session);
            }
        }
        let goal = (self.deps.goal)(session);
        for chunk in chunks {
            let Some(current) = self.record(session).map(|r| r.checkpoints) else {
                return;
            };
            let answer =
                self.deps
                    .summarizer
                    .summarize(&prompt(goal.as_deref(), &current, &chunk.text));
            let proposed = match answer {
                Ok(proposed) => proposed,
                Err(e) => {
                    crate::diag::error("session_progress", &e.to_string());
                    self.mark(session, |runs| runs.failed = true);
                    return;
                }
            };
            let merged = merge(&current, proposed, &chunk.first_time);
            // A record deleted meanwhile (the session went to the Trash) is not brought back.
            let kept = self.update_record(
                session,
                |record| {
                    record.checkpoints = merged;
                    record.offset = chunk.end_offset;
                },
                false,
            );
            if !kept {
                return;
            }
            self.mark(session, |runs| runs.failed = false);
        }
    }

    fn record(&self, session: &str) -> Option<ProgressRecord> {
        self.deps.store.lock().ok()?.get(session)
    }

    /// Changes the session's runtime flags and sends the new state.
    fn mark(&self, session: &str, change: impl FnOnce(&mut Runs)) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        change(state.runs.entry(session.to_string()).or_default());
        self.send_for(&state, session);
    }

    /// A run of a session the pane has left by `/clear` stores its result but shows nothing.
    fn send_for(&self, state: &State, session: &str) {
        if state.session == session {
            self.send(state);
        }
    }

    fn send(&self, state: &State) {
        let (tracking, record) = match self.deps.store.lock() {
            Ok(store) => (
                store.tracking_for(&state.session, state.opened_new),
                store.get(&state.session),
            ),
            Err(_) => return,
        };
        let runs = state.runs.get(&state.session);
        let (checkpoints, collapsed) =
            record.map_or((Vec::new(), false), |r| (r.checkpoints, r.collapsed));
        let message = json!({
            "progress": {
                "tracking": tracking,
                "checkpoints": checkpoints,
                "collapsed": collapsed,
                "updating": runs.is_some_and(|r| r.updating),
                "failed": runs.is_some_and(|r| r.failed),
            }
        });
        self.out.send_json(message.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    use serde_json::json;
    use tempfile::tempdir;

    use crate::session_progress::{Checkpoint, ProgressRecord, Tracking};
    use crate::summarizer::SummaryError;

    type Job = Box<dyn FnOnce() + Send>;

    #[derive(Clone, Default)]
    struct Outbox(Arc<Mutex<Vec<String>>>);

    impl ProgressOut for Outbox {
        fn send_json(&self, json: String) {
            self.0.lock().unwrap().push(json);
        }
    }

    #[derive(Default)]
    struct FakeHistory(Mutex<std::collections::HashMap<String, Vec<u8>>>);

    impl FakeHistory {
        fn append(&self, session: &str, text: &str) {
            self.0
                .lock()
                .unwrap()
                .entry(session.into())
                .or_default()
                .extend_from_slice(text.as_bytes());
        }

        fn len(&self, session: &str) -> u64 {
            self.0.lock().unwrap().get(session).map_or(0, |b| b.len()) as u64
        }
    }

    impl History for FakeHistory {
        fn read(&self, session: &str) -> Option<Vec<u8>> {
            self.0.lock().unwrap().get(session).cloned()
        }
    }

    /// Answers from a script; `during` runs inside the first call, as a turn finishing mid-run.
    #[derive(Default)]
    struct FakeSummarizer {
        answers: Mutex<VecDeque<Result<Vec<Checkpoint>, SummaryError>>>,
        prompts: Mutex<Vec<String>>,
        during: Mutex<Option<Job>>,
    }

    impl Summarizer for FakeSummarizer {
        fn summarize(&self, prompt: &str) -> Result<Vec<Checkpoint>, SummaryError> {
            self.prompts.lock().unwrap().push(prompt.to_string());
            let during = self.during.lock().unwrap().take();
            if let Some(during) = during {
                during();
            }
            self.answers
                .lock()
                .unwrap()
                .pop_front()
                .unwrap_or(Err(SummaryError::Timeout))
        }
    }

    /// Holds runs until the test lets them go, so every test is deterministic.
    #[derive(Default)]
    struct QueuedRunner(Mutex<Vec<Job>>);

    impl Runner for QueuedRunner {
        fn run(&self, job: Job) {
            self.0.lock().unwrap().push(job);
        }
    }

    struct Fixture {
        _dir: tempfile::TempDir,
        store: Arc<Mutex<ProgressStore>>,
        summarizer: Arc<FakeSummarizer>,
        history: Arc<FakeHistory>,
        runner: Arc<QueuedRunner>,
        sent: Outbox,
        keeper: Arc<ProgressKeeper>,
    }

    impl Fixture {
        fn new(opened_new: bool) -> Self {
            let dir = tempdir().unwrap();
            let store = Arc::new(Mutex::new(ProgressStore::load(dir.path().to_path_buf())));
            let summarizer = Arc::new(FakeSummarizer::default());
            let history = Arc::new(FakeHistory::default());
            let runner = Arc::new(QueuedRunner::default());
            let sent = Outbox::default();
            let deps = ProgressDeps {
                store: store.clone(),
                summarizer: summarizer.clone(),
                history: history.clone(),
                goal: Arc::new(|s: &str| (s == "s1").then(|| "Ship stash".to_string())),
                runner: runner.clone(),
            };
            let keeper = Arc::new(ProgressKeeper::new(
                deps,
                "s1".into(),
                opened_new,
                Box::new(sent.clone()),
            ));
            Fixture {
                _dir: dir,
                store,
                summarizer,
                history,
                runner,
                sent,
                keeper,
            }
        }

        fn seed(
            &self,
            session: &str,
            tracking: Tracking,
            checkpoints: Vec<Checkpoint>,
            offset: u64,
        ) {
            self.store.lock().unwrap().set(
                session,
                ProgressRecord {
                    tracking,
                    checkpoints,
                    collapsed: false,
                    offset,
                },
            );
        }

        fn answer(&self, answer: Result<Vec<Checkpoint>, SummaryError>) {
            self.summarizer.answers.lock().unwrap().push_back(answer);
        }

        fn stop(&self, session: &str) {
            self.keeper
                .hook(&json!({"hook_event_name": "Stop", "session_id": session}));
        }

        fn queued(&self) -> usize {
            self.runner.0.lock().unwrap().len()
        }

        fn run_queued(&self) {
            loop {
                let jobs: Vec<Job> = self.runner.0.lock().unwrap().drain(..).collect();
                if jobs.is_empty() {
                    return;
                }
                for job in jobs {
                    job();
                }
            }
        }

        fn prompts(&self) -> Vec<String> {
            self.summarizer.prompts.lock().unwrap().clone()
        }

        fn take(&self) -> Vec<Value> {
            self.sent
                .0
                .lock()
                .unwrap()
                .drain(..)
                .map(|m| serde_json::from_str::<Value>(&m).unwrap()["progress"].clone())
                .collect()
        }

        fn record(&self, session: &str) -> Option<ProgressRecord> {
            self.store.lock().unwrap().get(session)
        }
    }

    fn cp(summary: &str, done: bool, at: &str) -> Checkpoint {
        Checkpoint {
            summary: summary.into(),
            result: String::new(),
            done,
            started_at: at.into(),
        }
    }

    fn turn(ts: &str, prompt: &str) -> String {
        format!(
            "{}\n",
            json!({"type": "user", "timestamp": ts, "message": {"content": prompt}})
        )
    }

    fn state(tracking: &str, checkpoints: Value, updating: bool, failed: bool) -> Value {
        json!({
            "tracking": tracking,
            "checkpoints": checkpoints,
            "collapsed": false,
            "updating": updating,
            "failed": failed,
        })
    }

    // 3.1

    #[test]
    fn stop_with_tracking_on_runs_once_and_sends_the_new_list() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.history
            .append("s1", &turn("2026-10-25T09:05:00Z", "add the stash button"));
        f.answer(Ok(vec![cp("Add stash button", false, "09:05")]));

        f.stop("s1");
        assert_eq!(f.queued(), 1);
        f.run_queued();

        assert_eq!(f.prompts().len(), 1);
        assert!(f.prompts()[0].contains("Ship stash"));
        assert!(f.prompts()[0].contains("user: add the stash button"));
        let list = json!([{"summary": "Add stash button", "result": "", "done": false, "startedAt": "09:05"}]);
        assert_eq!(
            f.take(),
            [
                state("on", json!([]), true, false),
                state("on", list.clone(), true, false),
                state("on", list, false, false)
            ]
        );
        let record = f.record("s1").unwrap();
        assert_eq!(record.checkpoints, [cp("Add stash button", false, "09:05")]);
        assert_eq!(record.offset, f.history.len("s1"));
    }

    #[test]
    fn stop_with_tracking_off_or_unset_runs_nothing() {
        let f = Fixture::new(true);
        f.history.append("s1", &turn("2026-10-25T09:05:00Z", "x"));
        f.stop("s1");
        f.seed("s2", Tracking::Off, vec![], 0);
        f.history.append("s2", &turn("2026-10-25T09:05:00Z", "y"));
        f.stop("s2");
        assert_eq!(f.queued(), 0);
        f.run_queued();
        assert!(f.prompts().is_empty());
        assert!(f.record("s1").is_none());
    }

    #[test]
    fn nothing_new_runs_no_summary_and_sends_nothing() {
        let f = Fixture::new(true);
        let text = turn("2026-10-25T09:05:00Z", "x");
        f.history.append("s1", &text);
        f.seed(
            "s1",
            Tracking::On,
            vec![cp("a", false, "09:05")],
            text.len() as u64,
        );
        f.stop("s1");
        f.run_queued();
        assert!(f.prompts().is_empty());
        assert!(f.take().is_empty());
    }

    #[test]
    fn stops_during_a_run_coalesce_into_one_more_run() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.history
            .append("s1", &turn("2026-10-25T09:05:00Z", "first"));
        f.answer(Ok(vec![cp("First", false, "09:05")]));
        f.answer(Ok(vec![
            cp("First", true, "09:05"),
            cp("Second", false, "09:30"),
        ]));
        let keeper = f.keeper.clone();
        let history = f.history.clone();
        *f.summarizer.during.lock().unwrap() = Some(Box::new(move || {
            history.append("s1", &turn("2026-10-25T09:30:00Z", "second"));
            for _ in 0..3 {
                keeper.hook(&json!({"hook_event_name": "Stop", "session_id": "s1"}));
            }
        }));

        f.stop("s1");
        f.run_queued();

        let prompts = f.prompts();
        assert_eq!(prompts.len(), 2);
        assert!(!prompts[1].contains("user: first"));
        assert!(prompts[1].contains("user: second"));
        let record = f.record("s1").unwrap();
        assert_eq!(
            record.checkpoints,
            [cp("First", true, "09:05"), cp("Second", false, "09:30")]
        );
        assert_eq!(record.offset, f.history.len("s1"));
        let sent: Vec<(bool, usize)> = f
            .take()
            .iter()
            .map(|s| {
                (
                    s["updating"] == true,
                    s["checkpoints"].as_array().unwrap().len(),
                )
            })
            .collect();
        assert_eq!(sent, [(true, 0), (true, 1), (true, 2), (false, 2)]);
    }

    #[test]
    fn failure_keeps_the_list_and_sends_failed_until_a_success() {
        let f = Fixture::new(true);
        let old = vec![cp("a", true, "09:00"), cp("b", false, "09:10")];
        f.seed("s1", Tracking::On, old.clone(), 0);
        f.history
            .append("s1", &turn("2026-10-25T09:20:00Z", "more"));
        f.answer(Err(SummaryError::Exit(Some(1))));

        f.stop("s1");
        f.run_queued();

        let record = f.record("s1").unwrap();
        assert_eq!(record.checkpoints, old);
        assert_eq!(record.offset, 0);
        let last = f.take().pop().unwrap();
        assert_eq!(last["failed"], true);
        assert_eq!(last["updating"], false);
        assert_eq!(last["checkpoints"].as_array().unwrap().len(), 2);

        f.answer(Ok(vec![cp("a", true, "09:00"), cp("b", true, "09:10")]));
        f.stop("s1");
        f.run_queued();
        let last = f.take().pop().unwrap();
        assert_eq!(last["failed"], false);
        assert!(f.record("s1").unwrap().checkpoints[1].done);
    }

    #[test]
    fn turning_off_during_a_run_keeps_its_result_and_drops_the_pending_run() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.history
            .append("s1", &turn("2026-10-25T09:05:00Z", "first"));
        f.answer(Ok(vec![cp("First", false, "09:05")]));
        let keeper = f.keeper.clone();
        let history = f.history.clone();
        *f.summarizer.during.lock().unwrap() = Some(Box::new(move || {
            history.append("s1", &turn("2026-10-25T09:30:00Z", "second"));
            keeper.hook(&json!({"hook_event_name": "Stop", "session_id": "s1"}));
            keeper.set_tracking(false);
        }));

        f.stop("s1");
        f.run_queued();

        assert_eq!(f.prompts().len(), 1);
        let record = f.record("s1").unwrap();
        assert_eq!(record.tracking, Tracking::Off);
        assert_eq!(record.checkpoints, [cp("First", false, "09:05")]);
        let last = f.take().pop().unwrap();
        assert_eq!(last["tracking"], "off");
        assert_eq!(last["updating"], false);

        f.stop("s1");
        assert_eq!(f.queued(), 0);
    }

    // 3.2

    fn long_history(f: &Fixture, session: &str, turns: usize) {
        for i in 0..turns {
            f.history.append(
                session,
                &turn(
                    &format!("2026-10-25T09:{i:02}:00Z"),
                    &format!("{i} {}", "p".repeat(9_000)),
                ),
            );
        }
    }

    #[test]
    fn turning_on_with_history_runs_from_the_start_over_every_chunk() {
        let f = Fixture::new(false);
        long_history(&f, "s1", 6);
        f.answer(Ok(vec![cp("One", false, "09:00")]));
        f.answer(Ok(vec![
            cp("One", true, "09:00"),
            cp("Two", false, "09:05"),
        ]));

        f.keeper.set_tracking(true);
        assert_eq!(f.take(), [state("on", json!([]), false, false)]);
        f.run_queued();

        let prompts = f.prompts();
        assert_eq!(prompts.len(), 2);
        assert!(prompts[0].contains("user: 0 "));
        assert!(prompts[1].contains("user: 5 "));
        assert!(!prompts[1].contains("user: 0 "));
        assert!(prompts[1].contains("\"One\""));
        let record = f.record("s1").unwrap();
        assert_eq!(
            record.checkpoints,
            [cp("One", true, "09:00"), cp("Two", false, "09:05")]
        );
        assert_eq!(record.offset, f.history.len("s1"));
        let sent = f.take();
        let lists: Vec<usize> = sent
            .iter()
            .map(|s| s["checkpoints"].as_array().unwrap().len())
            .collect();
        assert_eq!(lists, [0, 1, 2, 2]);
    }

    #[test]
    fn a_failed_chunk_stops_the_run_and_keeps_the_offset_of_the_last_good_one() {
        let f = Fixture::new(false);
        long_history(&f, "s1", 6);
        f.answer(Ok(vec![cp("One", false, "09:00")]));
        f.answer(Err(SummaryError::Timeout));
        f.keeper.set_tracking(true);
        f.run_queued();
        let record = f.record("s1").unwrap();
        assert_eq!(record.checkpoints, [cp("One", false, "09:00")]);
        assert!(record.offset > 0 && record.offset < f.history.len("s1"));
        assert_eq!(f.take().pop().unwrap()["failed"], true);
    }

    #[test]
    fn turning_on_again_summarises_only_after_the_stored_offset() {
        let f = Fixture::new(false);
        let old_text = turn("2026-10-25T09:00:00Z", "old work");
        f.history.append("s1", &old_text);
        f.history
            .append("s1", &turn("2026-10-25T10:00:00Z", "new work"));
        let kept = vec![
            cp("a", true, "09:00"),
            cp("b", true, "09:01"),
            cp("c", false, "09:02"),
        ];
        f.seed("s1", Tracking::Off, kept.clone(), old_text.len() as u64);
        f.answer(Ok(vec![]));

        f.keeper.set_tracking(true);
        f.run_queued();

        let prompts = f.prompts();
        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("user: new work"));
        assert!(!prompts[0].contains("old work"));
        let record = f.record("s1").unwrap();
        assert_eq!(record.checkpoints, kept);
        assert_eq!(record.tracking, Tracking::On);
    }

    #[test]
    fn clear_gives_the_new_session_the_tracking_choice_and_an_empty_list() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![cp("a", false, "09:00")], 10);
        f.keeper
            .hook(&json!({"hook_event_name": "SessionStart", "session_id": "s2"}));
        assert_eq!(f.take(), [state("on", json!([]), false, false)]);
        let record = f.record("s2").unwrap();
        assert_eq!(
            (record.tracking, record.checkpoints.len(), record.offset),
            (Tracking::On, 0, 0)
        );
        assert_eq!(f.record("s1").unwrap().checkpoints.len(), 1);

        f.keeper.set_tracking(false);
        f.take();
        f.keeper
            .hook(&json!({"hook_event_name": "SessionStart", "session_id": "s3"}));
        assert_eq!(f.take(), [state("off", json!([]), false, false)]);
        assert_eq!(f.record("s3").unwrap().tracking, Tracking::Off);
    }

    #[test]
    fn clear_of_an_unanswered_session_writes_no_record() {
        let f = Fixture::new(true);
        f.keeper
            .hook(&json!({"hook_event_name": "SessionStart", "session_id": "s2"}));
        assert_eq!(f.take(), [state("unset", json!([]), false, false)]);
        assert!(f.record("s2").is_none());
    }

    #[test]
    fn clear_keeps_an_existing_record_of_the_new_session() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.seed("s2", Tracking::Off, vec![cp("x", true, "08:00")], 5);
        f.keeper
            .hook(&json!({"hook_event_name": "Stop", "session_id": "s2"}));
        assert_eq!(f.record("s2").unwrap().tracking, Tracking::Off);
        assert_eq!(f.queued(), 0);
    }

    #[test]
    fn session_end_does_not_switch_the_session() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.keeper
            .hook(&json!({"hook_event_name": "SessionEnd", "session_id": "s9"}));
        assert!(f.take().is_empty());
        assert!(f.record("s9").is_none());
    }

    #[test]
    fn announce_sends_unset_off_or_the_stored_record() {
        let f = Fixture::new(true);
        f.keeper.announce();
        assert_eq!(f.take(), [state("unset", json!([]), false, false)]);

        let resumed = Fixture::new(false);
        resumed.keeper.announce();
        assert_eq!(resumed.take(), [state("off", json!([]), false, false)]);

        resumed.store.lock().unwrap().set(
            "s1",
            ProgressRecord {
                tracking: Tracking::On,
                checkpoints: vec![cp("a", true, "09:00")],
                collapsed: true,
                offset: 3,
            },
        );
        resumed.keeper.announce();
        assert_eq!(
            resumed.take(),
            [json!({
                "tracking": "on",
                "checkpoints": [{"summary": "a", "result": "", "done": true, "startedAt": "09:00"}],
                "collapsed": true,
                "updating": false,
                "failed": false,
            })]
        );
    }

    #[test]
    fn declining_stores_off_and_runs_nothing() {
        let f = Fixture::new(true);
        f.history.append("s1", &turn("2026-10-25T09:05:00Z", "x"));
        f.keeper.set_tracking(false);
        assert_eq!(f.take(), [state("off", json!([]), false, false)]);
        assert_eq!(f.record("s1").unwrap().tracking, Tracking::Off);
        f.stop("s1");
        assert_eq!(f.queued(), 0);
    }

    #[test]
    fn set_collapsed_stores_and_sends() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![cp("a", false, "09:00")], 0);
        f.keeper.set_collapsed(true);
        let sent = f.take();
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0]["collapsed"], true);
        assert!(f.record("s1").unwrap().collapsed);
    }

    #[test]
    fn a_run_of_a_session_left_by_clear_stores_its_result_but_sends_nothing() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.history.append("s1", &turn("2026-10-25T09:05:00Z", "x"));
        f.answer(Ok(vec![cp("X", false, "09:05")]));
        f.stop("s1");
        f.keeper
            .hook(&json!({"hook_event_name": "SessionStart", "session_id": "s2"}));
        f.take();
        f.run_queued();
        assert!(f.take().is_empty());
        assert_eq!(f.record("s1").unwrap().checkpoints.len(), 1);
    }

    #[test]
    fn a_deleted_record_is_not_brought_back_by_a_run() {
        let f = Fixture::new(true);
        f.seed("s1", Tracking::On, vec![], 0);
        f.history.append("s1", &turn("2026-10-25T09:05:00Z", "x"));
        let store = f.store.clone();
        *f.summarizer.during.lock().unwrap() = Some(Box::new(move || {
            store.lock().unwrap().remove("s1");
        }));
        f.answer(Ok(vec![cp("X", false, "09:05")]));
        f.stop("s1");
        f.run_queued();
        assert!(f.record("s1").is_none());
    }
}
