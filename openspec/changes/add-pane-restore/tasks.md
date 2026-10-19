## 1. Snapshot (seam S1)

- [x] 1.1 RED then GREEN in `paneSnapshot.test.ts`: `snapshotOf` (ended, not started, not prompted left out; ratios kept), `rebuildLayout` (rename, remove), `readSnapshot` / `writeSnapshot` (missing, broken, wrong version) (SRS-FR-084)

## 2. Remember and reopen (seam S2)

- [x] 2.1 Split `startPane` out of `openPane` with no behaviour change (existing tests green); `PaneEntry.prompted` set on resume and on a `Running` / `Needs Approval` status
- [x] 2.2 RED then GREEN: the snapshot is written as panes open, move, resize and close, and not before the launch restore has run (SRS-FR-084)
- [x] 2.3 RED then GREEN: `reopenPanes` from `App` once the folder list loads — resume ids, saved rects, no maximize, no shell, focus on the last pane (SRS-FR-085)
- [x] 2.4 RED then GREEN: missing folder, folder gone from the list, rejected resume → pane left out, others widen, toast "<k> sessions could not be reopened" (SRS-FR-086)

## 3. Verification

- [x] 3.1 Run `npm test`, `npm run build`, `cargo test` and paste the output; `openspec validate add-pane-restore --strict`
- [ ] 3.2 Demo in the app: two panes at 30/70 with prompts, quit, start → both back; delete one session's file, restart → "1 sessions could not be reopened"
  - 2026-10-19: the PO approved without the scripted demo; bugs found in daily use go through `/dev-bug`.
