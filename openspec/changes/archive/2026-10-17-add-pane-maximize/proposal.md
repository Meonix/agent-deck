## Why

BR-05 of the agent-deck BRD (v2.0, CR-001): the user works with several Claude Code sessions in one window and
can maximize one pane to the whole window. A long diff or plan is hard to read in a quarter of the window. BO-01
still holds while a pane is maximized: the left column is covered, so a badge on the maximized pane must say when
another session needs the user. Backlog item 10 (Should), after item 9 which built the Status Highlight.

## What Changes

- Each pane header gets a Maximize button; the maximized pane covers the whole window below the title bar —
  Workspace List, session list and the other panes — and its button becomes Restore (SRS-FR-041, SRS-FR-042).
- Other panes keep running and keep their size while covered; Restore brings back the same layout and sizes
  (SRS-FR-041, SRS-FR-042). The maximized terminal refits to its new size and back (SRS-FR-043).
- Opening a new pane while one is maximized restores the layout first (SRS-FR-046).
- While a pane is maximized, its header shows a badge with the number of other sessions in `Needs Approval` or
  `Error`, coloured `Error` if any is in `Error` (SRS-FR-044). Clicking it restores the layout and focuses the
  most urgent of those sessions (SRS-FR-045).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pane-layout`: adds maximize, restore, refit on maximize and restore before a new pane (SRS-FR-041, SRS-FR-042,
  SRS-FR-043, SRS-FR-046).
- `status-board`: adds the maximized pane status badge and the jump from it (SRS-FR-044, SRS-FR-045).

## Impact

- UI: `useSessionPanes` holds `maximizedId` with `maximize`, `restore`; `PaneGrid` places the maximized pane as a
  fixed overlay and hides the others without resizing them; `TerminalPane` header gets the Maximize/Restore button
  and the badge; `App` makes the sidebar `inert` while a pane is maximized; `statusHighlight.ts` gets the badge
  count and its jump target.
- Design: `design/agent-deck/stories/ProposalCr001.stories.js` › Ô phóng to, `StatesCr001.stories.js` ›
  MaximizedNoBadge, MaximizedApprovalOnly, MaximizedNarrow.
- No Rust change, no new dependency, no new token.
