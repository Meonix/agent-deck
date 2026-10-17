## 1. Domain (seam S1)

- [ ] 1.1 RED then GREEN for `maximizedBadge(entries, maximizedPaneId)` in `statusHighlight.ts` (SRS-FR-044, SRS-FR-045)

## 2. UI (seam S2)

- [ ] 2.1 RED then GREEN for Maximize / Restore: `maximizedId`, `maximize`, `restore` in `useSessionPanes`; header button; fixed overlay and hidden `inert` panes in `PaneGrid`; sidebar `inert`; closing the maximized pane clears it (SRS-FR-041, SRS-FR-042)
- [ ] 2.2 RED then GREEN for the refit on maximize and restore through the `maximized` prop of `TerminalPane` (SRS-FR-043)
- [ ] 2.3 RED then GREEN for restore before a new pane in `openPane` (SRS-FR-046)
- [ ] 2.4 RED then GREEN for the badge in the maximized pane header and its click: restore, then `jumpTo` (SRS-FR-044, SRS-FR-045)

## 3. Verification

- [ ] 3.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 3.2 Demo in the app: maximize a pane among three, Tab stays inside it; a covered pane asks for approval → badge within 3 s; click the badge → layout back with the same sizes, that pane focused, its terminal content intact
