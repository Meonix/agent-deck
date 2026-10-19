## Context

`Workbench` in `src/App.tsx` lays out a grid `grid-cols-[260px_1fr]`, or `grid-cols-[260px_280px_1fr]` while the
Session History Panel is open; the first column is `WorkspaceSidebar` (`<aside aria-label="Workspaces">`, made
`inert` while a pane is maximized). Each `TerminalPane` refits through a `ResizeObserver` on its body, so a wider
pane area refits on its own (SRS-FR-024). The Zoom shortcut lives in `useTextZoom`: a pure `zoomAction(e, mac)` in
`textZoom.ts`, and a `keydown` listener in the capture phase on `document`, which runs before xterm's textarea, so
the pane never gets the key; `mac` comes from `App`'s `mac` prop (`navigator.userAgent` in `main.tsx`).
Approach A was chosen at GATE 1. `design/agent-deck/` has no collapsed Sidebar; the PO fixed the toggle's place in
CR-006, so `/ux-design-ui` is skipped and nothing there changes.

## Goals / Non-Goals

**Goals:**

- Toggle button and shortcut flip one `shown` state (SRS-FR-088, SRS-FR-089).
- The shortcut works while a pane has focus, the pane neither gets the key nor loses focus (SRS-FR-089).
- `shown` starts `true` on every launch, nothing stored (SRS-FR-090).

**Non-Goals** (the SRS is silent or excludes it; a wish here goes through `/ba-change`):

- A narrow icon strip, a status mark on the toggle, dragging the Sidebar width, a slide animation, rebinding the
  shortcut (out of scope in CR-006).
- The toggle while a pane is maximized: the maximized pane covers it; the shortcut still flips the state, which
  shows after Restore.
- Moving keyboard focus back to a pane after clicking the toggle button.

## Decisions

**D1 — Pure match + hook, same shape as the Zoom shortcut.**
`sidebarShortcut(e, mac)` in `sidebarToggle.ts` returns true for `b`/`B` with Cmd (macOS) or Ctrl (Windows), the
other modifier, Alt and Shift up. `useSidebarToggle(mac)` holds `useState(true)`, registers a capture-phase
`keydown` on `document` that calls `preventDefault` + `stopPropagation` and flips the state, and returns
`{ shown, toggle }`. Rejected: putting the key in `useTextZoom` (two features in one hook).

**D2 — Hidden, not unmounted.**
`WorkspaceSidebar` gets a `hidden` prop that sets the HTML `hidden` attribute on its `<aside>` (Tailwind's preflight
makes `[hidden]` `display: none !important`, over the aside's `flex`; jsdom also drops it from the accessibility
tree, so tests see it gone); the grid drops its 260px
column (`grid-cols-[1fr]` / `grid-cols-[280px_1fr]`). The aside keeps its scroll position and child state.
Rejected at GATE 1: unmounting (approach B) and animating the width (approach C).

**D3 — One button over the grid.**
The `Workbench` grid gets `relative`; a `<button aria-label="Hide sidebar" | "Show sidebar"
aria-expanded={shown}>` is `absolute top-1/2 -translate-y-1/2 z-[5]`, at `left-[260px] -translate-x-1/2` while shown
and `left-0` while hidden; a small chevron (`‹` / `›`) on `bg-card border border-border`. `z-[5]` sits below the
maximized pane's `z-10`, so a maximized pane covers it (Non-Goals). It is rendered right after the Sidebar so Tab reaches the
Sidebar's rows first; being absolute, it takes no grid column. Both D2 and this placement were settled while
coding (a WorkspaceSidebar tab-order test caught the first placement); edited by hand, no `/opsx:update` here.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 pure | `sidebarShortcut(e, mac)` | SRS-FR-089: Cmd+B on mac → true; Ctrl+B on mac → false; Ctrl+B on Windows → true; Cmd+B on Windows → false; Ctrl+H → false; Shift or Alt held → false; `B` uppercase with Cmd → true | Vitest, `sidebarToggle.test.ts` |
| S2 UI app | `App` with fake clients and fake adapters, `mac` true/false | SRS-FR-088: click "Hide sidebar" → `Workspaces` aside hidden, button becomes "Show sidebar", grid has no 260px column; click again → aside shown, selected folder still selected. SRS-FR-089: with a pane focused, `keyDown` Meta+B on `document` → aside hidden, the event is `defaultPrevented`, the session got no write, the pane is still the focused one (Focus Outline); Ctrl+B on mac → nothing hidden. SRS-FR-090: a freshly rendered `App` shows the aside | Vitest + Testing Library in `App.test.tsx`, a new "Sidebar toggle" describe |
| — real app | — | button at the vertical centre of the edge; panes refit after hide/show; Cmd+B while typing in Claude Code | task 3.2 demo |

## Risks / Trade-offs

- [jsdom has no layout, so "terminal refits" is not observable in tests] → covered by the existing
  `ResizeObserver` path, checked in the demo.
- [On Windows, Ctrl+B is taken from the panes (tmux prefix, readline back-one-char)] → accepted by the PO in
  CR-006.

## Migration Plan

UI only, no stored data. Rollback = revert the change.

## Open Questions

None.
