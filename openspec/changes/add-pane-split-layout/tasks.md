## 1. Layout (seam S1)

- [x] 1.1 `paneTree.ts`: `splitPane`, `removePane`, `setRatio`, `paneOrder`, `layoutRects` (SRS-FR-021, SRS-FR-022, SRS-FR-023)

## 2. UI (seam S2)

- [x] 2.1 `useSessionPanes` keeps the layout: sidebar New Session / Resume split the focused pane right, `splitFrom(paneId, dir)` opens a session in that pane's folder, close gives space to the sibling; new session sized to half the split pane (SRS-FR-021, SRS-FR-022)
- [x] 2.2 `PaneGrid` positions panes and dividers from `layoutRects`; dragging a divider sets the ratio with the 200 × 120 px minimum (SRS-FR-023)
- [x] 2.3 ⇥ / ⇣ buttons in the pane header wired through `App` (SRS-FR-022)

## 3. Concurrency (seam S3)

- [ ] 3.1 Rust test: 4 busy PTY sessions, echo p95 < 100 ms on one of them (SRS-NFR-001)

## 4. Verification

- [ ] 4.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 4.2 Demo in the `.app`: ⇣ on a pane → new pane below in the same folder, focused; ⇥ → right; drag a vertical and a horizontal divider → both panes follow and sessions reflow; close a pane → its sibling fills the space; 4 real Claude Code sessions busy at once with `localStorage.adLatency = "1"` → logged p95 ≤ 100 ms (SRS-NFR-001)
- [ ] 4.3 Windows 11 — deferred by the PO; leave unchecked
