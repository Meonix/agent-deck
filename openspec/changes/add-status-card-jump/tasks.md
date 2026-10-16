## 1. UI (seam S1)

- [ ] 1.1 Status Board cards as buttons with `onJump`; `useSessionPanes.jumpTo(paneId)` through `focusHolder`; wired in `App` (SRS-FR-037)

## 2. Verification

- [ ] 2.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 2.2 Demo in the app: with two panes, make one ask for approval, focus the other, click the `Needs Approval` card, press `1` → the prompt is answered in that pane
