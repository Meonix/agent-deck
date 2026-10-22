## Why

CR-010 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-22): the Focus Reminder made Claude Code refuse
prompts it judged off-goal, which the PO found unhelpful; the PO wants to see the session's target and align by
themselves. The one-line grey Goal Line also hid most of a long first prompt. SRS v1.10, BRD v4.0, backlog item 25.

## What Changes

- **BREAKING**: the app no longer answers `UserPromptSubmit` with a Focus Reminder; every hook response is empty
  again and Claude Code gets the prompt unchanged (SRS-FR-094, SRS-FR-095, SRS-FR-098 removed).
- **BREAKING (UI)**: the Goal Line and its Edit Goal button are replaced by the Target Box — a red, multi-line
  text box below every pane header, up to 3 lines then scrolling, empty with a placeholder until the session has
  a Session Goal, edited in place and saved when it loses focus (SRS-FR-092, SRS-FR-093).
- An empty text is now a valid Session Goal: clearing the box keeps it empty, and text typed before the first
  prompt is not overwritten by that prompt (SRS-FR-091, SRS-FR-093).
- Unchanged: the goal store per session id across launches (SRS-FR-096), first prompt read from history on resume
  (SRS-FR-097), `/clear` starts a new session with an empty box.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-goal`: "Pin first prompt as session goal" (SRS-FR-091), "Edit session goal" (SRS-FR-093), "Keep
  session goal across launches" (SRS-FR-096), "Goal of a resumed session without a stored goal" (SRS-FR-097)
  modified; "Goal Line" removed and replaced by "Target Box" (SRS-FR-092); "Focus Reminder with each prompt",
  "Off-goal instruction", "Prompt goes through without reminder" removed (SRS-FR-094, SRS-FR-095, SRS-FR-098).

## Impact

- Rust: `src-tauri/src/session_goal.rs` loses `focus_reminder`, `reminder_body`; `GoalKeeper::hook` returns
  nothing and `GoalKeeper::set` stores an empty text. `src-tauri/src/hooks.rs`: `HookSink::hook` returns `()`,
  every response has an empty body, `UserPromptSubmit`'s output is discarded like the other events.
  `pane_commands.rs`, `pane_status.rs`: sinks follow the new signature.
- UI: `src/components/TerminalPane.tsx` — `GoalLine` replaced by `TargetBox`; always rendered.
- Tests: reminder tests in `session_goal.rs`, `hooks.rs` answer tests, the pane_commands reminder test and the
  `TerminalPane.test.tsx` Goal Line block are replaced.
- Data: `session-goals.json` keeps its format; values may now be `""`.
