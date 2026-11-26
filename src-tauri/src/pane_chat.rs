//! A pane's Chat feed: tails the transcript of the pane's session and sends `{"chat"}`
//! messages on the pane channel (SRS-FR-150, SRS-FR-151).

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};

use crate::pane_status::StatusOut;
use crate::transcript::{ChatItem, POLL_INTERVAL, Tail, TailThread, TailUpdate, expected_path};

const CHUNK: usize = 500;

pub(crate) struct PaneChat {
    projects_dir: PathBuf,
    cwd: PathBuf,
    out: Arc<dyn StatusOut>,
    state: Mutex<State>,
}

struct State {
    session: String,
    path: PathBuf,
    thread: Option<TailThread>,
    stopped: bool,
}

impl PaneChat {
    pub(crate) fn new(
        projects_dir: &Path,
        cwd: &Path,
        session_id: &str,
        out: Arc<dyn StatusOut>,
    ) -> Self {
        PaneChat {
            projects_dir: projects_dir.to_path_buf(),
            cwd: cwd.to_path_buf(),
            out,
            state: Mutex::new(State {
                session: session_id.to_string(),
                path: expected_path(projects_dir, cwd, session_id),
                thread: None,
                stopped: false,
            }),
        }
    }

    /// Starts tailing the current path; a hook that came before is already applied to it.
    pub(crate) fn start(&self) {
        let mut state = self.state.lock().unwrap();
        if state.stopped || state.thread.is_some() {
            return;
        }
        let out = self.out.clone();
        state.thread = Some(TailThread::spawn(
            Tail::new(state.path.clone(), self.cwd.clone()),
            POLL_INTERVAL,
            Box::new(move |update| send(out.as_ref(), update)),
        ));
    }

    /// Moves the tail to the transcript a hook event names, or to the expected file of a
    /// new session.
    pub(crate) fn follow(&self, event: &Value) {
        let Some(id) = reported_session(event) else {
            return;
        };
        let reported = event["transcript_path"]
            .as_str()
            .filter(|p| !p.is_empty())
            .map(PathBuf::from);
        let mut state = self.state.lock().unwrap();
        let target = if state.session != id {
            state.session = id.to_string();
            reported.unwrap_or_else(|| expected_path(&self.projects_dir, &self.cwd, id))
        } else if let Some(path) = reported {
            path
        } else {
            return;
        };
        if target == state.path {
            return;
        }
        state.path = target.clone();
        if let Some(thread) = &state.thread {
            thread.switch(target);
        }
    }

    /// Returns once the tail thread has ended; nothing is sent after that.
    pub(crate) fn stop(&self) {
        let thread = {
            let mut state = self.state.lock().unwrap();
            state.stopped = true;
            state.thread.take()
        };
        if let Some(thread) = thread {
            thread.stop();
        }
    }
}

/// The session a hook event names, unless it is a `SessionEnd`: that names the session
/// being left and can arrive after the next one started.
pub(crate) fn reported_session(event: &Value) -> Option<&str> {
    if event["hook_event_name"] == "SessionEnd" {
        return None;
    }
    event["session_id"].as_str().filter(|id| !id.is_empty())
}

fn send(out: &dyn StatusOut, update: TailUpdate) {
    match update {
        TailUpdate::Reset(items) => send_items(out, &items, true),
        TailUpdate::Append(items) => send_items(out, &items, false),
        TailUpdate::Unreadable => out.send_json(json!({"chat": {"unreadable": true}}).to_string()),
    }
}

fn send_items(out: &dyn StatusOut, items: &[ChatItem], reset: bool) {
    let mut chunks = items.chunks(CHUNK);
    if reset {
        let first = chunks.next().unwrap_or(&[]);
        out.send_json(json!({"chat": {"reset": true, "items": first}}).to_string());
    }
    for chunk in chunks {
        out.send_json(json!({"chat": {"items": chunk}}).to_string());
    }
}
