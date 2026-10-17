## Why

BO-01 of the agent-deck BRD (v1.0): miss no session that needs approval or failed. BR-07 asks for a Status
Board that shows which sessions need the user. The board (item 3) already shows a card per `Running`,
`Needs Approval` and `Error` session, but reaching that session still means finding its pane by eye and
clicking into it. SRS-FR-037 lets a click on the card take the keyboard straight to the pane. Backlog item 8
(Should).

## What Changes

- Every Status Board card becomes a button: clicking it (or Enter / Space while it has focus) focuses the pane
  of that session and moves keyboard focus into its terminal, so the next key answers the approval prompt.
- The card keeps the look from the design (`design/agent-deck/stories/render.js` card), plus a pointer cursor
  and a focus ring.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-board`: adds jumping to a session's pane from its card (SRS-FR-037).

## Impact

- UI: `BoardColumn.tsx` cards become buttons with an `onJump(paneId)`; `useSessionPanes` exposes a jump that
  reuses the focus path from item 6 (`focusHolder`); `App` wires the two.
- No Rust change, no new dependency.
