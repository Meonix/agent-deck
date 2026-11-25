## 1. Remove the Session History Panel tests (delete first)

- [x] 1.1 Delete these tests before touching the code they cover:
  - `src/App.test.tsx` › "New Session (5.4)": "is disabled until a folder is selected, then offered in the Session History Panel", "asks to select a folder while none is selected and no pane is open", "points to the history once a folder is selected", "starts from the empty state button too"
  - `src/App.test.tsx` › "Session list (2.1, 2.2)": "shows no Session History Panel before a folder is selected (SRS-FR-007)", "opens the Session History Panel with the folder name, New Session and Close (SRS-FR-007)", "closes the panel on Close and the panes take its width (SRS-FR-054)", "closes on a click on the selected folder and opens and reads again on the next (SRS-FR-054)", "opens the panel and reads again when the selected folder is added again (SRS-FR-007)", "keeps the panel open on another folder and shows that folder (SRS-FR-054)"
  - `src/App.test.tsx` › "Resume (2.1, 2.2)": "offers Resume only on the selected row", "clears the selection when another folder is selected"
  - `src/App.test.tsx` › "Jump from the Folder Tree (2.3)": "does not jump from a history row, which offers Resume instead" (and its `historyRowButton` helper)
  - `src/App.test.tsx` › "Delete selected sessions (1.1, 1.2)": "empties the selection on a switch of folder and on close (SRS-FR-076)"
  - `src/App.test.tsx` › "Maximize pane (2.1 to 2.4)" › "covers the window with the maximized pane and hides the others in place (SRS-FR-041)": only the assertion `expect(historyPanel()).toHaveAttribute("inert")`
  - `src/components/WorkspaceSidebar.test.tsx` › "Folder Tree rows (2.6)": "still selects a workspace and opens its Session History Panel on a click of its name"
- [x] 1.2 Grep the three test files (`src/App.test.tsx`, `src/components/WorkspaceSidebar.test.tsx`, `src/PaneShell.test.tsx`) for `sessionHistory`, `closeHistory`, `labels.resume`, `pickFolderHint`, `aria-pressed` on history rows and the `region` named `labels.sessionHistory`: every hit left is a helper use listed in 2.2, not a test of the panel

## 2. Test helpers for the chooser

- [x] 2.1 In `src/App.test.tsx` add `chooser()` (`getByRole("dialog", { name: <workspace> })`), `openChooser(user, name)` (click the + named `labels.openChooser(name)`), `chooserRow(title)`, `newSessionIn(user, name)` (open + "Phiên mới"); replace `historyPanel`, `newSessionButton`, `historyRow`, `row`, `selectRow`, `resumeButton`, `box`, `sessionsPanel` with them
- [x] 2.2 Repoint the remaining users of the old helpers: `selectAndStart`-style setups in "New Session (5.4)", "Split layout (2.1 to 2.3)", "Drag a pane (3.1 to 3.3)", "Reopen panes at launch (2.2 to 2.4)", "Maximize pane (2.1 to 2.4)" (SRS-FR-046 test fires the + click directly, see design.md › Risks), "Text Size", "Sidebar toggle (2.13)", "Delete a session (2.2 to 2.4)", "Delete selected sessions (1.1, 1.2)", "Stashed Sessions (CR-011)", "Vietnamese labels (SRS-NFR-008)", "Remote shapes, no One UI (app-theme)"; `openPaneIn` in `src/components/WorkspaceSidebar.test.tsx`; `newSessionButton` in `src/PaneShell.test.tsx`. Delete now goes through the row's trash icon, not pick + "Xoá"
- [x] 2.3 Add `labels.oldSessions`, `labels.openChooser(name)`, `labels.deleteSession(title)` and the new `noPanesHint` to `src/labels.ts` with `src/labels.test.ts` cases; keep the old keys until group 6

## 3. Open the Session Chooser (tests first)

- [x] 3.1 RED in `src/components/WorkspaceSidebar.test.tsx`: every workspace row in the tree and inside an open "Folder khác" has a + named `labels.openChooser(name)` between the count and ⋯; clicking + or the name calls `onOpenChooser` with that workspace and the clicked element; the + of a `Missing` row is there too
- [x] 3.2 RED in `src/App.test.tsx` › new `describe("Session Chooser (CR-016)")`: + on `agent-deck` opens a dialog named `agent-deck` with ×, "Phiên mới", "Mở lại phiên cũ" and 3 rows newest first with title and "2 phút trước" (SRS-FR-007, SRS-FR-008, SRS-FR-009); the pane grid keeps its size; the name click opens it too and the row gets `aria-current` (GATE 1); a subfolder session is absent; a second open reads the list again (SRS-FR-007)
- [x] 3.3 RED: skeleton rows with no "Đang tải" text while reading; "Chưa có phiên nào" with "Phiên mới" still shown (SRS-FR-010); "2 phiên không đọc được" with 8 rows (SRS-FR-011); a missing folder shows "Folder này không còn trên máy." and no read; the folder opened last wins when an earlier read answers later
- [x] 3.4 RED: an open session's row shows "Đang mở" instead of its time and no Status Highlight even when `Needs Approval` (SRS-FR-012, SRS-FR-032); after closing its pane the next open shows its time (SRS-FR-012); a new session appears on top as "Đang mở" on the next open (SRS-FR-019)
- [x] 3.5 RED: 200 listed sessions render within 3 s of the + click with a fake client answering at once (SRS-NFR-003)
- [x] 3.6 Implement `src/components/SessionChooser.tsx` from the list parts of `SessionHistoryPanel.tsx` (`.scrim`, `.dlg w-[440px]`, header, `.send` "Phiên mới", `side-label` "Mở lại phiên cũ", h-10 rows, `chip-idle` "Đang mở", skeleton), the `chooser` state and `openChooser` in `App.tsx`, the + and name wiring in `WorkspaceSidebar.tsx`, and `useSessionList(client, workspace, opens, openSessions, reloads)` — GREEN for 3.1 to 3.5

## 4. Close, focus and open a pane (tests first)

- [x] 4.1 RED: × closes and focus returns to the + of `agent-deck`; Esc closes and does not reach a focused pane's terminal; a mousedown on the scrim closes, one inside the dialog does not (SRS-FR-054); Tab and Shift+Tab cycle inside the dialog and never reach the Sidebar or a pane; "Phiên mới" has focus on open
- [x] 4.2 RED: "Phiên mới" (click or Enter on open) closes the chooser and opens a focused pane in that folder (SRS-FR-018, SRS-FR-014); on a `Missing` folder no pane opens and "Không tìm thấy folder" shows (SRS-FR-020)
- [x] 4.3 RED: clicking or pressing Enter on a row closes the chooser and opens the session focused (SRS-FR-013); on an "Đang mở" row it focuses the existing pane and the pane count stays (SRS-FR-015, SRS-FR-037); a stashed session opened from the chooser leaves "Để dành" (SRS-FR-109); checkbox and trash icon do not resume
- [x] 4.4 RED: the pane area with no pane reads "Chưa mở phiên nào" and "Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ." and has no button
- [x] 4.5 Implement the key and focus handling (capture-phase Esc/Tab, `focusin` guard, scrim mousedown, `closeChooser({ restoreFocus })`), the "Phiên mới" and row actions, and the empty state without action — GREEN for 4.1 to 4.4

## 5. Delete inside the chooser (tests first)

- [x] 5.1 RED: the trash icon shows on hover or focus within a row only; it asks "Chuyển "Scaffold Tauri app" vào Thùng rác?" in a dialog above the chooser (SRS-FR-048); "Huỷ" and Esc close only the confirm, the chooser stays with the row (SRS-FR-048); confirm moves the session and removes the row while the chooser stays open (SRS-FR-047); an open session asks "Đóng "<title>" và chuyển vào Thùng rác?" and closes its pane (SRS-FR-049); a failure keeps the row and shows "Không xoá được phiên" above the scrim (SRS-FR-050)
- [x] 5.2 RED: ticking two rows shows the footer "Chọn tất cả" and red "Xoá đã chọn (2)" below the rows, no row moves and no pane opens (SRS-FR-073, SRS-FR-074); "Chọn tất cả" gives "Xoá đã chọn (5)" (SRS-FR-075); the confirms "Chuyển 3 phiên vào Thùng rác?" and "Đóng 1 phiên đang mở và chuyển 3 phiên vào Thùng rác?", Cancel keeps the ticks (SRS-FR-077); confirm deletes all, closes the running pane and empties the selection (SRS-FR-078); one locked file leaves its row ticked and shows "Đã xoá 2/3 phiên" (SRS-FR-079)
- [x] 5.3 RED: closing the chooser by ×, Esc, outside click, "Phiên mới" or a row empties the Session Selection; reopening shows no tick (SRS-FR-076)
- [x] 5.4 Implement the trash button, footer and `blocked` (chooser `inert` and key handler off while the confirm shows), render the confirm after the chooser, empty the selection in `closeChooser` — GREEN for 5.1 to 5.3

## 6. Remove the panel

- [x] 6.1 Delete `src/components/SessionHistoryPanel.tsx`; drop `historyShown`, the 280px column in `gridColumns`, `historyOpen`, `closeHistory`, `selections` in `useWorkspaces.ts` (`select` only sets `selectedId`; SRS-FR-003 test still passes)
- [x] 6.2 Delete `labels.sessionHistory`, `closeHistory`, `pickFolderHint`, `resume` and their `labels.test.ts` cases
- [x] 6.3 Grep `src/` for `SessionHistoryPanel`, `historyOpen`, `historyShown`, `closeHistory`, `sessionHistory`, `pickFolderHint`, `280px`: no hit left

## 6b. Design follow-ups (behaviour unchanged)

- [x] 6b.1 One `useModalFocus(dialogRef, initialRef, onEscape, { active })` hook for the Esc/Tab capture handler, focusin guard and Tab cycling, used by `SessionChooser` and `ConfirmDialog` (skipping disabled controls in both); it releases its listeners before focus goes back to the opener, so the `blocked` prop and App's `refocus` workaround go away; unit test for the hook first
- [x] 6b.2 Move the chooser lifecycle out of `App.tsx` into `useSessionChooser` (open/dismiss/leave, re-read counter, selection reset, same-opening guard for delete-many); drop the `restoreFocus` flag; existing App tests stay green unchanged

## 7. Close

- [x] 7.1 `npm test` green
- [x] 7.2 `npx tsc --noEmit` clean
- [x] 7.3 `openspec validate update-session-chooser --strict`
- [x] 7.4 Build and run the app under a separate identifier (never close the running agent-deck) and screenshot against `design/agent-deck/cr016/design.html` `#chooser`, `#empty-chooser`, `#loading` and `#empty-no-panes`: chooser with a ticked row and the footer, an "Đang mở" row, the empty folder, the stacked delete confirm, light and dark — Session Chooser opened from "+" checked on the real app (dark); resume/delete focus and light left to the user's own run, since they need a real Claude session (agreed at GATE 3)
