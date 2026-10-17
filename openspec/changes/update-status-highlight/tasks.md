## 1. Domain (seam S1)

- [ ] 1.1 Delete `statusBoard.test.ts` and `boardCards`; RED then GREEN for `sessionHighlights` and `folderHighlights` in `statusHighlight.ts` (SRS-FR-032, SRS-FR-036, SRS-FR-040)

## 2. UI (seam S2)

- [ ] 2.1 Delete the "Status Board and pane state" tests in `App.test.tsx`; RED then GREEN for session row highlight, chip, detail line and "Live ·", Status Board region gone (SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-012); `statusTone` `fill`; `App` grid `260px_1fr`; delete `BoardColumn.tsx`
- [ ] 2.2 RED then GREEN for the folder row highlight and badge, selected and unselected folder (SRS-FR-040)
- [ ] 2.3 Delete the "Jump from a Status Board card" tests; RED then GREEN for click and Enter on a highlighted row, no jump from a plain row (SRS-FR-037)
- [ ] 2.4 Comments that say "board": `useSessionPanes.ts`, `TerminalPane.tsx`, `status_latency.rs`, `pane_status.rs`, `hooks.rs`; latency record test still green (SRS-FR-038)

## 3. Verification

- [ ] 3.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output; grep shows no `StatusBoard`, `boardCards`, "Status Board" left in `src/`
- [ ] 3.2 Demo in the app: dark and light, a `Needs Approval` pane in a second folder shows on its folder row; click the row in the session list, press `1` → answered in that pane
