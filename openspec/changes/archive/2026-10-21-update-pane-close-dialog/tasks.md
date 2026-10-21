## 1. Close Dialog on every × (seam S1)

- [x] 1.1 Delete the tests that assert × closes an idle pane at once (`App.test.tsx` "closes the pane through the client and removes it" as written, `PaneShell.test.tsx` "shell at its prompt does not ask"); add a `closeVia` helper and switch every other "Close pane" click in `App.test.tsx` and `PaneShell.test.tsx` to × + Close; run — the switched tests go RED on the old code where no dialog appears
- [x] 1.2 RED then GREEN: × on an idle pane shows `Close "<title>"?` with Cancel · Close · Close and move to Trash; Cancel and Escape keep the pane; Close calls `sessions.close` and keeps the history row; `/exit` while the dialog is open removes it (SRS-FR-029, SRS-FR-100) — `ConfirmDialog` `extra` action, one `closing` state in `App.tsx`
- [x] 1.3 RED then GREEN: untitled or not-started pane → no Close and move to Trash button (SRS-FR-100)

## 2. Warnings inside the dialog (seams S1, S2)

- [x] 2.1 Delete the tests that expect the dialogs "Session is still running. Close anyway?" and "A command is still running in the shell. Close anyway?"; RED then GREEN: `Running`/`Needs Approval` pane → line "Session is still running."; busy shell → line "A command is still running in the shell."; both → one dialog with both lines (SRS-FR-027, SRS-FR-063)

## 3. Close and move to Trash (seam S1)

- [x] 3.1 RED then GREEN: Close and move to Trash calls `deleteSession(workspaceId, sessionId, paneId)`, the pane closes, the history reloads, no "Move … to Trash?" dialog (SRS-FR-101)
- [x] 3.2 RED then GREEN: a rejected move closes the pane, keeps the row and shows "Session could not be deleted" (SRS-FR-102)

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run build`, `cargo test` and paste the output; `openspec validate update-pane-close-dialog --strict`
- [ ] 4.2 Rebuild the release bundle; demo in the app: × on an idle pane → three buttons; Close and move to Trash → row gone from history and file in the Trash; `/exit` → pane closes with no dialog
  - 2026-10-21: the PO approved without the scripted demo; bugs found in daily use go through `/dev-bug`.
