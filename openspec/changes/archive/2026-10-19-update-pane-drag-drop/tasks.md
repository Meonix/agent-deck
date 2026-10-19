## 1. Layout tree (seam S1)

- [x] 1.1 RED then GREEN in `paneTree.test.ts`: `movePane` for left, right, top, bottom, from a nested position, same pane and unknown ids; `dropSide` for each edge (SRS-FR-081)

## 2. Remove the split buttons (seam S2)

- [x] 2.1 Rewrite the `App.test.tsx` tests that use Split right / Split down: right splits through New Session, down splits through the drag added in 3.x (keep them skipped until 3.2 is green); SRS-FR-046 and the toast test through New Session; `TerminalPane.test.tsx` header test lists Shell, Maximize, Close
- [x] 2.2 RED then GREEN: no Split right / Split down button on a pane header (SRS-FR-022); delete the buttons, `onSplit`, `splitFrom` and the `App` wiring

## 3. Drag and drop (seam S2)

- [x] 3.1 RED then GREEN: dragging a header over another pane past 4 px shows its Drop Zones with the side under the pointer; none with one pane, from a header button, while maximized or below the threshold (SRS-FR-080) — `PaneGrid.tsx`, `data-drag-handle` on the `TerminalPane` header
- [x] 3.2 RED then GREEN: dropping moves the pane (`useSessionPanes.movePane`, `onMove` in `App`), sessions untouched, terminals not re-opened, moved pane keeps focus; un-skip the tests from 2.1 (SRS-FR-081)
- [x] 3.3 RED then GREEN: Esc and a release on the dragged pane itself leave the layout (SRS-FR-082)

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run build`, `cargo test` and paste the output; `openspec validate update-pane-drag-drop --strict`; grep shows no `splitFrom`, `onSplit`, "Split down" left in `src/`
- [ ] 4.2 Demo in the app: three panes, drag one to each of the four sides of another, Esc mid-drag, dark and light theme
  - 2026-10-19: the PO approved without the scripted demo; bugs found in daily use go through `/dev-bug`.
