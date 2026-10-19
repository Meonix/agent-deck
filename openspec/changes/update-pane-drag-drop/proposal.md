## Why

CR-005 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-19): the Split right (⇥) and Split down (⇣) buttons
on each pane header are hard to use — they are small, they open a new session instead of arranging the ones
already open, and nothing else can move a pane once it is placed. The PO wants to grab a pane by its header and
drop it to the left, right, top or bottom of another pane. SRS v1.5, backlog item 18.

## What Changes

- **BREAKING (UI)**: the Split right and Split down buttons are removed from the pane header (SRS-FR-022
  Deleted). A new session still opens to the right of the focused pane (SRS-FR-021, unchanged).
- Dragging a pane header over another pane shows that pane's four Drop Zones; the zone under the pointer lights up
  (SRS-FR-080).
- Dropping moves the dragged pane to that side of the other pane, splitting it in half; its old place goes to the
  remaining panes; sessions and shells keep running (SRS-FR-081).
- Esc, or a release outside any Drop Zone, leaves the layout as it was (SRS-FR-082).
- The SRS-FR-046 scenario opens the new pane with New Session instead of Split Right.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pane-layout`: "Split down on request" removed; "Show drop zones", "Move a pane by drop", "Cancel a drag" added;
  the "Restore before a new pane" scenario no longer uses Split Right (SRS-FR-022, SRS-FR-046, SRS-FR-080,
  SRS-FR-081, SRS-FR-082).

## Impact

- UI: `paneTree.ts` gains `movePane` and `dropSide`; `PaneGrid.tsx` owns the drag and draws the Drop Zones;
  `TerminalPane.tsx` loses the split buttons and `onSplit`, its header becomes the drag handle;
  `useSessionPanes.ts` loses `splitFrom`, gains `movePane`; `App.tsx` wires `onMove`.
- Tests: split-button tests in `App.test.tsx` and `TerminalPane.test.tsx` are rewritten with New Session and drag.
- Design: no `/ux-design-ui` pass — the PO skipped it on 2026-10-19; the Drop Zone look is settled in `design.md`
  with existing tokens only.
- Rust: none.
