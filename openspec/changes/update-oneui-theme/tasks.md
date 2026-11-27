## 1. Shape layer

- [x] 1.1 Extend the tokens contrast test to read `design/agent-deck/tokens-oneui.css`: `--muted-foreground` and every status word against `--oneui-surface`, subheader against `--oneui-canvas`, in `:root` and `.dark` — RED
- [x] 1.2 Import `tokens-oneui.css` in `src/index.css`; canvas, card and radius utilities — GREEN

## 2. Cards (app-theme, SC-1)

- [x] 2.1 Test: workbench has the canvas background and gap; Sidebar and every pane are cards with the card radius — RED
- [x] 2.2 `App.tsx`, `WorkspaceSidebar.tsx` (card, 22px title, subheaders), `PaneGrid.tsx` (inset rects, dividers in the gap, no line), `TerminalPane.tsx` (card, inset attention ring, Focus Outline outside) — GREEN
- [x] 2.3 Remove `--approval-glow`, the mono uppercase `.side-label` and every use of `--section-*` in `src/`

## 3. Session Row and pane header (status-board SRS-FR-032, session-pane SRS-FR-030, SC-2)

- [x] 3.1 Delete the dot-shape assertions of the old scenarios; test the 28px round icon per state (filled for Running, Needs Approval, Idle, Error; hollow for Ended) and the 52px two-line row; Row Focus Mark still a 3px left bar — RED
- [x] 3.2 `statusTone.tsx` RoundMark, `WorkspaceSidebar.tsx` rows — GREEN
- [x] 3.3 Test: pane header starts with the round icon; the View Switch item shown has `--primary`; below 560px the View Switch moves to a second line — RED, then `TerminalPane.tsx`, `ViewSwitch.tsx` — GREEN

## 4. Dialogs and Session Chooser (session-history SRS-FR-007, SC-3)

- [x] 4.1 Delete the "45% scrim" assertion; test the dialog radius, the blurred dim backdrop and text actions split by a rule, still centred — RED
- [x] 4.2 `.scrim`, `.dlg`, `ConfirmDialog.tsx`, `SessionChooser.tsx` — GREEN

## 5. Blocks in the pane

- [x] 5.1 Composer, Approval Strip, Question Card, Plan card, Suggestion Menu, Folder Menu, Activity Bar, Toast restyled as 18px blocks / pills per `design.html` (existing behaviour tests stay green)

## 6. Close

- [x] 6.1 `npm test`, `npx tsc --noEmit`, `openspec validate update-oneui-theme --strict`
- [x] 6.2 Run the app and screenshot the main window, a dialog and dark against `design/agent-deck/oneui/design.html#final` — empty window (dark) checked; panes, dialogs and light left to the user's own run
