## Why

BR-05 of the agent-deck BRD (v3.0, CR-008): the user must see at a glance which pane is focused. The pane itself
has the Focus Outline (SRS-FR-087), but its row in Active Sessions looks like every other row: only the Status
Highlight colours a row, and an `Idle` or `Ended` session has none (SRS-FR-032). With an idle session focused, the
sidebar gives no hint which row it is. Serves BO-01 (the user acts in the right session). Backlog item 23 (Should).

## What Changes

- The Active Sessions row of the session in the pane with the Focus Outline gets the Row Focus Mark: a 2px iris
  ring around the row (SRS-FR-099).
- The mark shows in every state, `Idle` and `Ended` included; the row's Status Highlight stays inside, unchanged.
- At most one row has the mark; no pane focused → no row has it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-board`: adds the Row Focus Mark on the Active Sessions row of the focused pane (SRS-FR-099).

## Impact

- UI: `App` passes `focusedPaneId={panes.focusedId}` to `WorkspaceSidebar`; `ActiveRow` adds
  `ring-2 ring-inset ring-ring` and `aria-current="true"` to the row whose `paneId` matches.
- No change to `useSessionPanes`, `statusHighlight`, `TerminalPane`, Rust, dependencies, tokens or `design/`.
