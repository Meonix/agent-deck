## Context

See proposal.md for why. The approved look and every state live in `design/agent-deck/oneui/design.html` (sections
`#final`, `#final-collapsed`, `#all-clear`, `#empty-no-folders`, `#empty-no-sessions`, `#loading`, `#error`,
`#close-confirm`, `#maximized`, `#dense-data`, `#narrow`) with its shape tokens in
`design/agent-deck/oneui/tokens-oneui.css` and the decisions in `design/agent-deck/brief.md` › "Đã chốt cho One UI".
This document does not copy them.

Today: `statusHighlight.ts` already derives everything status-related from `PaneEntry[]` in render
(`folderHighlights`, `activeSessions`, `maximizedBadge`), with `currentPanes` collapsing a resumed session's two
panes into one and `URGENCY` giving `Error` > `Needs Approval` > `Running`. `useSessionPanes` exposes `focusedId`,
`maximizedId` and `jumpTo(paneId)` (focuses the pane and its terminal). `App.tsx` draws a 36 px title bar
("agent-deck" + Status Latency button) above the Workbench grid.

## Goals / Non-Goals

**Goals:**
- One pure function owns the Status Summary content, so SRS-FR-132 to SRS-FR-136 are tested without React.
- One pure function owns the expanded / collapsed / hidden decision; the hook around it only feeds it DOM facts.
- The One UI look changes classes and the shape layer only: no colour token, no status rule, no behaviour of the
  existing components changes.

**Non-Goals:**
- The design's "+" button in the Folders header: the workspace-list spec pins "+ Add Folder" in a bar at the bottom of
  the Sidebar, so the bar stays (restyled as a pill). Moving it needs a spec change, not this change.
- A dark canvas other than `#111111` (decided at the design gate).
- The Progress Strip truncating its last checkpoint in narrow panes (seen in the design, pre-existing behaviour).
- Error cases the SRS does not name for the Status Summary (e.g. a session whose status is unavailable is simply not
  counted per SRS-FR-036; nothing else is shown). Any further case goes to `/ba-change`.

## Decisions

### D1 · `statusSummary(entries)` next to `maximizedBadge`
Returns `{ headline: "need" | "clear" | "idle", need, approval, error, running, goTo: { paneId, title } | null }`.
It reuses `currentPanes` and the same ordering as `maximizedBadge` (urgency, then `since`), with no excluded pane, so
SRS-FR-136 and SRS-FR-045 cannot drift apart. Counting follows `activeSessions`: only started panes; `tracked` false →
not counted (SRS-FR-036); a pane whose session ended still counts as open for "clear" vs "idle", the same way Active
Sessions still lists it. Alternative — compute inside the component: rejected, the rules would only be testable
through the DOM.

### D2 · `summaryMode({ maximized, focusInPanes, narrow })` → `"hidden" | "collapsed" | "expanded"`
`maximized` wins (SRS-FR-139), then `focusInPanes || narrow` collapses (SRS-FR-137, SRS-FR-138). A hook
`useSummaryMode(paneArea, maximized)` supplies `focusInPanes` from `focusin`/`focusout` on `document` checked against
the pane area element, and `narrow` from `matchMedia("(max-width: 1099px)")`. Alternative — use `focusedId` from
`useSessionPanes`: rejected, it stays set when focus moves to the Sidebar, so the summary would never expand again.

### D3 · Placement
`StatusSummary` replaces the title bar row and sits above the Workbench, full width. The Status Latency button moves
to its right end (both modes), keeping SRS-FR-039 reachable. While hidden the Workbench takes the space; the
maximized pane already covers the Workbench, so it then covers everything below the window title bar.

### D4 · Latency (SRS-FR-140)
The summary is computed in the same render as the Status Highlight from `panes.entries`, so it changes in the same
commit as the rows SRS-FR-034 already measures. No timer, no extra subscription.

### D5 · One UI look
`index.css` imports `tokens-oneui.css` after `tokens.css` and maps `--oneui-*` into the Tailwind theme. The
Workbench becomes a padded canvas (`--oneui-canvas`, gap `--oneui-gap`); Sidebar, Session History Panel and each pane
become cards (`--oneui-radius-card`). Sidebar sections become grouped blocks on their existing tints (NFR-009/010
measurements unchanged), each row led by a 28 px round mark: folder → `--accent`, session → solid state colour with
its Lucide icon (hand / triangle-alert / play), unavailable → `circle-help` on `--muted-foreground`. Pane headers use
Inter; the terminal sits on `--oneui-term`. Pane dividers stay in the gap between cards, so drag-to-resize keeps
its hit area. Confirm dialogs: One UI sheet near the bottom over a blurred dim; toast: pill. Every icon-only control
keeps its accessible name (app-theme).

## Seams to test (approve at GATE 2)

- **S1 `statusSummary(entries: PaneEntry[])`** — unit tests in `statusHighlight.test.ts` with hand-built entries:
  SRS-FR-132 (count, unavailable excluded), SRS-FR-133 (three counts, zero omitted), SRS-FR-134, SRS-FR-135 (idle,
  ended pane still open), SRS-FR-136 (target: Error before Needs Approval, earliest `since`; none when clear).
- **S2 `summaryMode(facts)`** — unit tests on the pure decision table: SRS-FR-137, SRS-FR-138, SRS-FR-139.
- **S3 `<App>` with the fake clients of `App.test.tsx`** — end-to-end through the DOM: headline text after a status
  event (SRS-FR-140 / SC-1), Go-to click puts `document.activeElement` inside the target pane (SRS-FR-136),
  `focusin` inside a pane collapses and focus in the Sidebar expands (SRS-FR-137), maximize hides and restore shows
  (SRS-FR-139). `matchMedia` is stubbed for SRS-FR-138.
- **Not unit-tested, verified by screenshot:** the One UI look (D5) — the running app captured at 1280×800 dark and
  light and compared with `design.html#final`; the existing component tests must stay green to show no behaviour
  moved.

## Risks / Trade-offs

- [Tests select by class names or the old title bar text] → run the full suite after each look task; fix selectors to
  roles/names, never weaken assertions.
- [Card gaps shrink terminal area] → the Status Summary collapses whenever focus is in a pane (D2), which is most of
  the time; panes keep the existing dim rule.
- [Dark cards #191919 on #111111 are low contrast (1.07:1)] → accepted at the design gate; radius and gaps separate
  them.
- [`focusout` fires before `focusin` when moving between panes] → the hook reads `document.activeElement` on the next
  `focusin`, not on `focusout`, so it never flickers to expanded between two panes.

## Migration Plan

Pure front-end change; rollback is reverting the change's commits. No stored data changes.
