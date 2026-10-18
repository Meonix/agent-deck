## Context

`SessionHistoryPanel` renders the selected folder's sessions; `SessionRows` (keyed on the workspace id) lists
them, a click on a row "picks" it and shows its Resume / Delete buttons. `App`'s `Workbench` owns the single
delete: `requestDelete` finds the pane of the session (`paneId`, `live`), shows a `ConfirmDialog`, and
`confirmDelete` calls `sessions.deleteSession(workspaceId, id, paneId?)` — the backend ends the live session
before trashing — then closes the pane unless the error is `wrong_pane`, reloads the list on success or
`not_found`, and toasts "Session could not be deleted" otherwise. `inFlight` keeps a second delete of the same
session out while the first runs. `useWorkspaces` exposes `selected` and `historyOpen`; `historyShown` in `App`
is both. Approach A was chosen at GATE 1.

**No `/ux-design-ui` run:** the PO chose to skip the design at GATE 1. `design/agent-deck/design.html` has no
checkbox or selection bar; the controls below reuse the panel's existing classes.

## Goals / Non-Goals

**Goals:**

- Checkbox per row, selection bar, Select all, cleared on switch or close (SRS-FR-073 … SRS-FR-076).
- One confirmation, a sequential delete through the existing command, partial failure kept selected
  (SRS-FR-077, SRS-FR-078, SRS-FR-079).

**Non-Goals** (the SRS is silent or CR-004 rules it out; a wish here goes through `/ba-change`):

- Shift-click ranges, selecting across folders, restoring from the Trash (CR-004 out of scope).
- A way to clear the selection other than unticking, switching or closing (no "Select none").
- Progress while a long selection is being deleted.
- Singular wording for one session: the SRS fixes "Move <n> sessions to Trash?" and "Close <k> open sessions …"
  and they are shown as written, also for 1.

## Decisions

**D1 — The Session Selection lives in `Workbench`.**
`useState<string[]>` of session ids. An effect on `[workspaces.selected?.id, historyShown]` empties it, so a
switch or a close clears it and a reopen starts empty (SRS-FR-076). The panel counts and deletes only the ticked ids
that are still listed, so a session gone since it was ticked never counts in `<n>` (edited by hand during
apply: the ids are filtered where they are shown rather than pruned in the state; no `/opsx:update` here). The panel gets `selected` and
`onSelect(ids)` and stays stateless about it. Rejected: state inside `SessionRows` — the bulk result in `App`
must set it back to the failed ids (SRS-FR-079).

**D2 — Row checkbox and selection bar in `SessionHistoryPanel`.**
Each `li` starts with `<input type="checkbox" aria-label="Select <title>">` (`accent-primary`, `shrink-0`),
outside the row button, so ticking never picks the row nor resumes (SRS-FR-073). While the selection is not
empty a bar below the rows, `sticky bottom-0` in the scrolling panel, shows "Select all" (same classes as Resume) and "Delete selected (<n>)" (same
classes as Delete) (SRS-FR-074, SRS-FR-075).

**D3 — One per-session delete shared by both flows.**
`confirmDelete`'s body becomes `deleteOne(target: Deleting): Promise<boolean>` (true = gone), without the toast
and the reload; the single Delete calls it then toasts / reloads as today, so its behaviour does not change.

**D4 — Bulk confirm and sequential loop.**
Delete selected builds a `Deleting` per selected row (pane lookup as in `requestDelete`) and shows one
`ConfirmDialog`: title "Move <n> sessions to Trash?", or "Close <k> open sessions and move <n> sessions to
Trash?" with `k` the live ones; action "Move to Trash" or "Close and move" (SRS-FR-077). On confirm it awaits
`deleteOne` for each in list order — one at a time, so two sessions never close panes or touch the trash at the
same moment — skipping ids already in `inFlight` (they count as not deleted). Then one reload; the selection
becomes the ids not gone; if any, the toast "<k> of <n> sessions deleted" (SRS-FR-078, SRS-FR-079). Cancel
changes nothing and keeps the selection.

**D5 — No other delete while one runs (added after review).**
While the loop runs, `deletingSelection` disables "Delete selected" and `requestDelete` ignores a single Delete;
Delete selected is ignored while a single delete is still in flight, so no session is ever counted as not
deleted only because another flow held it. The bar sits below the rows (D2) so ticking never shifts a row under
the pointer and the bar stays in view next to old rows far down the list. Edited by hand; no `/opsx:update` here.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 UI | `App` with fake clients (`fakeSessions` with `list` and `deleteSession` mocks) and fake adapters | SRS-FR-073 tick / untick changes the bar count, no pane opens; SRS-FR-074 bar hidden with nothing ticked, "Delete selected (2)"; SRS-FR-075 Select all → count = listed rows; SRS-FR-076 switch folder and back, close and reopen → nothing ticked; SRS-FR-077 dialog titles for 0 and 1 live session, Cancel → no `deleteSession` call and ticks kept; SRS-FR-078 confirm → `deleteSession` once per session in order, with the pane id for the live one and its pane closed, rows gone after reload, bar hidden; SRS-FR-079 one `deleteSession` rejects → toast "2 of 3 sessions deleted", that row still ticked, bar "Delete selected (1)"; single Delete still toasts "Session could not be deleted" | Vitest + Testing Library, a new describe next to "Delete a session" in `App.test.tsx` |
| — real app | — | 3 real sessions, one running, moved to the macOS Trash; checkbox and bar look right in light and dark | task 2.2 demo |

## Risks / Trade-offs

- [Sequential delete of many sessions is slow] → each call is one file move; dozens finish in a second or two.
- [No designed UI for the checkbox and the bar] → reuse of existing classes; the PO checks the look in the demo.
- [A pane closes per live session, one after another] → expected by SRS-FR-078; closing is what SRS-FR-049 does.

## Migration Plan

UI only, no stored data. Rollback = revert the change.

## Open Questions

None.
