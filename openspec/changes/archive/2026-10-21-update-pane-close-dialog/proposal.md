## Why

CR-009 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-21): after closing a pane with × the user often
goes to the Session History Panel only to delete the same session by hand. Closing on purpose is the moment to
decide whether the session is worth keeping. `/exit` stays as it is. SRS v1.9, backlog item 24.

## What Changes

- **BREAKING (UI)**: × on a pane header always shows the Close Dialog — title `Close "<title>"?`, buttons
  Cancel · Close · Close and move to Trash — in every state, including `Idle` (SRS-FR-100). Before, an idle pane
  with an idle shell closed at once.
- The two separate dialogs "Session is still running. Close anyway?" and "A command is still running in the
  shell. Close anyway?" are removed; their warnings become lines inside the Close Dialog (SRS-FR-027,
  SRS-FR-063). A pane busy in both ways shows both lines in one dialog.
- Close and move to Trash closes the pane and moves the session's history to the trash, with no second
  "Move … to Trash?" dialog (SRS-FR-101); a failed move keeps the session in the Session History Panel and shows
  "Session could not be deleted", the pane stays closed (SRS-FR-102).
- Unchanged: `/exit` closes the pane with no dialog and keeps the history (SRS-FR-083); Delete on a history row
  (SRS-FR-047 to SRS-FR-050).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-pane`: "Confirm closing a busy pane" becomes a warning line in the Close Dialog (SRS-FR-027); "Close
  pane ends its session" goes through Close (SRS-FR-029); "Close Dialog on pane close" added (SRS-FR-100).
- `pane-shell`: "Confirm closing a pane with a busy shell" becomes a warning line in the Close Dialog
  (SRS-FR-063).
- `session-history`: "Close and move to Trash" and "Report delete failure after close" added (SRS-FR-101,
  SRS-FR-102).

## Impact

- UI: `src/App.tsx` — `requestClose` always opens one close state; the two close `ConfirmDialog`s are replaced by
  one Close Dialog; Close and move to Trash reuses `deleteOne`.
- UI: `src/components/ConfirmDialog.tsx` gains an optional extra action, or a sibling `CloseDialog` component
  (decided in design).
- Tests: `App.test.tsx` and `PaneShell.test.tsx` cases that press "Close pane" now choose Close in the dialog;
  the "closes at once" cases are removed.
- Rust: none — `delete_session` with a pane id already ends the session before moving its history.
