## Why

BO-03 of the agent-deck BRD (v3.0, CR-007): each Claude Code session does one task only. Measured as ≥ 9/10
off-goal prompts flagged by Claude Code in the same reply and ≤ 1/10 in-scope prompts flagged by mistake, over the
2-week trial after the feature ships. BR-09 (Should): the user sees and edits the main task of every open session;
when the user sends a request that is a different task, Claude Code points it out and suggests a new session
instead of doing it, unless the user says to go ahead. Today a session drifts into a second and third task and
nothing in the app keeps it on the first one. Backlog item 22 (Should), after items 2, 3, 6 and 19, which built
the panes, the hook listener, resume and pane restore.

## What Changes

- The first prompt sent in a session that has no Session Goal becomes its Session Goal, also for the new session
  Claude Code starts after `/clear` (SRS-FR-091).
- A Goal Line under the pane header shows the Session Goal on one line, at most 80 characters, full text on hover,
  with an Edit Goal pencil button (SRS-FR-092).
- Edit Goal turns the Goal Line into a text field; Enter saves, Esc cancels, empty text keeps the old goal
  (SRS-FR-093).
- Each `UserPromptSubmit` hook of a session with a Session Goal is answered with a Focus Reminder as
  `additionalContext`: the goal (≤ 500 characters), RULE-09 and what to do with an off-goal prompt (SRS-FR-094,
  SRS-FR-095).
- Session Goals are stored by the app and survive a restart, a pane close and a resume (SRS-FR-096).
- Resuming a session without a stored goal takes the first prompt from the session's history file, read only
  (SRS-FR-097).
- When no Focus Reminder can be given, the prompt reaches Claude Code unchanged (SRS-FR-098).

## Capabilities

### New Capabilities

- `session-goal`: pin, show, edit and keep a Session Goal per session, and send the Focus Reminder with each
  prompt (SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098).

### Modified Capabilities

None. The pane header (SRS-FR-030), header double-click (SRS-FR-066, SRS-FR-067) and header drag (SRS-FR-080) keep
their wording: the Goal Line sits below the header and is not part of it.

## Impact

- Rust: `HookSink::hook` returns an optional response body; `hooks.rs` writes it as JSON for `UserPromptSubmit`
  only, every other answer stays empty. New `session_goal.rs` (goal store, Focus Reminder, per-pane goal keeper)
  and a first-prompt reader next to `session_list.rs`. `pane_commands.rs` registers a sink that feeds both the
  status tracker and the goal keeper, and adds a `set_session_goal` command. New file `session-goals.json` in the
  app data directory.
- UI: `sessions.ts` parses a `{"goal": …}` pane message; `useSessionPanes` keeps `goal` per pane;
  `TerminalPane` renders the Goal Line and its editor.
- No change to the status machine, `paneSnapshot` (`adOpenPanes`), dependencies, tokens or Claude Code's own files.
