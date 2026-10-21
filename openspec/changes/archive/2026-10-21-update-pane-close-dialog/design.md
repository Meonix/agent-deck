## Context

`requestClose(paneId)` in `src/App.tsx` asks the shell for its activity, then opens one of two
`ConfirmDialog`s — `confirming` (session `Running`/`Needs Approval`, dropped by an effect as soon as the session
stops being busy) or `confirmingShell` (shell running a command) — and otherwise calls `panes.closePane` at once.
`ConfirmDialog` has Cancel plus one action, Escape cancels, Tab cycles between its two buttons. Delete on a
history row goes through `deleteOne`, which calls `sessions.deleteSession(workspaceId, id, paneId)` — the backend
takes the pane's process, ends it, then moves the history — and then `panes.closePane(paneId)` unless the error
is `wrong_pane`; it treats `not_found` as already gone. Requirements: SRS v1.9, CR-009; leftover table approved
at GATE 1.

## Goals / Non-Goals

**Goals:**

- × always opens one Close Dialog: `Close "<title>"?`, Cancel · Close · Close and move to Trash (SRS-FR-100).
- Busy session and busy shell are warning lines inside that dialog, never a dialog of their own (SRS-FR-027,
  SRS-FR-063).
- Close and move to Trash closes the pane and trashes the history; failure keeps the row and shows "Session could
  not be deleted" (SRS-FR-101, SRS-FR-102).

**Non-Goals:**

- `/exit` (SRS-FR-083) and Delete on a history row (SRS-FR-047 to SRS-FR-050, SRS-FR-077 to SRS-FR-079): unchanged.
- A keyboard shortcut for closing a pane — none exists today, none is added.
- `design/agent-deck/design.html` and `brief.md` still draw the old dialog; the layout was settled in CR-009,
  the design files are not updated by this change.

## Decisions

- **One `closing` state replaces `confirming` and `confirmingShell`.** `{ paneId, shellCommand: string | null |
  undefined }` (`undefined` = shell idle or absent) is set on every ×. The session warning is computed at render
  from the live entry (`isBusy`), so it appears or disappears with the status; the old effect that dropped the
  dialog once the session went idle goes away — the dialog now stays until the user answers. The dialog also
  goes away when its pane disappears (e.g. `/exit` while it is open), as today.
- **`ConfirmDialog` grows an optional `extra` action instead of a new component.** `extra?: { label: string;
  onChoose(): void }` renders a third button after the main action; Tab cycles through all buttons. Every other
  caller keeps two buttons. Alternative — a separate `CloseDialog` — would duplicate the focus trap and Escape
  handling that `ConfirmDialog` already gets right.
- **Button order and roles.** Cancel (initial focus) · Close (neutral border) · Close and move to Trash (the
  existing red `action` style). The trash button is the red `action`, since it is the one that removes data;
  the neutral Close is the `extra`. A pane with no history gets no `extra` and `action="Close"`: Cancel · Close.
- **Close and move to Trash reuses `deleteOne`.** It is called with `{ workspaceId, id: sessionId, title, paneId,
  live: !ended }`; the backend ends the session before moving anything, `deleteOne` closes the pane whatever the
  move's outcome (except `wrong_pane`), then `confirmDelete`'s toast/reload logic applies. That gives SRS-FR-102 for
  free: pane closed, row kept, "Session could not be deleted". The shared `inFlight` guard also stops a history
  Delete of the same session running at the same moment.
- **"Has history" = started and titled.** The trash button is hidden when `!pane.started` or the title is still
  `UNTITLED` — RULE-01 shows "(untitled)" only for a session with no prompt yet, which is exactly a session with no
  history file. A session that got its first prompt less than one title refresh (10 s) ago may still show no
  trash button; the user can then Delete it from the history.

## Seams to test

- **S1 — App with a fake `SessionsClient` (`App.test.tsx`)**: × on an idle pane → dialog `Close "<title>"?` with
  three buttons, no warning line, pane still open; Cancel/Escape → pane kept, `sessions.close` not called; Close →
  `sessions.close` called, row still in history; Close and move to Trash → `sessions.deleteSession(ws, id, paneId)`
  called, pane gone, list reloaded; rejected move → pane gone, toast "Session could not be deleted"; `Running`
  pane → line "Session is still running."; untitled pane → no trash button; `/exit` with the dialog open → dialog
  gone. Covers SRS-FR-027, SRS-FR-029, SRS-FR-100, SRS-FR-101, SRS-FR-102.
- **S2 — Pane Shell flow (`PaneShell.test.tsx`)**: busy shell → line "A command is still running in the shell."
  in the Close Dialog; shell at prompt → dialog without the line; busy session + busy shell → one dialog with
  both lines. Covers SRS-FR-063.
- **S3 — `ConfirmDialog`** through S1/S2 only: the extra button and Tab order are exercised there; no separate
  unit test.

No new seam in Rust or in `TerminalPane` (its × still only calls `onClose`).

## Risks / Trade-offs

- [Every close is now one click more] → accepted by the PO in CR-009; Enter on the focused Cancel does nothing
  harmful, Tab reaches Close in one step.
- [About 25 existing tests press "Close pane" and expect the pane gone] → a shared `closeVia(user, "Close")`
  helper in each test file; the cases that asserted "closes at once" are deleted first (old test green = old
  behaviour alive).
