## Context

The layout is a binary tree (`paneTree.ts`: `{ pane }` or `{ split: "right" | "down", ratio, first, second }`);
`PaneGrid` places each pane absolutely from `layoutRects(layout)` (fractions of the grid) and draws the resize
dividers with pointer events. Panes are rendered in a fixed order so a layout change never moves a pane's DOM node
and never re-attaches its terminal. `TerminalPane` puts ⇥ / ⇣ on the header, which call
`useSessionPanes.splitFrom` → `openPane(workspace, paneId, dir)`. The header already toggles maximize on
double-click (SRS-FR-066) and ignores presses on its buttons. Requirements: SRS v1.5, CR-005; leftover table
approved at GATE 1. The PO skipped `/ux-design-ui` for this item; the decisions below stand in for it.

## Goals / Non-Goals

**Goals:**

- Move any pane next to any other pane by dragging its header (SRS-FR-080, SRS-FR-081).
- Leave the layout untouched on Esc or a release outside a Drop Zone (SRS-FR-082).
- Remove the split buttons and `splitFrom` (SRS-FR-022 Deleted).

**Non-Goals:**

- A centre zone that swaps two panes, dragging out of the window (CR-005 out of scope).
- Changing where New Session places a pane (SRS-FR-021 unchanged).
- Remembering the layout across launches (backlog item 19).

## Decisions

- **Pointer events, not HTML5 drag and drop.** Tauri's webview takes OS drag-and-drop for file drops, and HTML5
  DnD gives no live pointer position on Windows WebView2 while dragging; the dividers already use pointer events,
  so the drag reuses that pattern and stays testable with `fireEvent`.
- **`PaneGrid` owns the drag.** It listens for `pointerdown` on the grid and starts a drag only when the press is
  on an element marked `data-drag-handle` (the pane header) and not on a button inside it. `TerminalPane` only marks
  its header; it needs no new prop. While dragging, window `pointermove` / `pointerup` / `keydown` listeners follow
  the pointer, so leaving the grid ends the drag as a cancel.
- **4 px threshold.** The drag starts after the pointer moves more than 4 px from the press, so clicks and the
  header double-click (SRS-FR-066) keep working.
- **No drag with one pane or while a pane is maximized.** There is no other pane to drop on, and the maximized
  pane covers the grid.
- **Drop side by nearest edge.** `dropSide(x, y)` takes the pointer as fractions of the target pane and returns the
  edge it is closest to (the pane is cut into four triangles by its diagonals). Ties go left/right first.
- **Target from the layout, not the DOM.** The pane under the pointer is found from `layoutRects` and the grid's
  bounding box — the same geometry the dividers use — so no `elementFromPoint`.
- **`movePane(layout, id, targetId, side)`** removes `id` with `removePane`, then replaces the target leaf with a
  split at ratio 0.5: `left`/`right` → `split: "right"`, `top`/`bottom` → `split: "down"`; the moved pane is
  `first` for `left`/`top` and `second` otherwise. Same pane or unknown ids → the layout unchanged.
- **Drop Zone look (stands in for `/ux-design-ui`).** Over the target pane, one `pointer-events-none`
  `aria-hidden` layer: four edge bands, each a quarter of the pane deep, drawn faint (`bg-primary/5`, dashed
  `border-primary/40`); the band under the pointer is replaced by the half the dragged pane will take, filled
  `bg-primary/20` with a solid `border-primary`. The dragged pane drops to `opacity-50`; a header that can be
  dragged shows `cursor-grab`. Existing tokens only, so both themes work. Each band carries `data-drop-side`, the
  lit one `data-active`, the layer `data-drop-target=<paneId>`, for tests.
- **Focus.** The moved pane keeps keyboard focus after the drop.

## Seams to test

- **S1 — `paneTree.ts` (`paneTree.test.ts`)**: `movePane` for the four sides, from a nested position, same pane,
  unknown ids; `dropSide` for each edge and the centre tie. Covers SRS-FR-081 geometry.
- **S2 — App with a fake client and a mocked grid rect (`App.test.tsx`)**: pointer down on a header, move, up:
  Drop Zones shown on the pane under the pointer (SRS-FR-080), panes re-placed after the drop with sessions
  untouched and terminals still mounted (SRS-FR-081), Esc / release on the dragged pane itself / below the
  threshold leave the layout (SRS-FR-082), no drag from a header button, with one pane or while maximized;
  split buttons gone (SRS-FR-022); SRS-FR-046 via New Session.

## Risks / Trade-offs

- [No more "new session in this pane's folder" from the header] → accepted at GATE 1; New Session in the history
  panel opens it.
- [Pointer capture lost to xterm while dragging over a terminal] → listeners sit on `window`, not on the pane.
