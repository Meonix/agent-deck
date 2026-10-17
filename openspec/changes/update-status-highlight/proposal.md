## Why

CR-001 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-17) drops the three-column Status Board: it takes a
280 px column away from the panes. BO-01 still holds — a session that needs approval or failed must show within
3 seconds — so the status moves onto the left column the user already looks at: the session rows and the
folder rows get a background colour and a badge (SRS v1.1, Status Highlight). Backlog item 9 (Must).

## What Changes

- **BREAKING (UI)**: the Status Board column and its cards are removed (SRS-FR-031 Deleted).
- A session row whose pane is `Running`, `Needs Approval` or `Error` gets the background and a chip of that state;
  for `Needs Approval` and `Error` a second line shows "<time> · <reason>" (SRS-FR-032, SRS-FR-033).
- A folder row with sessions open in `Running`, `Needs Approval` or `Error` gets the background of its most urgent
  state (`Error` > `Needs Approval` > `Running`) and a badge with the number of its sessions in that state
  (SRS-FR-040).
- Clicking a highlighted session row moves keyboard focus to its pane (SRS-FR-037, was: click a card).
- A highlighted row keeps the `Live` mark (SRS-FR-012) as "Live · <last activity>" on its last line.
- Status latency is still recorded when the change is painted; only the wording moves from "board" to
  "Status Highlight" (SRS-FR-038, SRS-FR-039).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-board`: Status Board columns removed; cards become row highlights; folder highlight added; jump from a
  highlighted row (SRS-FR-031 to SRS-FR-037, SRS-FR-040).
- `status-latency`: "shown on the Status Board" becomes "Status Highlight shown" (SRS-FR-038, SRS-FR-039).

## Impact

- UI: `BoardColumn.tsx` deleted; `statusBoard.ts` reworked into per-session and per-folder highlights;
  `WorkspaceSidebar.tsx` renders them and calls `jumpTo`; `App.tsx` drops the third grid column;
  `statusTone.tsx` gets a row-fill class. Tests for the board are replaced.
- Design: `design/agent-deck/stories/StatesCr001.stories.js`, `ProposalCr001.stories.js` › 1 · Soft fill.
- Rust: comments that say "board" only; `record_status_shown` and its data are unchanged.
- No new dependency, no new token.
