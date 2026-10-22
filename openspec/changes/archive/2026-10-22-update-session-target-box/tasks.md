## 1. Drop the Focus Reminder and the hook answer path (seams S1, S2, S3)

- [x] 1.1 Delete the reminder tests in `session_goal.rs` (`reminder_names_the_goal_and_the_off_goal_rule`, `reminder_keeps_500_characters_of_a_long_goal`, `reminder_body_is_the_prompt_submit_context`) and rewrite the `GoalKeeper` tests that expect an answer; RED then GREEN: `GoalKeeper::hook` returns nothing, first prompt pinned and sent, multi-line prompt kept whole (SRS-FR-091); remove `focus_reminder`, `reminder_body`, `REMINDER_GOAL_CHARS`
- [x] 1.2 Delete `prompt_submit_is_answered_with_the_sinks_json`, `prompt_submit_without_an_answer_is_empty`, `other_events_are_empty_even_when_the_sink_answers` in `hooks.rs`; RED then GREEN: every event, `UserPromptSubmit` included, gets an empty `200`; `hook_settings` discards output for every posted event; `HookSink::hook` returns `()` and `pane_status.rs`, `pane_commands.rs` follow
- [x] 1.3 Rewrite `pane_hook_url_answers_prompts_with_the_reminder_and_the_pane_follows_the_goal` in `pane_commands.rs`: a resumed pane announces its stored goal, a `UserPromptSubmit` response has no body, `set_goal` echoes the new goal (SRS-FR-096)

## 2. Empty goal is a goal (seam S1)

- [x] 2.1 Delete `blank_set_changes_nothing`; RED then GREEN: `set("")` stores and sends `""` and a later prompt does not pin; `set("Sửa resume")` before any prompt wins over the first prompt (SRS-FR-091, SRS-FR-093)

## 3. Target Box (seam S4)

- [x] 3.1 Delete the `Goal Line (SRS-FR-092, SRS-FR-093)` block in `TerminalPane.test.tsx`; RED then GREEN: Target Box (`textbox` "Session target") under every header, empty with placeholder for `null` and `""`, shows a multi-line goal, red text, capped at 3 lines with scrolling, double-click does not maximize (SRS-FR-092) — `TargetBox` replaces `GoalLine`
- [x] 3.2 RED then GREEN: changed text + blur → `onSetGoal(paneId, trimmed)`; unchanged blur → no call; cleared + blur → `onSetGoal(paneId, "")`; Escape → old text, no call; Enter adds a newline; a new `goal` prop shows while the box is not focused (SRS-FR-093)

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run build`, `cargo test`, `cargo clippy` and paste the output; `openspec validate update-session-target-box --strict`
- [ ] 4.2 Rebuild the release bundle; demo in the app: new pane → empty red box with placeholder; first prompt fills it; edit, quit, reopen → edit kept; a prompt gets no "Session Goal" context
  - 2026-10-22: the PO approved without the scripted demo; bugs found in daily use go through `/dev-bug`.
