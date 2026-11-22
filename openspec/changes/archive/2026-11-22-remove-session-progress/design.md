## Context

`add-session-progress` added a `ProgressKeeper` per pane (fed by the pane's hook events), a shared
`ProgressStore` persisted to `session-progress.json`, a `Summarizer` that runs `claude` with Haiku to rebuild the
Checkpoint List, two Tauri commands and the `{"progress": …}` stream message the UI renders as the Tracking
Prompt, Tracking button and Progress Strip. CR-015 removes all of it. The Session Goal (`GoalKeeper`, Target Box)
stays until `remove-session-goal`.

## Goals / Non-Goals

**Goals:** no Progress Tracking left in UI, client, commands or backend; no Claude Code run started by the app
other than the pane's own; old user data left as is.

**Non-Goals:** Session Goal / Target Box, status latency, hook settings (`hook_settings` keeps every event it sends
today, since the status tracker uses them), `LaunchLookup`, design files.

## Decisions

- D1 Delete, don't hide. `PaneProgress.tsx`, `session_progress.rs`, `progress_keeper.rs`, `summarizer.rs` and
  their tests go; no flag keeps them alive.
- D2 Keep `session-progress.json`, `.bak` and `.tmp` on disk (user's choice at GATE 1). Nothing reads, writes,
  prunes or deletes them; trashing a session no longer touches progress records.
- D3 The commands `set_progress_tracking` and `set_progress_collapsed` are removed with
  `PaneProcess::set_progress_*` and `PaneRegistry::set_progress_*`; only this app's frontend invoked them over Tauri
  IPC (grep), so no outside caller exists.
- D4 The client drops `onProgress`, `PaneProgress`, `Checkpoint` and the `setProgress*` calls; a stray
  `{"progress": …}` message is ignored like any unknown message.
- D5 Lock-order comments in `commands.rs` that mention `progress` are rewritten to the locks that remain.
- D6 The unix-only test `pty_spawner_runs_claude_with_the_same_args_whether_tracked_or_not` (SRS-NFR-011) is
  deleted: its subject is gone, and `pty_spawner_*` tests already pin the spawn arguments.

## Risks / Trade-offs

- Backend removal has no RED test of its own (absence of a module is shown by the build, not a test); it is covered
  by `cargo build`/`cargo test`/`cargo clippy` plus the SC-3 grep. Frontend absence has RED tests (tasks 1.1, 1.2).
- Old `session-progress.json` lingers in the app data folder (D2): a few KB, by the user's choice.
