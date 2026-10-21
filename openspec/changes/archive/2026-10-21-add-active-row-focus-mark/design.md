## Context

`useSessionPanes` keeps `focusedId`, the pane that has the Focus Outline (SRS-FR-087); it moves on a click into a
pane, on a new pane and on an Active Sessions jump, and becomes `null` when that pane closes. `App` already passes
`focused={paneId === focusedId}` to each `TerminalPane`, but `WorkspaceSidebar` does not receive it. `ActiveRow`
(`src/components/WorkspaceSidebar.tsx`) colours a row only with `tone[state].fill` when `row.highlighted` is true,
i.e. `Running`, `Needs Approval`, `Error` (SRS-FR-032). Approach A was chosen at GATE 1.
`design/agent-deck/` has no focus state for rows and is not changed: the SRS fixes the look (iris, 2px).

## Goals / Non-Goals

**Goals:**

- Exactly the row whose `paneId` is `focusedId` shows the Row Focus Mark, whatever its state (SRS-FR-099).
- The row's Status Highlight keeps its fill and marker.

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Clearing the mark while keyboard focus sits in the sidebar or a dialog: it follows `focusedId`, like the Focus
  Outline.
- A focus mark on the folder row of the focused pane's workspace.

## Decisions

**D1 — `focusedPaneId` prop on `WorkspaceSidebar`, compared in `ActiveRow`.**
No new state and no change to `ActiveSession`: focus is not part of the status model built by `activeSessions()`.
Rejected: a `focused` field on `ActiveSession` (approach B, mixes focus into the status highlight logic).

**D2 — Inset ring.**
`ring-2 ring-inset ring-ring` paints the iris (`--ring`, the colour of the Focus Outline) inside the row's padding
box. Rows sit 2px apart (`space-y-0.5`) inside an `overflow-auto` sidebar, so an outer ring would be clipped at the
sidebar edge or covered by the next row's fill; inset avoids both and takes no layout space. It is drawn on top of
the `tone[state].fill` background, so the Status Highlight stays visible.

**D3 — `aria-current="true"` on the marked row.**
Gives the mark a name for screen readers and a stable hook for tests, like the selected folder row.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 UI app | `App` with fake clients and fake adapters | SRS-FR-099: two idle panes, click into pane 2 → only pane 2's row has `aria-current` and `ring-2`; pane 1 `Running` and focused → its row has the `Running` fill and `ring-2`; click pane 1's row → mark moves to it; close the focused pane → no row has the mark | Vitest + Testing Library in `App.test.tsx`, next to "Jump from Active Sessions (2.4)" |
| — real app | — | ring visible on idle and coloured rows, light and dark | task 2.2 demo |

## Risks / Trade-offs

- [jsdom does not paint box-shadows] → S1 proves the classes only; the look is checked in the demo.
- [Mark stays on the last pane while the user types in the sidebar] → same as the Focus Outline (Non-Goals).

## Migration Plan

UI only, no stored data. Rollback = revert the change.

## Open Questions

None.
