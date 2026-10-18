## Why

BR-05 of the agent-deck BRD (v2.3, CR-004): the user works with several Claude Code sessions in one window and
can maximize one pane to the whole window. Today that takes a hit on the small `⤢` button; a double-click on the
pane header is the gesture the user already knows from window title bars. Backlog item 14 (Should), after item 10
which built Maximize / Restore.

## What Changes

- Double-clicking the header of a pane that is not maximized maximizes it, exactly as the Maximize button does
  (SRS-FR-066).
- Double-clicking the header of the Maximized Pane restores the previous layout, exactly as the Restore button
  does (SRS-FR-067).
- A double-click on a header button (Split right, Split down, Shell, Maximize / Restore, Close, the "need you"
  badge) does only that button's job; a double-click inside the terminal still selects a word (SRS-FR-025).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pane-layout`: adds maximize and restore on a header double-click (SRS-FR-066, SRS-FR-067).

## Impact

- UI: `TerminalPane` header gets an `onDoubleClick` that calls the same toggle as the Maximize / Restore button,
  skipped when the double-click lands on a button; the header text becomes non-selectable.
- No change to `useSessionPanes`, `PaneGrid`, Rust, dependencies, tokens or `design/`.
