## 1. Vietnamese labels (SRS-NFR-008)

- [x] 1.1 Add `src/labels.ts` with every user-facing string of `src/` in Vietnamese per SRS v1.16 › Bảng nhãn, plus `labels.state` for the five session states and the relative-time words
- [x] 1.2 Update the tests that assert English strings (`App.test.tsx`, `WorkspaceSidebar.test.tsx`, `TerminalPane.test.tsx`, `PaneShell.test.tsx`, `statusTone.test.tsx`, `sessionList.test.ts`, `Toast.test.tsx`) to the Vietnamese labels from the table — RED
- [x] 1.3 Replace the English literals in `App.tsx`, `WorkspaceSidebar.tsx`, `SessionHistoryPanel.tsx`, `TerminalPane.tsx`, `PaneShell.tsx`, `PaneGrid.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`, `statusTone.tsx`, `sessionList.ts`, `useSessionPanes.ts`, `useWorkspaces.ts` with the table; translate the status reasons the backend makes up (`labels.reason`) — GREEN
- [x] 1.4 Add an App test that renders the main states (no folders, folder selected with history, pane open, Close Dialog) and fails on any known English label

## 2. Remote shapes, no One UI (app-theme)

- [x] 2.1 Change the app-theme tests: Needs Approval pane has the 2px border and no glow; header buttons and sidebar buttons carry the Vietnamese names — RED
- [x] 2.2 Remove the `oneui/tokens-oneui.css` import and the One UI `@theme inline` block from `src/index.css`; add the remote classes (`.side`, `.bar`, `.dlg`, `.scrim`, `.chip-*`, `.allow`, `.outline-btn`, `.btn-danger`, `.toast`)
- [x] 2.3 Restyle `App.tsx` workbench, `WorkspaceSidebar.tsx` (no section tints), `SessionHistoryPanel.tsx`, `PaneGrid.tsx`, `TerminalPane.tsx` (no glow), `PaneShell.tsx`, `ConfirmDialog.tsx` (centred, scrim, outline/filled buttons), `Toast.tsx`, `statusTone.tsx` (RoundMark as remote dot/icon) with no One UI utility left — GREEN
- [x] 2.4 Delete `design/agent-deck/oneui/` and confirm nothing in `src/` references `oneui`

- [x] 2.5 Running is blue everywhere (SRS-FR-032 modified): no `--running-bg` tint on Running rows, Running text `--busy-foreground`; test first
- [x] 2.6 One sidebar width: `--sidebar-w` in `src/index.css`, used by the workbench grid and the Sidebar Toggle
- [x] 2.7 Remove the ported classes nothing uses yet (`.row-app`, `.row-err`, `.deny`, `.stop`, `.menu`, `.callout-info`, `.chip-run`)
- [x] 2.8 The shell start-failure box uses `.callout-err` like the other error boxes

## 3. Contrast (SRS-NFR-014, sidebar labels)

- [x] 3.1 Add a test that reads `design/agent-deck/tokens.css` and asserts the SRS-NFR-014 pairs and the modified sidebar-label pairs are at least 4.5:1 in `:root` and `.dark`

## 4. Close

- [x] 4.1 `npm test`, `npx tsc --noEmit`, `cargo test` (untouched backend still green), `openspec validate update-ui-foundation --strict`
- [x] 4.2 Run the app under a separate identifier and screenshot the main window against `design/agent-deck/cr016/design.html#final` — launch screen (dark) checked; panes, dialogs and light left to the user's own run (agreed at GATE 3)
