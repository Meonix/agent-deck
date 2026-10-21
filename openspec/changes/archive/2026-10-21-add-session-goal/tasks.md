## 1. Hook answer (seam S3)

- [x] 1.1 RED then GREEN at S3: `HookSink::hook` returns `Option<Value>`; `serve()` answers `UserPromptSubmit` with the JSON body when `Some`, every other case empty; `StatusTracker` returns `None` (SRS-FR-094, SRS-FR-098)

## 2. Goal core (seams S1, S2)

- [x] 2.1 RED then GREEN at S1: `focus_reminder(goal)` and `reminder_body(goal)` in `src-tauri/src/session_goal.rs` (SRS-FR-094, SRS-FR-095)
- [x] 2.2 RED then GREEN at S2: `GoalStore` (`session-goals.json`, `.tmp` + rename, `.bak`) and `GoalKeeper` hook/set with session switch (SRS-FR-091, SRS-FR-093, SRS-FR-096, SRS-FR-098)

## 3. History and wiring (seam S4)

- [x] 3.1 RED then GREEN at S4: `first_prompt(path)` in `session_list.rs` (SRS-FR-097)
- [x] 3.2 Wire `PaneHooks` (tracker + keeper) in `pane_commands.rs`, `GoalStore` in `AppState`, first-prompt lookup on resume, `set_session_goal` command; `cargo test` stays green (SRS-FR-091, SRS-FR-096, SRS-FR-097)

## 4. UI (seam S5)

- [x] 4.1 RED then GREEN at S5: `asGoal` + `onGoal` in `sessions.ts`, `goal`/`setGoal` in `useSessionPanes`, Goal Line and editor in `TerminalPane` (SRS-FR-092, SRS-FR-093)

## 5. Verification

- [x] 5.1 Run `cargo test`, `npm test`, `npm run build` and paste the output
- [ ] 5.2 Demo in the rebuilt app: first prompt pinned; off-goal prompt pointed out, "cứ làm" goes ahead, "commit giúp" not flagged; edit with the pencil; `/clear` then a new prompt pins a new goal; quit and reopen keeps the edited goal; resume an old session shows its first prompt
  - 2026-10-21: the PO asked to archive without a reported demo. Checked with real Claude Code 2.x in `-p` mode: `--resume <id>` reports the same `session_id` in `UserPromptSubmit` as `--session-id <id>`, so a resumed pane keeps its goal. Off-goal behaviour, `/clear` and the UI were not tried in the app; issues found in daily use go through `/dev-bug`.
