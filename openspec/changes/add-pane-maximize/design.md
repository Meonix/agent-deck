## Context

`App` renders `WorkspaceSidebar` (260 px) and `<main>` with `PaneGrid`. `PaneGrid` places every pane as an
absolutely positioned wrapper whose rect comes from the layout tree (`layoutRects`), in a fixed order so React
never moves a pane's DOM node — moving it would re-attach its xterm terminal. `TerminalPane` opens the adapter
once, fits on mount and on `ResizeObserver` callbacks, and sends `client.resize` only when the size changes.
`useSessionPanes` owns `{ entries, layout, focusedId }`, `jumpTo(paneId)` (focus ring + `adapter.focus()`) and
opens every new pane through `openPane`. Item 9 added `statusHighlight.ts` with `currentPanes` (a session
resumed after its pane ended is represented by its live pane).

UI source of truth: `design/agent-deck/brief.md` › "Đã chốt cho CR-001" — wireframe A · Ô phóng to,
`ProposalCr001.stories.js` › Ô phóng to (dark/light), `StatesCr001.stories.js` › MaximizedNoBadge,
MaximizedApprovalOnly, MaximizedNarrow. Approach A was chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- Maximize / Restore a pane without remounting any terminal and without resizing the covered panes
  (SRS-FR-041, SRS-FR-042, SRS-FR-043).
- Restore before a new pane opens (SRS-FR-046).
- Badge on the maximized pane and the jump from it (SRS-FR-044, SRS-FR-045).

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- A keyboard shortcut for Maximize / Restore; Escape to restore (Escape belongs to Claude Code).
- Animation between the two layouts.
- Remembering the maximized pane across app restarts.

## Decisions

**D1 — `maximizedId` lives in `useSessionPanes`.**
`PanesState` gains `maximizedId: string | null`; the hook exposes `maximize(paneId)` and `restore()`. `openPane`
sets it to `null` in the same `setLayout` that inserts the new pane (SRS-FR-046); `closePane` clears it when the
closed pane was the maximized one. The layout tree is never touched by maximize, so Restore gives back the same
ratios (SRS-FR-042). Rejected: state in `App` — `openPane` could not clear it in the same update.

**D2 — Fixed overlay, others hidden in place.**
`PaneGrid` gets `maximizedId`. The maximized wrapper drops its rect style and takes
`fixed inset-x-0 bottom-0 top-9 z-10 p-2 bg-background` (top-9 = the 36 px title bar of `App`). Every other wrapper
keeps its rect and gets `invisible` and `inert`, so its size — and its session's terminal size — does not change
and it cannot take focus. Dividers are not rendered while a pane is maximized. The DOM order stays the same, so no
terminal is re-attached. Rejected at GATE 1: collapsing the sidebar (resizes every hidden PTY twice) and a portal
or separate view (remounts the terminal).

**D3 — Sidebar `inert` while maximized.**
`App` passes `inert={panes.maximizedId !== null}` to the sidebar's `<aside>`, so Tab never reaches the covered
Workspace List and session list (SRS-FR-041 scenario "Covered controls cannot be reached").

**D4 — Explicit refit on maximize and restore.**
`TerminalPane` gets `maximized: boolean` and calls the same `fit()` in an effect keyed on it, after the class
change is committed. `ResizeObserver` would also catch it in the real app; the explicit call makes SRS-FR-043 not
depend on observer timing and testable in jsdom (which has no `ResizeObserver`). `fit()` already skips an
unchanged size.

**D5 — Header button.**
Next to Split right / Split down: `⤢` with `aria-label="Maximize pane"`, or `⤡` with `aria-label="Restore pane"`
on the maximized pane. Same look as the other header buttons.

**D6 — Badge and jump target in `statusHighlight.ts`.**
`maximizedBadge(entries, maximizedPaneId)` → `{ count, state, paneId } | null` over `currentPanes(entries)`
minus the maximized pane: tracked sessions in `Needs Approval` or `Error`; `state` is `Error` if any, else
`Needs Approval`; `paneId` is the most urgent one (`Error` first, then the earliest `since`). `TerminalPane`
renders it on the maximized pane as a button "N need you" with the chip classes of `state` and a square marker,
`aria-label="N sessions need you"`. Clicking it calls `restore()` then `jumpTo(paneId)` (SRS-FR-045).

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 domain | `maximizedBadge(entries, maximizedPaneId)` | SRS-FR-044 count, colour (`Error` wins), maximized pane not counted, untracked / Running / Idle not counted, ended pane replaced by its live pane; SRS-FR-045 target: `Error` before `Needs Approval`, earliest `since` first | Vitest, plain `PaneEntry` objects |
| S2 UI | `App` with fake clients and fake adapters | SRS-FR-041 Maximize → maximized wrapper `fixed`, other wrappers `invisible` + `inert` with their style unchanged, sidebar `inert`; SRS-FR-042 Restore → same wrapper styles as before, no `inert`; close of the maximized pane clears it; SRS-FR-043 fake adapter size changes → `client.resize` with the new size on maximize and the old size on restore; SRS-FR-046 Split right on the maximized pane → nothing maximized, new pane right of it; SRS-FR-044 badge text and colour class follow `stream.status`, none for Running; SRS-FR-045 badge click → restored and the target pane's adapter got `focus()` | Vitest + Testing Library |
| — real app | — | overlay covers the sidebar under the title bar, hidden terminals keep their content after Restore, badge appears within 3 s | task 3.2 demo |

## Risks / Trade-offs

- [`top-9` ties the overlay to the title bar height] → the title bar is `h-9` in `App`; the class is written next
  to it in the same commit and the demo checks the edge.
- [`inert` support] → WebKit (WKWebView, macOS 14+) and WebView2 (Windows 11) support `inert`; React 19 passes it
  through as a boolean attribute.
- [A hidden pane keeps its terminal size while the window is resized] → it refits on Restore through
  `ResizeObserver`, like any pane whose size changes.

## Migration Plan

UI only, no stored data. Rollback = revert the change.

## Open Questions

None.
