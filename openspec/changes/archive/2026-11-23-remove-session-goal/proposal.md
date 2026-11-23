## Why

CR-015 (BRD v6.0, SRS v1.15): the user no longer wants the red Target Box under each pane header. BO-03 and BR-09
are deleted, so the Session Goal behind it goes too: pinning the first prompt, editing in the box, keeping goals
across launches and reading the first prompt of a resumed session. Backlog item 32, after item 31
(remove-session-progress), which removed the only other reader of the Session Goal.

## What Changes

- **BREAKING** Remove the Target Box and the Session Goal (SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-096,
  SRS-FR-097, all `Deleted (CR-015)`).
- `session-goals.json` already on the user's disk stays untouched; the app stops reading and writing it.

## Success Criteria

- SC-1 A pane shows no "Session target" text box, with or without a goal on its entry, for a new and a resumed
  session.
- SC-2 The sessions client exposes no `setGoal` and no `onGoal`, and a `{"goal": …}` message reaches no callback.
- SC-3 `grep` finds no `GoalStore`, `GoalKeeper`, `session_goal`, `set_session_goal`, `pin_first_prompt`,
  `first_prompt`, `TargetBox` or `onGoal` in non-test files under `src` and `src-tauri/src`.
- SC-4 An existing `session-goals.json` in the app data folder is byte-identical after the app starts.

## Capabilities

### New Capabilities

### Modified Capabilities

- `session-goal`: every requirement removed.

## Impact

- Frontend: `TargetBox` and `goal` removed from `TerminalPane.tsx`; `onGoal`/`setGoal` removed from
  `src/api/sessions.ts`, `useSessionPanes.ts`, `App.tsx`, `src/test/fakes.ts` and tests.
- Backend: `session_goal.rs` deleted; `set_session_goal`, `pin_first_prompt`, `ChannelGoal`, `GoalOut`,
  `AppState.goals`, `PaneProcess::set_goal`, `PaneRegistry::set_goal` removed; `first_prompt` and its helpers in
  `session_list.rs` removed (no other caller).
- Out of scope: the `--goal` colour token in `design/agent-deck/` (owned by `design-ui`), status latency (item 33).
