## Why

CR-005 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-19): quitting agent-deck throws away every open pane,
and the next launch starts on an empty pane area, so getting back to work means finding and resuming each session
again. BR-03 now says the sessions open in panes when the app quits come back in the same places on the next
launch; this serves BO-02 (back to an old session in ≤ 3 actions — here 0). SRS v1.5, backlog item 19.

## What Changes

- The app keeps, between launches, the session of every open pane and the pane layout (positions and ratios);
  ended panes and new sessions that never got a prompt are left out (SRS-FR-084).
- On launch, each remembered session is resumed in a pane at its remembered place and size; no pane is maximized
  and no Pane Shell is opened (SRS-FR-085).
- A remembered session that cannot be resumed (folder `Missing` or gone from the list, session deleted, Claude Code
  fails) leaves its pane out, its space goes to the others, and "<k> sessions could not be reopened" is shown
  (SRS-FR-086).

## Capabilities

### New Capabilities

- `pane-restore`: remember open panes and reopen them at launch (SRS-FR-084, SRS-FR-085, SRS-FR-086).

### Modified Capabilities

None.

## Impact

- UI: new `src/components/paneSnapshot.ts` (pure snapshot, storage, rebuild); `useSessionPanes.ts` splits the
  session start out of `openPane`, writes the snapshot, gains `reopenPanes`; `TerminalPane.tsx` `PaneEntry` gains
  `prompted`; `App.tsx` calls `reopenPanes` once the folder list has loaded.
- Storage: one `localStorage` key, like the Text Size (SRS-FR-071).
- Rust: none — resume already goes through `client.open(..., sessionId)`.
