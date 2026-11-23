# Tasks

## 1. Remove the Target Box and the goal client (SRS-FR-092, SRS-FR-093)

- [x] 1.1 Delete the old tests first: "Target Box (SRS-FR-092)" describe in `src/components/TerminalPane.test.tsx`, "goal messages (SRS-FR-092)" in `src/api/sessions.test.ts`, and the `stream.onGoal(seen)` line in the CR-015 progress test. Add RED tests: (a) `TerminalPane` given an entry carrying `goal: "Fix resume"` and one carrying `goal: null` shows no textbox "Session target" (SC-1); (b) `tauriSessionsClient` has no `setGoal`, its stream has no `onGoal`, and a `{"goal": "x"}` message reaches none of `onOutput`/`onExit`/`onStatus`/`onSession` (SC-2). Verify: (a) and the setGoal/onGoal check fail; the goal-message check passes before and after (it guards against a catch-all routing unknown messages to output).
- [x] 1.2 Remove `TargetBox`, `goal` in `PaneEntry`, `onSetGoal` from `TerminalPane.tsx`; `onGoal` wiring, `goal: null` and `setGoal` from `useSessionPanes.ts`; the `onSetGoal` prop in `App.tsx`; `onGoal`, `setGoal`, `GoalMessage`, `asGoal` and the goal queue from `src/api/sessions.ts` (and `"onGoal"` from `ShellStream`'s `Omit`); goal parts of `src/test/fakes.ts`; `goal: null` fixtures and `setGoal`/`onSetGoal` in tests. Verify: `npm test` green, `npx tsc --noEmit` clean, `npm run build` passes.

## 2. Remove the backend (SRS-FR-091, SRS-FR-096, SRS-FR-097)

- [x] 2.1 Delete `session_goal.rs` with its tests, the goal assertions of the unix hook test (design D4) and the `GoalOut for Outbox` helper; then remove `mod session_goal`, `AppState.goals` and its load in `lib.rs`, `set_session_goal` and its registration, `pin_first_prompt`, `ChannelGoal`, `GoalOut` impls, `goals`/`goal_out` in `PtySpawner`, `keeper` in `PaneHooks`/`TrackedProcess`, `PaneProcess::set_goal`, `PaneRegistry::set_goal`, and `first_prompt`/`prompt_text`/`is_tool_result` with their tests in `session_list.rs` (design D3); rewrite the lock-order comment (design D5). Verify: `cargo test` and `cargo clippy -- -D warnings` clean; `cargo clippy --all-targets -- -D warnings` shows no error beyond the 3 pre-existing unix-only dead-code items.

## 3. Reconcile

- [x] 3.1 `grep -rnE "GoalStore|GoalKeeper|session_goal|set_session_goal|pin_first_prompt|first_prompt|TargetBox|onGoal|setGoal|Session target"` over `src` and `src-tauri/src`, excluding `*.test.*`, returns nothing (SC-3); `openspec validate remove-session-goal --strict` passes; a build with a separate app identifier, started on a copy of the app data folder, leaves `session-goals.json` byte-identical (SC-4).
