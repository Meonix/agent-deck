## 1. UI (seam S1)

- [x] 1.1 RED then GREEN for the Session Selection: row checkbox, selection bar with "Select all" and "Delete selected (<n>)", selection in `Workbench`, cleared on switch and close, pruned after reload (SRS-FR-073, SRS-FR-074, SRS-FR-075, SRS-FR-076)
- [x] 1.2 RED then GREEN for deleting the selection: `deleteOne` shared with the single Delete, one confirmation, sequential loop, failed ones kept ticked with "<k> of <n> sessions deleted" (SRS-FR-077, SRS-FR-078, SRS-FR-079)

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run build` and paste the output
- [ ] 2.2 Demo in the app: tick 3 sessions with one running, Delete selected → one dialog, pane closes, 3 in the macOS Trash; switch folder clears ticks; look of the checkbox and bar in light and dark
  - 2026-10-18: the PO approved without the scripted demo and will check bulk delete in daily use; bugs found there go through `/dev-bug`. Review minors left open: same aria-label for rows with the same title, no focus ring on the bar buttons (as on Resume / Delete).
