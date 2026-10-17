## 1. UI (seam S1)

- [x] 1.1 Status Board cards as buttons with `onJump`; `useSessionPanes.jumpTo(paneId)` through `focusHolder`; wired in `App` (SRS-FR-037)

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 2.2 Demo in the app: with two panes, make one ask for approval, focus the other, click the `Needs Approval` card, press `1` → the prompt is answered in that pane
  - 2026-10-17: the PO dropped the scripted demo and will check the jump in daily use; bugs found there go through `/dev-bug`.
