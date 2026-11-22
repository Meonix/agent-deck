## Why

CR-015 (BRD v6.0, SRS v1.15): the user no longer wants Progress Tracking. BO-04 and BR-10 are deleted, so the
Tracking Prompt ("Track progress for this session?"), the Tracking button, the Progress Strip and the Checkpoint
summaries made with Claude Haiku go. With no summary run left, SRS-NFR-007 returns to its pre-CR-012 sentence: the
app sends no session content anywhere. Backlog item 31; it goes before item 32 (remove-session-goal) because the
summaries read the Session Goal.

## What Changes

- **BREAKING** Remove Progress Tracking: Tracking Prompt, Tracking button, Progress Strip, collapse/expand,
  per-turn Checkpoint List updates, update-failure notice, keeping progress across launches, resume and `/clear`
  handling (SRS-FR-113 to SRS-FR-131, all `Deleted (CR-015)`).
- **BREAKING** Remove the summary run and its constraints (SRS-NFR-011, SRS-NFR-012, SRS-NFR-013, `Deleted (CR-015)`).
- SRS-NFR-007 loses its Progress Tracking exception; the "tracked session" scenario goes.
- `session-progress.json` (and its `.bak`/`.tmp`) already on the user's disk stays untouched; the app stops reading
  and writing it.

## Success Criteria

- SC-1 A pane shows no "Track progress for this session?" prompt, no "Track progress" button and no "Progress"
  region, for a new session and for a resumed one.
- SC-2 The sessions client exposes no progress API (`onProgress`, `setProgressTracking`, `setProgressCollapsed`) and
  ignores a `{"progress": …}` message.
- SC-3 The app starts no Claude Code run other than the pane's own session; `grep` finds no `summarizer`,
  `ProgressKeeper`, `session_progress` or `set_progress_` in `src` and `src-tauri/src`.
- SC-4 An existing `session-progress.json` in the app data folder is byte-identical after a launch.

## Capabilities

### New Capabilities

### Modified Capabilities

- `session-progress`: every requirement removed.
- `session-history`: SRS-NFR-007 loses the Progress Tracking exception.
- `app-theme`: the pane header no longer lists a "Track progress" button.

## Impact

- Frontend: `PaneProgress.tsx` deleted; progress parts removed from `TerminalPane.tsx`, `useSessionPanes.ts`,
  `App.tsx`, `src/api/sessions.ts`, `src/test/fakes.ts` and their tests.
- Backend: `session_progress.rs`, `progress_keeper.rs`, `summarizer.rs` deleted; commands `set_progress_tracking`,
  `set_progress_collapsed` removed; `AppState.progress`/`summarizer`, `LookupSummarizer`, `ProgressDeps` wiring,
  the startup prune and the post-trash record removal go.
- Out of scope: Session Goal and Target Box (item 32), status latency recording (item 33), the design files under
  `design/agent-deck/` (owned by `design-ui`), hook settings passed to Claude Code.
