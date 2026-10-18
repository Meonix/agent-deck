## Context

Item 10 (`add-pane-maximize`) put `maximizedId`, `maximize(paneId)` and `restore()` in `useSessionPanes`;
`App` passes `maximized`, `onMaximize` and `onRestore` to each `TerminalPane`, whose header button calls
`maximized ? onRestore() : onMaximize(paneId)`. The header (`<header>` in `TerminalPane.tsx`) holds the title,
the status chip, the "need you" badge on the Maximized Pane, and the Split right, Split down, Shell,
Maximize / Restore and Close buttons. The terminal body is a sibling of the header, so a double-click there never
reaches a header handler. Approach A was chosen at GATE 1. No new UI, so nothing in `design/agent-deck/` changes.

## Goals / Non-Goals

**Goals:**

- Header double-click toggles Maximize / Restore through the existing callbacks (SRS-FR-066, SRS-FR-067).
- Double-clicks on header buttons and inside the terminal keep their own behaviour (SRS-FR-025).

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Double-click anywhere other than the pane header (named out of scope in CR-004).
- A keyboard shortcut for Maximize / Restore.
- Double-click on the Pane Shell area or the divider.

## Decisions

**D1 — One toggle shared by the button and the header.**
`TerminalPane` defines `const toggleMaximized = () => (maximized ? onRestore() : onMaximize(paneId))`; the
Maximize / Restore button's `onClick` and the header's `onDoubleClick` both call it. Rejected at GATE 1: a
`toggleMaximize` in `useSessionPanes` (no second caller) and a handler on the title text only (small target in a
narrow pane).

**D2 — Both presses must hit the header outside its buttons.**
A browser sends `dblclick` to whatever is under the second press, and the first click may have moved something
there: Maximize turns the pane into the full-window overlay, Close or Split right slides a neighbour under the
cursor. So the header records, on a `mousedown` with `detail === 1`, whether that press hit a non-button part of
it, clears the record on `mouseleave`, and toggles on `dblclick` only when the record is set and the `dblclick`
target is not inside a `button` either. Changed after review (the first draft checked only the `dblclick`
target); edited by hand because this repo has no `/opsx:update`.

**D3 — `select-none` on the header.**
A double-click on the title would otherwise select a word of the title text in the webview. The header carries no
text the user needs to copy (the workspace and title also show in Active Sessions and the history panel).

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 UI | `App` with fake clients and fake adapters, `user.dblClick` | SRS-FR-066 header double-click on pane 2 of three → same wrapper styles as after Maximize (pane 2 `fixed`, others `invisible` + `inert`, sidebar `inert`); double-click on the Shell button → nothing maximized; double-click on the terminal body → nothing maximized; first press on the Maximize / Restore button and second press on a header → only the button's toggle; a stale header press after `mouseleave` does not count; SRS-FR-067 second header double-click → wrapper styles equal to before the first | Vitest + Testing Library, next to the "Maximize pane" tests in `App.test.tsx` |
| — real app | — | no title text selected on double-click; xterm word selection still works in the body | task 2.2 demo |

## Risks / Trade-offs

- [jsdom double-click on the terminal body does not exercise xterm word selection] → the S1 test proves only
  that the pane stays unmaximized; word selection is checked in the demo.
- [`select-none` stops copying the header title] → acceptable, the title is shown elsewhere (D3).

## Migration Plan

UI only, no stored data. Rollback = revert the change.

## Open Questions

None.
