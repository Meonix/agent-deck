## Why

CR-016 (approved 2026-11-24) moves agent-deck onto the look of agent-deck-remote. Backlog item 36 replaces the Session History Panel — a 280px column that opens between the Sidebar and the panes when a workspace is selected and squeezes every pane — with the Session Chooser of SRS v1.17: a 440px dialog opened from the + on a workspace row, holding "Phiên mới" and the workspace's old sessions, where clicking a row reopens it. Opening a session stays within the 3 actions of BO-02 (+, row) and the panes no longer change size when the user looks at a folder's history.

## What Changes

- **BREAKING (UI)** The Session History Panel and its 280px column are removed; the workbench grid is Sidebar | panes. The Session Chooser takes its place as a modal dialog centred over a 45% scrim (SRS-FR-007).
- Every workspace row of the Folder Tree, including rows inside "Folder khác", gets a + button that opens the Session Chooser of that workspace (SRS-FR-007). Clicking the workspace name opens it too (PO decision at GATE 1, not in the SRS). The chooser re-reads the sessions each time it opens.
- Chooser content: header with the workspace name and ×, a primary "Phiên mới" button, the label "Mở lại phiên cũ", then one row per session newest first with a checkbox, the title, the relative time or the "Đang mở" chip, and a trash icon on the hovered or focused row (SRS-FR-008, SRS-FR-009, SRS-FR-012); "Chưa có phiên nào" when there is none (SRS-FR-010); "<N> phiên không đọc được" (SRS-FR-011); skeleton rows while loading; all within 3 s for 200 sessions (SRS-NFR-003).
- Esc, a click outside the dialog or × closes it (SRS-FR-054); the click on the selected workspace no longer toggles anything. Choosing "Phiên mới" (SRS-FR-018) or a session row (SRS-FR-013) closes the chooser and opens the pane; the separate "Mở lại" button and the picked-row state are gone. Focus is trapped in the dialog and returns to the opener when it closes without opening a pane.
- Delete moves into the chooser: the trash icon asks "Chuyển "<title>" vào Thùng rác?" (SRS-FR-047, SRS-FR-048, SRS-FR-050); ticking rows shows "Chọn tất cả" and "Xoá đã chọn (<n>)" with the confirm "Chuyển <n> phiên vào Thùng rác?" or "Đóng <k> phiên đang mở và chuyển <n> phiên vào Thùng rác?" (SRS-FR-073 to SRS-FR-079). The confirm dialog stacks above the chooser. The Session Selection empties when the chooser closes (SRS-FR-076).
- **BREAKING (UI)** The empty pane area loses its "Phiên mới" button and the "Chọn một folder…" hint; it reads "Chưa mở phiên nào" and "Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ.".
- Maximize covers the Sidebar and the other panes (SRS-FR-041); the Sidebar Toggle scenarios no longer rely on a selected folder (SRS-FR-088).
- Wording only: every requirement that said "Session History Panel" or "Resume" now says Session Chooser or session row (SRS-FR-015, SRS-FR-016, SRS-FR-019, SRS-FR-020, SRS-FR-029, SRS-FR-032, SRS-FR-037, SRS-FR-100, SRS-FR-101, SRS-FR-102, SRS-FR-104, SRS-FR-109, SRS-FR-110, SRS-FR-112, SRS-NFR-005, SRS-NFR-007, SRS-NFR-008).
- Unchanged on purpose: the selected workspace survives only for SRS-FR-003 (adding a folder twice selects its row, `aria-current`) and is set when a chooser opens; no View Switch (item 37); no Settings (item 45); the stash behaves as before.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `session-history`: the Session Chooser replaces the Session History Panel for listing, live mark, delete and multi-select delete (SRS-FR-007 to SRS-FR-012, SRS-FR-019, SRS-FR-047, SRS-FR-048, SRS-FR-050, SRS-FR-073 to SRS-FR-079, SRS-FR-101, SRS-FR-102, SRS-NFR-003, SRS-NFR-005, SRS-NFR-007); "Close the Session History Panel" is renamed "Close the Session Chooser" (SRS-FR-054).
- `session-resume`: a session row in the Session Chooser resumes on click and closes the chooser (SRS-FR-013, SRS-FR-015, SRS-FR-016).
- `session-pane`: "Phiên mới" in the Session Chooser starts a session (SRS-FR-018, SRS-FR-020); close scenarios point at the chooser (SRS-FR-029, SRS-FR-100).
- `pane-layout`: Maximize covers the Sidebar and the other panes (SRS-FR-041).
- `session-stash`: scenarios read the history through the Session Chooser (SRS-FR-104, SRS-FR-109, SRS-FR-110, SRS-FR-112).
- `status-board`: the Live row of SRS-FR-032 and the "history row does not jump" scenario of SRS-FR-037 move to the chooser.
- `sidebar-toggle`: Toggle sidebar by button keeps fold state instead of a selected folder (SRS-FR-088).
- `app-shell`: the Vietnamese-label scenario opens the Session Chooser instead of the Session History Panel (SRS-NFR-008).

## Impact

- New `src/components/SessionChooser.tsx` built from the list, delete and selection parts of `src/components/SessionHistoryPanel.tsx`, which is deleted.
- `src/App.tsx`: one `chooser` state (workspace id or null) replaces `historyOpen`/`historyShown`; `gridColumns` loses the 280px column; the empty state loses its action; the delete and selection handlers stay.
- `src/components/useWorkspaces.ts`: `select` no longer toggles a panel; `historyOpen`, `closeHistory` and `selections` go; `selected` stays for SRS-FR-003 and the chooser.
- `src/components/useSessionList.ts`: reads only while the chooser is open, again on every open.
- `src/components/WorkspaceSidebar.tsx`: + button on every workspace row (tree and "Folder khác"); the name button opens the chooser.
- `src/components/ConfirmDialog.tsx`: unchanged; it is rendered after the chooser so it stacks above it.
- `src/labels.ts`: adds `oldSessions` "Mở lại phiên cũ", `openChooser(name)`, `deleteSession(title)`; `noPanesHint` becomes "Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ."; drops `sessionHistory`, `closeHistory`, `pickFolderHint`, `resume`.
- Tests: `App.test.tsx`, `components/WorkspaceSidebar.test.tsx`, `PaneShell.test.tsx` — tests of the panel are deleted first (tasks.md group 1), helpers move to a `chooser()` helper.
- No backend, data format or Claude Code configuration change.
