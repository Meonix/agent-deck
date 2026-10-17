## Context

Today `App` renders three columns: `WorkspaceSidebar` (240 px), the pane grid, and `StatusBoard`
(`src/components/BoardColumn.tsx`, 280 px). `StatusBoard` turns `panes.entries` into cards through
`boardCards(entries)` (`statusBoard.ts`) and calls `panes.jumpTo(paneId)` on click or Enter. Each `PaneEntry`
carries `workspaceId`, `pane.sessionId`, `pane.paneId` and `status { tracked, state, since, reason }`.
`useSessionPanes` records the shown time of each state change in a passive effect after the layout commit
(SRS-FR-038), whatever renders the change.

UI source of truth: `design/agent-deck/brief.md` › "Đã chốt cho CR-001" — wireframe A, colour version
1 · Soft fill (`design/agent-deck/stories/ProposalCr001.stories.js` › V1SoftFill), states in
`design/agent-deck/stories/StatesCr001.stories.js`. Requirements: SRS v1.1, CR-001. Leftover table approved at
GATE 1, including "Live · <last activity>" on highlighted rows to keep SRS-FR-012.

## Goals / Non-Goals

**Goals:**

- Remove the Status Board column; give the panes its width.
- Session rows and folder rows carry the Status Highlight (SRS-FR-032, SRS-FR-033, SRS-FR-040).
- A click or Enter on a highlighted session row focuses its pane (SRS-FR-037).
- Latency recording keeps working with the new rendering (SRS-FR-038).

**Non-Goals:**

- Maximize and the maximized-pane badge (SRS-FR-041 to SRS-FR-046) — backlog item 10.
- Delete on a session row (SRS-FR-047 to SRS-FR-050) — backlog item 11; the design's Delete button is not added.
- Showing sessions of other folders in the session list; other folders only show on their folder row.

## Decisions

**D1 — `statusBoard.ts` becomes `statusHighlight.ts` with two pure functions.**
`sessionHighlights(entries)` → `Map<sessionId, { paneId, state, since, reason }>` for tracked entries in
`Running` / `Needs Approval` / `Error`. `folderHighlights(entries)` → `Map<workspaceId, { state, count }>`
with the most urgent state (`URGENCY = ["Error", "Needs Approval", "Running"]`) and the number of that
folder's sessions in it. Both skip untracked entries (SRS-FR-036). Rejected: computing inside the sidebar —
the urgency rule then lives in JSX and needs a DOM to test.

**D2 — `App` computes, the sidebar renders.**
`App` passes `highlights={{ sessions, folders }}` and `onJump={panes.jumpTo}` to `WorkspaceSidebar`; the grid
becomes `grid-cols-[260px_1fr]` (the design's sidebar width). `BoardColumn.tsx` is deleted.

**D3 — Session row.**
Highlighted row: background `tone[state].fill`, chip (square marker + state name, `tone[state].chip`) on the
title line; for `Needs Approval` / `Error` a line "HH:MM · <reason>" (reason omitted when null) in
`tone[state].text`; last line "Live · <last activity>". Not highlighted: unchanged (Live tag or time on the
right). The row button keeps picking the row (Resume shows); on a highlighted row it also calls
`onJump(paneId)`. Enter is handled on `keydown` with the default prevented, as the card did, so the rest of
that Enter does not reach the terminal the jump focuses.

**D4 — Folder row.**
Highlighted: background `tone[state].fill` and a badge (marker + count, `tone[state].chip`) before Remove;
selected adds `ring-1 ring-ring` instead of `bg-accent` so the status colour stays visible. Not highlighted:
unchanged.

**D5 — `statusTone.tsx` gets `fill`.** `bg-running-bg`, `bg-approval-bg`, `bg-error-bg`, `bg-muted` for
Idle/Ended (unused). Written out in full so Tailwind sees them. No new token.

**D6 — Latency recording unchanged.** The passive effect in `useSessionPanes` already runs after the commit
that paints the sidebar; only its comment changes ("board" → "Status Highlight"). Same for comments in
`TerminalPane.tsx`, `status_latency.rs`, `pane_status.rs`, `hooks.rs`.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 domain | `sessionHighlights(entries)`, `folderHighlights(entries)` | SRS-FR-032 which states highlight (Idle, Ended, untracked do not); SRS-FR-040 urgency `Error` > `Needs Approval` > `Running` and the count of the winning state; SRS-FR-036 untracked entries skipped | Vitest, plain `PaneEntry` objects |
| S2 UI | `App` with fake clients (existing `setup`, `stream.status`) | SRS-FR-031 removed: no "Status Board" region; SRS-FR-032 row background + chip follow Needs Approval → Idle → Error, Ended and closed panes lose it, abnormal exit keeps Error; SRS-FR-033 "14:02 · Edit src/main.rs", no line for Running, "13:40" without reason; SRS-FR-012 highlighted row shows "Live ·"; SRS-FR-034 highlight in the same commit as the status event; SRS-FR-040 folder row of a second, unselected folder gets background + "1"; SRS-FR-037 click / Enter on a highlighted row → that pane focused, `1` goes to its `client.write`, a non-highlighted row does not jump; SRS-FR-038 existing record test stays green | Vitest + Testing Library |
| — real app | — | colours match V1 Soft fill in dark and light; click a real `Needs Approval` row, press `1` | task 3.2 demo |

## Risks / Trade-offs

- [Session rows only exist for the selected folder] → a status in another folder shows only as the folder
  badge; the user clicks the folder, then the row. That is SRS-FR-040's design; a direct jump from the folder
  row is not asked for.
- [Row button now does two things on a highlighted row] → it picks and jumps; Resume on a live row already
  focuses the same pane (SRS-FR-015), so the two never disagree.
- [Selected folder loses `bg-accent` while highlighted] → the ring still marks it; checked against the design.

## Migration Plan

UI only. No stored data changes; latency records keep their format. Rollback = revert the change.

## Open Questions

None.
