use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum State {
    #[serde(rename = "Running")]
    Running,
    #[serde(rename = "Needs Approval")]
    NeedsApproval,
    #[serde(rename = "Idle")]
    Idle,
    #[serde(rename = "Error")]
    Error,
    #[serde(rename = "Ended")]
    Ended,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Signal {
    PromptSent,
    ApprovalRequested(String),
    ApprovalAnswered,
    TurnFinished,
    ErrorOccurred(String),
    ExitedNormally,
    ExitedAbnormally(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StatusChange {
    pub state: State,
    pub since: u64,
    pub reason: Option<String>,
}

pub struct StatusMachine {
    state: State,
    since: u64,
    reason: Option<String>,
}

impl StatusMachine {
    pub fn new(now: u64) -> Self {
        Self {
            state: State::Idle,
            since: now,
            reason: None,
        }
    }

    pub fn current(&self) -> StatusChange {
        StatusChange {
            state: self.state,
            since: self.since,
            reason: self.reason.clone(),
        }
    }

    /// `None` covers both "keep" cells and re-entry into the current state, so the
    /// card keeps showing when the wait began.
    pub fn apply(&mut self, signal: Signal, now: u64) -> Option<StatusChange> {
        use Signal::*;
        use State::*;
        let (target, reason) = match (self.state, signal) {
            (Ended, _) => return None,
            (_, ExitedNormally) => (Ended, None),
            (_, ExitedAbnormally(r)) | (_, ErrorOccurred(r)) => (Error, Some(r)),
            (Running | NeedsApproval, ApprovalRequested(r)) => (NeedsApproval, Some(r)),
            (_, ApprovalRequested(_)) => return None,
            (Running | NeedsApproval, TurnFinished) => (Idle, None),
            (_, TurnFinished) => return None,
            (NeedsApproval, ApprovalAnswered) => (Running, None),
            (_, ApprovalAnswered) => return None,
            (NeedsApproval, PromptSent) => return None,
            (_, PromptSent) => (Running, None),
        };
        if target == self.state {
            return None;
        }
        self.state = target;
        self.since = now;
        self.reason = reason;
        Some(self.current())
    }

    pub fn exit(&mut self, code: Option<i32>, now: u64) -> Option<StatusChange> {
        let signal = match code {
            Some(0) => Signal::ExitedNormally,
            Some(n) => Signal::ExitedAbnormally(format!("exit code {n}")),
            None => Signal::ExitedAbnormally("killed".into()),
        };
        self.apply(signal, now)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use State::*;

    fn signals() -> [Signal; 7] {
        [
            Signal::PromptSent,
            Signal::ApprovalRequested("Edit a".into()),
            Signal::ApprovalAnswered,
            Signal::TurnFinished,
            Signal::ErrorOccurred("overloaded".into()),
            Signal::ExitedNormally,
            Signal::ExitedAbnormally("killed".into()),
        ]
    }

    fn machine_in(state: State) -> StatusMachine {
        StatusMachine {
            state,
            since: 100,
            reason: match state {
                NeedsApproval => Some("Edit x".into()),
                Error => Some("boom".into()),
                _ => None,
            },
        }
    }

    // SRS section 5; None = "giu nguyen".
    #[test]
    fn transition_table_matches_srs() {
        let k = None;
        #[rustfmt::skip]
        let table: [(State, [Option<State>; 7]); 5] = [
            (Running,       [Some(Running), Some(NeedsApproval), k, Some(Idle), Some(Error), Some(Ended), Some(Error)]),
            (NeedsApproval, [k, Some(NeedsApproval), Some(Running), Some(Idle), Some(Error), Some(Ended), Some(Error)]),
            (Idle,          [Some(Running), k, k, k, Some(Error), Some(Ended), Some(Error)]),
            (Error,         [Some(Running), k, k, k, Some(Error), Some(Ended), Some(Error)]),
            (Ended,         [k, k, k, k, k, k, k]),
        ];
        for (from, row) in table {
            for (signal, expected) in signals().into_iter().zip(row) {
                let mut m = machine_in(from);
                let change = m.apply(signal.clone(), 500);
                let want = expected.unwrap_or(from);
                assert_eq!(m.current().state, want, "{from:?} + {signal:?}");
                match expected {
                    Some(to) if to != from => {
                        assert_eq!(change.map(|c| c.state), Some(to), "{from:?} + {signal:?}")
                    }
                    _ => assert_eq!(change, None, "{from:?} + {signal:?}"),
                }
            }
        }
    }

    #[test]
    fn change_is_reported_only_when_state_changes() {
        let mut m = machine_in(Idle);
        let change = m.apply(Signal::PromptSent, 500).unwrap();
        assert_eq!(
            change,
            StatusChange {
                state: Running,
                since: 500,
                reason: None
            }
        );
        assert_eq!(m.current(), change);
        assert_eq!(m.apply(Signal::TurnFinished, 600).unwrap().state, Idle);
        assert_eq!(m.apply(Signal::TurnFinished, 700), None);
    }

    #[test]
    fn needs_approval_and_error_carry_the_signal_reason() {
        let mut m = machine_in(Running);
        let c = m
            .apply(Signal::ApprovalRequested("Edit src/main.rs".into()), 5)
            .unwrap();
        assert_eq!(c.reason.as_deref(), Some("Edit src/main.rs"));
        let c = m
            .apply(Signal::ErrorOccurred("overloaded".into()), 6)
            .unwrap();
        assert_eq!((c.state, c.reason.as_deref()), (Error, Some("overloaded")));
        let c = m.apply(Signal::PromptSent, 7).unwrap();
        assert_eq!(c.reason, None);
    }

    #[test]
    fn reentry_keeps_since_and_reason() {
        let mut m = machine_in(NeedsApproval);
        assert_eq!(
            m.apply(Signal::ApprovalRequested("Bash ls".into()), 900),
            None
        );
        assert_eq!(m.current().since, 100);
        assert_eq!(m.current().reason.as_deref(), Some("Edit x"));

        let mut m = machine_in(Error);
        assert_eq!(m.apply(Signal::ErrorOccurred("other".into()), 900), None);
    }

    #[test]
    fn abnormal_exit_from_error_keeps_since_and_reason() {
        let mut m = machine_in(Error);
        assert_eq!(
            m.apply(Signal::ExitedAbnormally("killed".into()), 900),
            None
        );
        assert_eq!(m.current().since, 100);
        assert_eq!(m.current().reason.as_deref(), Some("boom"));
    }

    #[test]
    fn new_machine_is_idle() {
        let m = StatusMachine::new(42);
        assert_eq!(
            m.current(),
            StatusChange {
                state: Idle,
                since: 42,
                reason: None
            }
        );
    }

    #[test]
    fn exit_codes_map_to_ended_or_error() {
        let mut m = machine_in(Running);
        assert_eq!(m.exit(Some(0), 10).unwrap().state, Ended);

        let mut m = machine_in(Running);
        let c = m.exit(Some(3), 10).unwrap();
        assert_eq!((c.state, c.reason.as_deref()), (Error, Some("exit code 3")));

        let mut m = machine_in(Idle);
        let c = m.exit(None, 10).unwrap();
        assert_eq!((c.state, c.reason.as_deref()), (Error, Some("killed")));
    }

    #[test]
    fn failed_tool_while_running_stays_running() {
        let mut m = machine_in(Running);
        assert_eq!(m.apply(Signal::ApprovalAnswered, 50), None);
        assert_eq!(m.current().state, Running);
    }

    #[test]
    fn error_then_prompt_returns_to_running() {
        let mut m = machine_in(Error);
        assert_eq!(m.apply(Signal::PromptSent, 50).unwrap().state, Running);
    }

    #[test]
    fn ended_ignores_everything() {
        let mut m = machine_in(Ended);
        for s in signals() {
            assert_eq!(m.apply(s, 999), None);
        }
        assert_eq!(m.exit(Some(1), 999), None);
        assert_eq!(m.current().since, 100);
    }
}
