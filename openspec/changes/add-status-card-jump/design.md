## Context

`StatusBoard` (`src/components/BoardColumn.tsx`) renders `boardCards(entries)`: one `<article>` per
`Running` / `Needs Approval` / `Error` pane, each card carrying its `paneId`. `useSessionPanes` already has
`focusHolder(entry)` from item 6: it sets `focusedId` (the pane's ring) and calls the entry's
`adapter.focus()` so keystrokes reach the terminal — `focusPane` alone only moves the ring. UI source of truth:
`design/agent-deck/stories/render.js` card markup; `design/agent-deck/brief.md` "thẻ bấm được". Approach A was
chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- Click or Enter / Space on a card → that pane focused, keyboard in its terminal (SRS-FR-037).

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Keyboard shortcuts to step through cards, scrolling to or highlighting the pane after the jump.

## Decisions

**D1 — The card is a button.**
`CardView` renders a `<button type="button">` with the card's existing classes (plus `w-full text-left
cursor-pointer` and a `focus-visible` ring), `aria-label` "<workspace> · <title>, <state>", content unchanged.
A native button gives Enter / Space and Tab order for free. Rejected: `role="button"` on the article (own key
handling).

**D2 — Jump through the existing focus path.**
`useSessionPanes` exposes `jumpTo(paneId)`: finds the entry and calls `focusHolder(entry)`; an unknown id (the
pane closed between render and click) does nothing. `StatusBoard` gets `onJump(paneId)`; `App` passes
`panes.jumpTo`.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 UI (React) | `App` with fake clients | SRS-FR-037: with two panes, the first focused, a `Needs Approval` status on the second → click its card → second pane has the focus ring and its adapter got `focus()`; typing `1` goes to `client.write` for that pane; Enter on the focused card does the same; a card for a closed pane does nothing | Vitest + Testing Library |
| — real app | — | click a real `Needs Approval` card, press `1` | task 2.2 demo |

## Risks / Trade-offs

- [Button inside the board] → a card can take keyboard focus; Tab now stops on cards before reaching panes.
  Acceptable: it is how the jump is reached from the keyboard.

## Open Questions

None.
