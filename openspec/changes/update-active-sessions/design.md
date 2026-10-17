## Context

Today `App` renders two columns: `WorkspaceSidebar` (260 px) and the pane area. The sidebar holds Folders and a
"Sessions" list of the selected folder (`SessionList` / `SessionRows`), fed by `useSessionList` and
`mergeSessions`; a row of a session open in a pane carries the Status Highlight from `sessionHighlights(entries)`
and jumps to its pane on click or Enter. New Session sits in the "Sessions" header. Selecting a folder
(`useWorkspaces.select`) sets `selectedId` and bumps `selections`, which makes `useSessionList` read again.
`useSessionPanes` records the shown time of a state change in a passive effect after the commit (SRS-FR-038),
whatever renders it, so moving the highlight to another list does not touch latency recording.

UI source of truth: `design/agent-deck/brief.md` › "Đã chốt cho CR-002" — wireframe C
(`design/agent-deck/stories/WireframeCr002.stories.js` › C), colour version 1 · Tint phẳng, dark
(`design/agent-deck/stories/ProposalCr002.stories.js` › V1Flat), states in
`design/agent-deck/stories/StatesCr002.stories.js`. Requirements: SRS v1.2, CR-002. Leftover table approved at
GATE 1.

## Goals / Non-Goals

**Goals:**

- Left column: Folders and Active Sessions, each on its own tint (SRS-NFR-009).
- Active Sessions: every pane's session across folders, urgency order, highlight, detail line, jump from any
  row, empty message (SRS-FR-032, SRS-FR-033, SRS-FR-037, SRS-FR-051 to SRS-FR-053).
- Session History Panel: opens on folder select, closes on Close or a click on the selected folder; holds
  New Session, `Live`, Resume, Delete, the existing notices (SRS-FR-007 to SRS-FR-013, SRS-FR-019,
  SRS-FR-047 to SRS-FR-050, SRS-FR-054).
- Maximize covers the panel too (SRS-FR-041).

**Non-Goals:**

- Resizing the panel or remembering whether it was open across restarts — not asked for.
- Delete from Active Sessions — the PO kept Delete in the history only (CR-002 answers).
- Changing folder highlight (SRS-FR-040), the maximized badge (SRS-FR-044, SRS-FR-045) or latency recording.

## Decisions

**D1 — `activeSessions(entries)` in `statusHighlight.ts`, pure.**
Returns `{ paneId, sessionId, workspaceId, workspaceName, title, state, since, reason, highlighted }[]` for
entries whose pane started, one per session (same `currentPanes` rule as the highlights). `state`: `Error` when
the status says so; otherwise `Ended` once the pane ended; otherwise the tracked state; an untracked pane counts
as `Idle` (SRS-FR-036). `since`: the status time, or `openedAt` when untracked. Sorted by
`["Error", "Needs Approval", "Running", "Idle", "Ended"]` then `since`. `highlighted` is true for the first three.
Rejected: sorting inside the component — the order rule then needs a DOM to test.

**D2 — `WorkspaceSidebar` keeps Folders, gains Active Sessions; history moves out.**
Two `<section>`s, `bg-section-folders` and `bg-section-active`, divided by `border-border`, written out in full
for Tailwind. Active row: one `<button>` per row (square marker, title, folder chip `border-border
text-muted-foreground`), row background `tone[state].fill` when highlighted, detail line "HH:MM · reason" for
`Needs Approval` / `Error`. Click → `onJump(paneId)`; Enter on keydown with the default prevented (as today).
List `aria-label="Active sessions"`. The `SessionList` / `SessionRows` code moves to a new
`SessionHistoryPanel.tsx` without the highlight branch: a row shows `Live` or its time, and picking shows
Resume and Delete. Its list is `aria-label="Session history"`, the panel `aria-label="Session history"`
region with header (folder name, New Session, Close). The "none" state ("Select a folder…") goes: no folder →
no panel.

**D3 — Panel open state lives in `useWorkspaces`.**
`historyOpen: boolean` and `closeHistory()`. `select(id)`: same id while open → close; otherwise select, open,
bump `selections`. Adding a folder selects it, so it opens too. Removing the selected folder already clears the
selection → panel gone. Rejected: state in `App` — the toggle needs `selectedId` at click time, which
`useWorkspaces` owns.

**D4 — `App` grid.** `grid-cols-[260px_280px_1fr]` while `historyOpen && selected`, else
`grid-cols-[260px_1fr]`. The panel is a card `m-2 mr-0 rounded-lg border bg-background` (wireframe C). The pane
area measures itself, so a width change refits the terminals (SRS-FR-024) with no extra code; checked by the
existing resize tests. `covered` (`inert`) is passed to the panel too.

**D5 — Tokens.** `--section-folders` / `--section-active` and the preset entries are already in
`design/agent-deck/tokens.css` and `tailwind.preset.js`, which `src/index.css` imports. No app CSS change.

### Seams to test (approve at GATE 2)

- **S1 domain** — `activeSessions(entries)` with plain `PaneEntry` objects (Vitest).
  Proves: SRS-FR-051 every started pane once, across folders, ended pane stays, unstarted pane absent;
  SRS-FR-052 urgency order and earliest-first inside a state, untracked counted as `Idle`; SRS-FR-032 which rows
  are `highlighted`.
- **S2 UI** — `App` with the fake clients (existing `setup`, `stream.status`; Vitest + Testing Library).
  Proves: SRS-FR-032 / SRS-FR-033 highlight and detail line on the Active row and none on the history row;
  SRS-FR-037 click and Enter on any Active row focus its pane, `1` goes to `client.write`, Enter stays out of the
  terminal, a history row does not jump; SRS-FR-053 "No active sessions"; SRS-FR-051 a second folder's pane shows
  with its folder name; SRS-FR-007 panel opens on select with header, no panel before; SRS-FR-054 Close button,
  click again closes, third click opens and reads again, other folder keeps it open; SRS-FR-008 to SRS-FR-013,
  SRS-FR-019, SRS-FR-047 to SRS-FR-050 existing tests pointed at the panel; SRS-FR-041 panel and Active Sessions
  `inert` while maximized; SRS-NFR-009 sections carry `bg-section-folders` / `bg-section-active`.
- **S3 tokens** — the WCAG script from the design step over `tokens.css`. Proves: SRS-NFR-009 numbers in both
  themes.
- **Real app (demo)** — dark and light: tints look right, a `Needs Approval` pane of a second folder sits on top
  of Active Sessions, click it and press `1`; open and close the panel and see the panes refit.

## Risks / Trade-offs

- [History rows lose the highlight] → the user may look for the state there out of habit; the `Live` label stays
  and the Active row is one glance left. That is the CR-002 answer.
- [Third column narrows the panes by 288 px] → the panel closes with one click (SRS-FR-054); on a 1024 px window
  four panes still get ~480 px (`StatesCr002` › DenseNarrow).
- [`select` now toggles] → keyboard users who press Enter twice on a folder close the panel; Enter a third time
  opens it. Matches SRS-FR-054.

## Migration Plan

UI only. No stored data changes. Rollback = revert the change.

## Open Questions

None.
