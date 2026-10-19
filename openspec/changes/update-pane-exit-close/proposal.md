## Why

CR-005 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-19): after `/exit` the pane stays on screen as
"Session ended" and the user has to close it by hand to get the space back. A session that ends on purpose
should take its pane with it; a session that crashed should still leave its output to read. SRS v1.5,
backlog item 17.

## What Changes

- **BREAKING (UI)**: a session that exits normally (exit code 0: `/exit`, Ctrl+D) closes its pane at once,
  without a confirmation; the remaining panes take its space (SRS-FR-083).
- "Session ended" now shows only after an abnormal exit (SRS-FR-028, was: any exit).
- The Pane Shell outlives only an abnormal exit; a normal exit ends it with the pane (SRS-FR-064, was: any exit).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-pane`: "Show session ended" narrowed to abnormal exits; "Close pane on normal exit" added
  (SRS-FR-028, SRS-FR-083).
- `pane-shell`: "Shell outlives the session" narrowed to abnormal exits (SRS-FR-064).

## Impact

- UI: `src/components/useSessionPanes.ts` — the session stream's `onExit(code)` closes the pane when `code` is 0.
- Tests: `App.test.tsx` and `PaneShell.test.tsx` cases that used `exit(0)` to reach an ended pane switch to an
  abnormal exit; new tests for the normal-exit close.
- Rust: none — the exit code already reaches the UI (`SessionStream.onExit(code: number | null)`).
- `TerminalPane` "Session ended" and the `Ended` state stay (RULE-07, SRS-FR-052 unchanged).
