## 1. Domain (seam S1)

- [ ] 1.1 RED then GREEN for `activeSessions(entries)` in `statusHighlight.ts`: every started pane once across folders, ended pane kept, unstarted absent, urgency order, earliest first, untracked as `Idle`, `highlighted` flag (SRS-FR-032, SRS-FR-051, SRS-FR-052)

## 2. UI (seam S2)

- [ ] 2.1 Delete the tests "asks to select a folder first", "keeps the Live mark on a highlighted row", "does not jump from a row without a highlight", "leaves Enter alone on a row without a highlight"; RED then GREEN for the Session History Panel: opens on select with folder name, New Session and Close, no panel before a folder is chosen; move `SessionList` / `SessionRows` into `SessionHistoryPanel.tsx` without the highlight branch; App grid with the third column; point the existing session list, Resume, Delete and New Session tests at the panel (SRS-FR-007 to SRS-FR-013, SRS-FR-019, SRS-FR-047 to SRS-FR-050, SRS-NFR-003)
- [ ] 2.2 RED then GREEN for closing: Close button, click on the selected folder, third click opens and reads again, other folder keeps it open; rewrite "reads the list again every time the folder is selected" (SRS-FR-054)
- [ ] 2.3 RED then GREEN for Active Sessions in the sidebar: rows of two folders with folder names, urgency order, highlight and detail line on Active rows only, "No active sessions"; move the "Status Highlight on session rows" tests to the Active list (SRS-FR-032, SRS-FR-033, SRS-FR-051, SRS-FR-052, SRS-FR-053)
- [ ] 2.4 RED then GREEN for the jump: click and Enter on any Active row, Idle row too, Enter kept from the terminal, history row does not jump; move the "Jump from a highlighted session row" tests (SRS-FR-037)
- [ ] 2.5 RED then GREEN for the tints and the maximized cover: sections carry `bg-section-folders` / `bg-section-active`, panel and Active Sessions are `inert` while a pane is maximized (SRS-NFR-009, SRS-FR-041)

## 3. Verification

- [ ] 3.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output; run the WCAG script over `tokens.css` for both themes (SRS-NFR-009); grep shows no `aria-label="Sessions"` and no "Select a folder to see its sessions." left in `src/`
- [ ] 3.2 Demo in the app: dark and light tints, a `Needs Approval` pane in a second folder on top of Active Sessions, click it and press `1`; open and close the panel and see the panes refit
