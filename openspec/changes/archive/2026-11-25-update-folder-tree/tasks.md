## 1. Tree model in `statusHighlight.ts` (unit tests first)

- [x] 1.1 In `src/components/statusHighlight.test.ts`, add a `folderTree` block — RED: Session Rows nested under their workspace, no workspace name on the row (SRS-FR-051); a pane that ended stays as `Ended` until closed (SRS-FR-051); workspace with `Needs Approval`/`Error` first, rest in Workspace List order, both groups stable (SRS-FR-052); rows by `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, then `since` (SRS-FR-052); untracked pane ordered with `Idle`, not highlighted (SRS-FR-036)
- [x] 1.2 Add count cases — RED: 1 `Error` + 1 `Needs Approval` + 2 `Running` → `{ n: 2, tone: "Error" }`; approvals only → `Needs Approval` tone; 2 `Idle` → `{ n: 2, tone: "grey" }`; `Running` + `Idle` → grey 2; untracked pane counts only in the grey number (SRS-FR-040)
- [x] 1.3 Add Other Folders and stash cases — RED: workspaces with no started pane go to `other` in Workspace List order, `Missing` included; a pane of `mokairo` moves it out of `other` (SRS-FR-141); `stash` keeps the newest-first order of the stash list (SRS-FR-106)
- [x] 1.4 Move the resumed-session cases ("shows a resumed session once, through its live pane", "keeps the ended pane when resuming its session failed to start", "does not count the ended pane in its folder") onto `folderTree`
- [x] 1.5 Implement `folderTree(entries, workspaces, stashed)` returning `{ open, other, stash }` per design.md, reusing `currentPanes` and `ACTIVE_ORDER` — GREEN
- [x] 1.6 Delete `activeSessions`, `folderHighlights`, `ActiveSession`, `FolderHighlight` and their test blocks `describe("activeSessions (1.1)")` and `describe("folderHighlights (1.1)")` once 1.4 covers their cases; `maximizedBadge` and its tests stay

## 2. Folder Tree rendering in `WorkspaceSidebar`

- [x] 2.1 Add to `src/labels.ts` (and `labels.test.ts`): `otherFolders(n)` "Folder khác (n)", `viewFiles` "Xem file", `copyPath` "Chép đường dẫn", `copyPathFailed` "Không chép được đường dẫn", `folderMenu(name)`, `collapse(name)`, `expand(name)`; keep `stashedCount`, `removeFolder`, `addFolder`
- [x] 2.2 In `src/App.test.tsx`, add a `describe("Folder Tree (CR-016)")` block with a `sessionRow(title)` / `workspaceRow(name)` helper querying the tree — RED: two folders with their rows under them (SRS-FR-051); the five states show dot + word, only `Needs Approval`/`Error` tinted, `Running` blue untinted (SRS-FR-032); detail line "14:02 · Edit src/main.rs" under `Cần duyệt`, none under `Đang chạy` (SRS-FR-033); `mokairo` with an `Error` pane moves above `agent-deck` (SRS-FR-052); counts "2" red and "2" grey (SRS-FR-040); an `Error` pane closed drops its row (RULE-08)
- [x] 2.3 Add RED tests for jump and focus: click and Enter on a Session Row focus its pane, Enter does not reach the terminal, `Idle` rows jump too (SRS-FR-037); the focused pane's row has `.side-on` and the iris bar, also on a `Needs Approval` row, and only one row has it; none when no pane is focused (SRS-FR-099)
- [x] 2.4 Add RED tests for collapse: chevron hides and shows the Session Rows, count stays, panes stay open (SRS-FR-142); a folded workspace's count turns yellow when a session asks for approval; "Folder khác (2)" is collapsed at start, opens on click, becomes "Folder khác (1)" when a pane of `mokairo` opens (SRS-FR-141); the group is absent when every workspace has a pane
- [x] 2.5 Add RED tests for the stash group: "Để dành (2)" is the last group, after "Folder khác", newest first (SRS-FR-106); no "Để dành" group when nothing is stashed and after the last × (SRS-FR-107); × hidden until hover or focus, removes the row without opening a pane (SRS-FR-110)
- [x] 2.6 Add RED tests in `src/components/WorkspaceSidebar.test.tsx`: "Thêm folder" is the row after the last group and the last tab stop (Add Folder after the Folder Tree); clicking a workspace name still selects it and opens the Session History Panel (non-goal guard)
- [x] 2.7 Port `.side-on`, `.row-app`, `.row-err` from agent-deck-remote `web/src/index.css` into `src/index.css`, with the bar fixed to `--row-focus`
- [x] 2.8 Do 4.1 first (delete the tests that pin the flat sections), then rebuild `WorkspaceSidebar.tsx` on `folderTree`: workspace row (chevron, name, "Không còn" chip, count, ⋯), Session Row (dot, title, word, detail line), "Folder khác" group, "Để dành" group, "Thêm folder" row; collapse state in component state; pass the tree from `App.tsx` — GREEN for 2.2 to 2.6

- [x] 2.9 The Sidebar opens with the title "Agent Deck" (design #final, agreed at GATE 1); test first

- [x] 2.10 "Folder khác" starts expanded when no workspace has an open pane, keeps the user's fold while nothing opens, and expands again when the last pane closes (SRS-FR-141 as changed by CR-017); tests first

## 3. Folder Menu and copy path

- [x] 3.1 RED tests: ⋯ on `mokairo` and on a workspace inside "Folder khác" opens a menu with Xem file, Chép đường dẫn, Bỏ folder (SRS-FR-143); Xem file is disabled and choosing it does nothing; Esc, a click outside and choosing an item close it and return focus to ⋯; ↑/↓ move between items
- [x] 3.2 RED tests: Bỏ folder removes the workspace and keeps its history (SRS-FR-004); on a workspace with open panes it shows "Đóng các phiên đang mở của folder này trước" and keeps it (SRS-FR-006)
- [x] 3.3 RED tests: Chép đường dẫn calls `navigator.clipboard.writeText` with the workspace `path` and leaves the tree unchanged (SRS-FR-144); a rejected write shows the toast "Không chép được đường dẫn"
- [x] 3.4 Implement the Folder Menu (`role="menu"`, `.menu` look) and wire Bỏ folder to `removeFolder`, Chép đường dẫn to the clipboard — GREEN

## 4. Remove the flat sections (delete their tests first)

- [x] 4.1 Delete these tests before touching the code they cover:
  - `WorkspaceSidebar.test.tsx`: "keeps Remove in the tab order right after its folder row", "reveals Remove only on row hover or keyboard focus", "puts + Add Folder after every list row in the tab order", "keeps the three section titles", "gives each Remove button a distinct name and exposes Missing" (Missing part moves to 2.6), "marks the selected folder with the focus bar"
  - `App.test.tsx` › "Active Sessions (2.3)": "shows No active sessions while no pane is open (SRS-FR-053)", "lists the open sessions of every folder with their folder, most urgent first (SRS-FR-051, SRS-FR-052)", "puts every sidebar section on the sidebar's --card, with no tint of its own (SRS-NFR-009 deleted)"; the rest of the block is replaced by 2.2
  - `App.test.tsx` › "Status Highlight on folder rows (2.2)": both tests (replaced by the count tests in 2.2)
  - `App.test.tsx` › "Jump from Active Sessions (2.4)" and "Row Focus Mark (2.5)": the `ring-2 ring-inset ring-row-focus` assertions and the Active Sessions list helpers (replaced by 2.3)
  - `App.test.tsx` › "Stashed Sessions (CR-011)": "shows No stashed sessions while nothing is stashed (SRS-FR-107)", "puts Stashed Sessions on the sidebar's --card, with no tint of its own (SRS-NFR-010 deleted)"
- [x] 4.2 Point the remaining tests that find folders or stashed rows through `labels.folders` / `labels.activeSessions` / `labels.stashedSessions` lists (`selectAndStart` and similar helpers) at the tree helpers of 2.2
- [x] 4.3 Remove from `WorkspaceSidebar.tsx` the Folders, Active Sessions and Stashed Sessions sections, the hover Remove ×, `ActiveRow`, `folderLook` and the fixed bottom bar; remove `labels.folders`, `activeSessions`, `activeCount`, `noActiveSessions`, `noStashedSessions`
- [x] 4.4 Grep `src/` for `activeSessions`, `folderHighlights`, `noActiveSessions`, `noStashedSessions`, `ring-row-focus`: no hit left

## 5. Close

- [x] 5.1 `npm test` green, `npx tsc --noEmit` clean
- [x] 5.2 Update `src/contrast.test.ts` (or add a case) so `--row-focus` is at least 3:1 against `--card`, `--section-active`, `--approval-bg`, `--error-bg` in light and dark (Row Focus Mark contrast)
- [x] 5.3 `openspec validate update-folder-tree --strict`
- [x] 5.4 Build and run the app under a separate identifier (never close the running agent-deck) and screenshot the Sidebar against `design/agent-deck/cr016/design.html#final` and `#folder-menu`: tree with two workspaces, a `Cần duyệt` row, "Folder khác" open and closed, "Để dành", Folder Menu open, light and dark — launch screen (dark, "Folder khác" open, aligned names) checked on the real app; Session Rows, Folder Menu, copy path and light left to the user's own run (agreed at GATE 3)
