## Context

`add-session-goal` / `update-session-target-box` added a `GoalKeeper` per pane (fed by `UserPromptSubmit` hooks), a
shared `GoalStore` persisted to `session-goals.json`, `pin_first_prompt` for resumed sessions (reading
`first_prompt` from Claude Code's history), the `set_session_goal` command, the `{"goal": …}` stream message and
the `TargetBox` textarea. `remove-session-progress` already removed the other reader of the goal.

## Goals / Non-Goals

**Goals:** no Session Goal left in UI, client, commands or backend; old user data left as is.

**Non-Goals:** hook settings (the status tracker still uses `UserPromptSubmit`), the `--goal` design token,
`session_title` and session listing.

## Decisions

- D1 Delete, don't hide: `session_goal.rs`, `TargetBox` and their tests go.
- D2 Keep `session-goals.json` on disk, as with `session-progress.json`: nothing reads, writes or deletes it.
- D3 `first_prompt`, `prompt_text`, `is_tool_result`, `LOCAL_COMMANDS` and `tag` in `session_list.rs` go with their tests: grep shows
  `pin_first_prompt` is their only caller.
- D4 The unix-only test `pane_hook_url_adds_nothing_to_prompts_and_the_pane_follows_the_goal` keeps its hook part
  (the pane's own hook URL answers `UserPromptSubmit` with an empty 200 and adds nothing to the prompt) and loses
  the goal assertions; it is renamed `pane_hook_url_adds_nothing_to_prompts`. `spawner_with_goals` folds into
  `spawner`.
- D5 With `goals` gone, `AppState` keeps the lock-order rule for `list`, `panes`, `shells` only.

## Risks / Trade-offs

- The unix-only test cannot run on this Windows host; it is covered by the macOS CI build.
- Backend removal has no RED test of its own (shown by build, clippy, SC-3 grep); frontend absence has RED tests.
