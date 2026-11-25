## Why

CR-016 (approved 2026-11-24) moves agent-deck onto the look of agent-deck-remote. Backlog item 35 rebuilds the left column: today it is three flat sections (Folders, Active Sessions, Stashed Sessions), so the user has to match each active row to its folder by a name chip and scan two lists to see which folder needs them. SRS v1.16 replaces them with one Folder Tree: each workspace with its open sessions nested under it, workspaces that need the user on top, idle workspaces folded into "Folder khác (N)", stashed sessions in "Để dành (N)" at the end, and a ⋯ Folder Menu on every workspace row.

## What Changes

- **BREAKING (UI)** The Folders and Active Sessions sections are replaced by the Folder Tree. Every session open in a pane is a Session Row under its workspace row (SRS-FR-051): 8px status dot, title, status word ("Đang chạy", "Cần duyệt", "Xong lượt", "Lỗi", "Đã kết thúc"); `Needs Approval` and `Error` rows are tinted, `Running` stays blue and untinted (SRS-FR-032); the "<time> · <reason>" line stays under `Needs Approval` and `Error` rows (SRS-FR-033).
- Folder Tree order: workspaces with a session in `Needs Approval` or `Error` first, then the other workspaces with an open session in Workspace List order; Session Rows by urgency, then by time entered (SRS-FR-052).
- The workspace row shows a count: sessions in `Needs Approval` or `Error` in the colour of the most urgent, else the number of open sessions in grey (SRS-FR-040). The folder row is no longer tinted.
- A chevron on each workspace row folds and unfolds its Session Rows; panes keep running and the count stays (SRS-FR-142, new). Fold state is not kept across launches.
- Workspaces with no open session move into the group "Folder khác (<n>)" at the end of the tree, collapsed by default (SRS-FR-141, new).
- A ⋯ button on every workspace row opens the Folder Menu: Xem file, Bỏ folder, Chép đường dẫn (SRS-FR-143, new). "Bỏ folder" removes the workspace (SRS-FR-004); "Chép đường dẫn" copies its absolute path (SRS-FR-144, new); "Xem file" is shown disabled until the Files View (backlog item 44, SRS-FR-174) lands.
- **BREAKING (UI)** The hover × that removed a folder is gone; removal lives only in the Folder Menu.
- Clicking a Session Row still jumps to its pane (SRS-FR-037); the focused pane's Session Row carries the Row Focus Mark, a 3px iris bar on its left edge (SRS-FR-099).
- Stashed sessions are listed in the group "Để dành (<n>)" at the end of the Folder Tree, after "Folder khác" (SRS-FR-106); the group is hidden while nothing is stashed (SRS-FR-107) instead of showing "Chưa để dành phiên nào"; × on a row still removes it (SRS-FR-110).
- "Thêm folder" becomes a row right after the last group of the Folder Tree instead of a bar pinned to the bottom of the Sidebar.
- The "No active sessions" message is deleted with its section (SRS-FR-053 deleted).
- Unchanged on purpose: clicking a workspace name still selects it and opens the Session History Panel (the + button and Session Chooser come with item 36); the pane header has no View Switch (item 37); no Settings button at the Sidebar foot (item 45); Xem file opens nothing (item 44).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `workspace-list`: Remove workspace (SRS-FR-004) goes through Bỏ folder in the Folder Menu; the hover Remove control is removed; Thêm folder moves to the end of the Folder Tree; Other Folders (SRS-FR-141), Folder Menu (SRS-FR-143) and Copy workspace path (SRS-FR-144) are added.
- `status-board`: Session rows move from Active Sessions to the Folder Tree (SRS-FR-032, SRS-FR-033, SRS-FR-037, SRS-FR-051, SRS-FR-052, SRS-FR-099); new workspace count rule (SRS-FR-040); Row Focus Mark contrast measured against the sidebar and the remaining row tints; Empty active sessions (SRS-FR-053) removed; Collapse a workspace (SRS-FR-142) added.
- `session-stash`: Stashed Sessions becomes the "Để dành (<n>)" group at the end of the Folder Tree, hidden when empty (SRS-FR-106, SRS-FR-107, SRS-FR-110).

## Impact

- `src/components/statusHighlight.ts`: `activeSessions` and `folderHighlights` give way to a pure `folderTree(entries, workspaces, stashed)` that returns the ordered workspace nodes with their Session Rows and counts, the Other Folders list and the stash list.
- `src/components/WorkspaceSidebar.tsx` rebuilt around the tree (workspace row with chevron, count, ⋯; Session Row; Folder khác; Để dành; Thêm folder row); new Folder Menu inside it or as a small sibling component.
- `src/App.tsx` passes the tree instead of `folderHighlights` / `activeSessions`; `src/labels.ts` gains the tree strings ("Folder khác (<n>)", "Xem file", "Chép đường dẫn", "Không chép được đường dẫn", menu and chevron names) and loses `activeSessions`, `activeCount`, `noActiveSessions`, `noStashedSessions`, `folders`.
- `src/index.css`: `.side-on`, `.row-app`, `.row-err`, `.menu` from agent-deck-remote (some were removed as unused in update-ui-foundation).
- Tests: `statusHighlight.test.ts`, `WorkspaceSidebar.test.tsx`, `App.test.tsx` (Active Sessions, Status Highlight on folder rows, Jump from Active Sessions, Row Focus Mark, Stashed Sessions blocks) are rewritten; tests of the deleted behaviour are deleted first (see tasks.md group 4).
- No backend, data format or Claude Code configuration change. The Workspace List and the stash file keep their formats.
