## Context

`useSessionPanes` keeps `focusedId`, set by `focusPane(paneId)` whenever a pane's `<section>` receives a DOM
`focus` event (bubbled from its terminal or a header button) and when a pane opens or is jumped to from Active
Sessions (SRS-FR-014, SRS-FR-015, SRS-FR-037). `App` passes `focused={paneId === focusedId}` to each
`TerminalPane`. Today `TerminalPane.tsx` uses it only for the border:
`quiet ? (focused ? "border-ring" : "border-border") : tone[state].ring`, so focus shows only on a quiet pane.

The pane `<section>` sits in a `PaneGrid` wrapper with `p-1` (4px), `p-2` when maximized; the `<section>` has
`overflow-hidden`, which clips its children but not its own box-shadow. Approach A was chosen at GATE 1.
`design/agent-deck/` has no focus state for panes and is not changed: the SRS fixes the look (iris, 2px, outside).

## Goals / Non-Goals

**Goals:**

- Exactly the pane with `focusedId` shows the Focus Outline, whatever its status (SRS-FR-087).
- The status border keeps its colour and width.

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Clearing the outline when keyboard focus leaves every pane (sidebar, dialog): the outline follows `focusedId`,
  the last pane used, which is where typing resumes. Approach C, rejected at GATE 1.
- A focus mark on the Pane Shell area apart from the pane.
- Any change to the Active Sessions row of the focused pane.

## Decisions

**D1 — Box-shadow ring, not a second border.**
Tailwind `ring-2 ring-ring ring-offset-1 ring-offset-background` draws a 1px background gap and a 2px `--ring`
(iris-8) band as a box-shadow outside the border. It takes no layout space, so the terminal does not refit when
focus moves, and the status border stays untouched. 3px fits inside the wrapper's 4px padding, so neighbours and
the grid edge do not clip it. Rejected: CSS `outline` (same look, but Tailwind's `ring-offset` colour keeps the gap
readable on both themes without a new token); a wrapper border (shifts the pane by 2px).

**D2 — Idle focused pane drops `border-ring`.**
With the outline in place the light iris border is a second, weaker focus mark; the idle border becomes
`border-border` regardless of focus.

**D3 — Driven by the existing `focused` prop.**
No new state; `focusedId` already moves on click, on a new pane and on an Active Sessions jump.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 UI unit | `TerminalPane` rendered with `focused` true/false and each status | SRS-FR-087: `focused` → section has `ring-2` and `ring-ring`; not focused → no `ring-2`; `Needs Approval` + focused → `border-approval`, `border-2` and `ring-2` together; idle focused → `border-border`, no `border-ring` | Vitest + Testing Library, replaces the "keep the focus ring" lines of the border test in `TerminalPane.test.tsx` |
| S2 UI app | `App` with fake clients and fake adapters | SRS-FR-087: three panes, click into pane 2 → only pane 2's region has `ring-2`; click the Active Sessions row of pane 1 → only pane 1 has it; maximize pane 1 → it keeps it | Vitest + Testing Library in `App.test.tsx`, next to "Jump from Active Sessions" |
| — real app | — | ring visible, not clipped at grid edges and between panes, in light and dark | task 2.2 demo |

## Risks / Trade-offs

- [jsdom does not paint box-shadows] → S1/S2 prove the classes only; clipping and colour are checked in the demo.
- [The outline stays on the last pane while the user types in the sidebar] → accepted at GATE 1 (Non-Goals).

## Migration Plan

UI only, no stored data. Rollback = revert the change.

## Open Questions

None.
