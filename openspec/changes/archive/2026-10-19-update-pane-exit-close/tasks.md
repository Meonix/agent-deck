## 1. Pane closes on normal exit (seam S1)

- [x] 1.1 Switch the `App.test.tsx` cases that reach an ended pane with `exit(0)` to `exit(1)` (Session ended, title timer stops, Live label dropped, delete of an ended pane, close dialog dismissed, diagnostics); they stay green on the old code
- [x] 1.2 RED then GREEN: `exit(0)` closes the pane through `closePane` (`sessions.close` called, region gone, other pane fills the grid, no dialog, row leaves Active Sessions); `exit(0)` in the maximized pane shows the layout; `exit(1)` and `exit(null)` keep "Session ended" (SRS-FR-028, SRS-FR-083) — `useSessionPanes.ts` `onExit(code)`

## 2. Pane Shell on exit (seam S2)

- [x] 2.1 Change the `PaneShell.test.tsx` "shell outlives the session" case to `exit(1)`; RED then GREEN: session `exit(0)` with an open shell closes the pane and disposes the shell stream (SRS-FR-064, SRS-FR-083)

## 3. Verification

- [x] 3.1 Run `npm test`, `npm run build`, `cargo test` and paste the output; `openspec validate update-pane-exit-close --strict`
- [ ] 3.2 Demo in the app: three panes, `/exit` in the middle one → it closes, the other two widen; kill a `claude` process → "Session ended" stays
  - 2026-10-19: the PO approved without the scripted demo; bugs found in daily use go through `/dev-bug`.
