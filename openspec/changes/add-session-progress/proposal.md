## Why

CR-012 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-25): the PO runs several long sessions and, coming back
to one hours later, cannot tell what it has done and where it stopped without reading the tool log. BO-04 — "Nắm lại
tiến độ một phiên dài mà không phải đọc log", ≥ 8/10 checked sessions with a checkpoint list that misses no major
work and splits none, within 2 weeks of trial — through BR-10: the user turns progress tracking on per session; the
pane then shows the major pieces of work done and in progress, updated after each Claude Code turn, read-only, with
nothing added to the Claude Code session. SRS v1.12, BRD v5.0, backlog item 28. Item 27
(`update-session-data-boundary`) already allows session content to leave through Claude Code for tracked sessions.

## What Changes

- New sessions show a Tracking Prompt below the Target Box ("Track progress for this session?" · Track · No); it
  does not block typing (SRS-FR-113 to SRS-FR-115).
- Every pane header gets a Tracking button left of Stash to turn tracking on or off at any time; turning it on for
  an ongoing session builds the list from the whole history (SRS-FR-116, SRS-FR-117, SRS-FR-125).
- A read-only Progress Strip below the Target Box lists Checkpoints (✓ done, ● in progress, summary, result line,
  start time), at most 4 rows then scrolling, scrolled to the work in progress, collapsible to one line
  (SRS-FR-118 to SRS-FR-123).
- After each turn of a tracked session the app summarises the new part of the history with Claude Haiku through
  the user's Claude Code login and updates the list within 30 seconds; new Checkpoints only for new major work,
  `Done` only on evidence; a failed update keeps the list and shows "Couldn't update" (SRS-FR-124, SRS-FR-126 to
  SRS-FR-128, RULE-10, RULE-11).
- Progress is kept per session across launches; a resumed session without a record stays untracked; `/clear`
  carries the choice to the new session (SRS-FR-129 to SRS-FR-131).
- The pane session is untouched, summaries leave no session history, and no API key is needed (SRS-NFR-011 to
  SRS-NFR-013).

## Capabilities

### New Capabilities

- `session-progress`: per-session Progress Tracking — Tracking Prompt, Tracking button, Progress Strip, Checkpoint
  List updates by summary after each turn, persistence (SRS-FR-113 to SRS-FR-131, SRS-NFR-011 to SRS-NFR-013).

### Modified Capabilities

None. `session-history` "Data stays on the machine" (SRS-NFR-007) was modified by `update-session-data-boundary`.

## Impact

- Rust: new `src-tauri/src/session_progress.rs` (store, condenser, merge, keeper) and `src-tauri/src/summarizer.rs`
  (the `claude -p` run); `pane_commands.rs` wires a `ProgressKeeper` into `PaneHooks` and `TrackedProcess` and adds
  commands `set_progress_tracking`, `set_progress_collapsed`; `lib.rs` loads the store and registers the commands;
  `session_commands.rs` drops the record when a session goes to the Trash.
- UI: `src/api/sessions.ts` parses `{progress}` messages and exposes the two commands; `TerminalPane.tsx` gets the
  Tracking button, `TrackingPrompt`, `ProgressStrip`; `useSessionPanes.ts` and `App.tsx` pass progress through.
- Data: new `session-progress.json` in the app data folder; Claude Code's files are only read.
- Cost: one Haiku run per tracked turn with new content (measured 2026-10-25: ~2.6 s, ~0.0005 USD for a tiny
  prompt).
