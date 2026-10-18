## 1. Domain (seam S1)

- [x] 1.1 RED then GREEN for `zoomAction`, `nextTextSize`, `storedTextSize` in `src/components/textZoom.ts` (SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071)

## 2. UI (seam S2)

- [x] 2.1 RED then GREEN for `useTextZoom` in `App`: capture `keydown` listener, swallowing the key, `setZoom` through a new `ZoomClient` prop, `localStorage` read on mount and write after a change; Tauri `ZoomClient` in `src/api/zoom.ts`, `mac` and the client passed from `main.tsx`, `core:webview:allow-set-webview-zoom` in the capability (SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071)
- [x] 2.2 RED then GREEN for the refit of session terminals and Pane Shells through the `textSize` prop of `TerminalPane` and `ShellArea` (SRS-FR-072)

## 3. Verification

- [x] 3.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 3.2 Demo in the app on macOS: Cmd + twice, Cmd −, Cmd 0 scale sidebar, history, headers, terminals and a dialog; Ctrl − in a pane reaches Claude Code; quit at 130% and reopen → 130%; two panes with a shell redraw without broken lines
  - 2026-10-18: the PO approved without the scripted demo and will check the Zoom shortcut in daily use; bugs found there go through `/dev-bug`. Review minors left open: reject race with two pending zooms, 100% flash on launch, Cmd 0 on AZERTY, possible WebGL blur at 200%.
