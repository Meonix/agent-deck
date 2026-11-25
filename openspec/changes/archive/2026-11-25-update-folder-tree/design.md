## Context

CR-016 item 35. The approved look is `design/agent-deck/cr016/design.html` (`#final`, `#folder-menu`, `#empty-no-panes`) with the rules in `design/agent-deck/brief.md` › "Đã chốt cho CR-016": a 240px Sidebar holding one Folder Tree; workspace row h-9 with chevron, name, count, ⋯; Session Row h-8 indented under it with an 8px dot, title and status word; "Folder khác (N)" and "Để dành (N)" as mono uppercase labels; "Thêm folder" at the end of the tree. Item 34 (update-ui-foundation, archived) already switched to the remote tokens and Vietnamese labels and made `Running` blue and untinted.

Today `src/components/WorkspaceSidebar.tsx` draws three flat sections (Folders, Active Sessions, Stashed Sessions) and a bottom bar with "Thêm folder". `src/components/statusHighlight.ts` computes `folderHighlights` (the old SRS-FR-040: most urgent state and its count, including `Running`) and `activeSessions` (a flat list across folders, SRS-FR-051/052 old). `App.tsx` passes both, plus the stash list, into the sidebar. The `Workspace` type already carries `path`.

## Goals / Non-Goals

**Goals:**
- One Folder Tree replaces the Folders, Active Sessions and Stashed Sessions sections, matching `#final`.
- Tree shape, order and counts come from one pure function with unit tests; the component only draws it.
- Folder Menu with Bỏ folder and Chép đường dẫn working, Xem file present but disabled.
- Every test of the deleted flat sections is removed, not left skipped.

**Non-Goals:**
- Clicking a workspace name keeps today's behaviour: it selects the workspace and opens the Session History Panel. The + button on the workspace row and the Session Chooser come with item 36.
- No View Switch on the pane header (item 37).
- No Settings button at the Sidebar foot (item 45).
- No Files View: Xem file stays disabled until item 44 (SRS-FR-174).
- No × on a Session Row to close its pane (drawn in `#final`, but no SRS requirement asks for it in this item).
- No change to the backend, the Workspace List file or the stash file.

## Decisions

- **Tree model as a pure function in `statusHighlight.ts`.** `folderTree(entries: PaneEntry[], workspaces: Workspace[], stashed: StashedSession[])` returns `{ open: WorkspaceNode[], other: Workspace[], stash: StashedSession[] }`. A `WorkspaceNode` is `{ workspace, rows: SessionRow[], count: { n, tone: "Error" | "Needs Approval" | "grey" } }`. `SessionRow` is today's `ActiveSession` without `workspaceName`. It reuses `currentPanes` and the started-pane filter of `activeSessions`, so the resumed-session and failed-resume cases keep their existing tests. `activeSessions` and `folderHighlights` are deleted; `maximizedBadge` stays. Alternative — compute inside `WorkspaceSidebar`: rejected, ordering and counting are the risky part and must be unit tested without rendering.
- **Ordering is a stable partition.** Workspaces with a session in `Needs Approval` or `Error` come first, the rest follow; both groups keep Workspace List order. The SRS does not order the urgent group among itself; Workspace List order keeps the tree from jumping when a second folder starts waiting. Session Rows keep the existing `ACTIVE_ORDER` sort (urgency, then `since`).
- **Count rule (SRS-FR-040).** `n` = sessions in `Needs Approval` or `Error`, tone `Error` if any is `Error`, else `Needs Approval`; if `n` is 0, `n` = open sessions and tone grey. An untracked pane counts only in the grey number. The grey count is the open-session count, not a Status Highlight, so SRS-FR-036 ("no Status Highlight on its folder row") still holds. The workspace row loses its tint and its selected left bar from item 34; the selected workspace keeps `--section-active` only.
- **Other Folders.** Holds every workspace without a started, non-replaced pane, in Workspace List order, `Missing` ones included with their "Không còn" chip. Collapsed by default every time the app starts, including when no pane is open (the design's `#empty-no-panes` shows it open in that case; the SRS says collapsed by default, so the SRS wins and the drift is reported). The group is hidden when it would be empty, like "Để dành".
- **Collapse state is component state, not persisted.** A `Set<workspaceId>` of folded workspaces plus one boolean for "Folder khác" live in `WorkspaceSidebar`; they reset on launch. The SRS says nothing about persistence and a fresh launch should show what needs the user. The chevron is a button with `aria-expanded` and the name "Thu gọn <name>" / "Mở <name>".
- **Session Row look.** Classes ported from agent-deck-remote `web/src/index.css`: `.row-app` / `.row-err` tint the whole row; `.side-on` gives the focused row `--section-active` and the 3px inset bar. The bar is always `--row-focus` (iris), also on tinted rows, because SRS-FR-099 says "dải iris"; the design's yellow/red bar on tinted rows is not taken. The current `ring-2 ring-inset` mark goes. The row keeps the Enter-on-keydown jump that keeps Enter out of the terminal.
- **Folder Menu.** One small component next to the sidebar, opened from ⋯ (`aria-haspopup="menu"`, `aria-expanded`), rendered as `role="menu"` with three `role="menuitem"` buttons in the design's order: Xem file (disabled, `aria-disabled`), Chép đường dẫn, Bỏ folder (red, last). Focus moves to the first enabled item on open; ↑/↓ move between items; Esc, a click outside, or choosing an item closes it and returns focus to ⋯. Bỏ folder calls the existing `removeFolder`, so SRS-FR-006 and its toast are unchanged. Alternative — a native `<select>` or Tauri menu: rejected, the remote's `.menu` is the approved look and must be testable in jsdom.
- **Copy path with `navigator.clipboard.writeText(workspace.path)`**, as `xtermAdapter.ts` already does inside the Tauri webview; no new plugin or permission. A rejected promise shows the toast "Không chép được đường dẫn" (a new label, not in the SRS Bảng nhãn; for PO confirmation with the other proposed strings). No success toast: the design shows none.
- **"Thêm folder" is the last row inside the scrolling tree**, no longer a fixed bottom bar; the foot is left for the Settings button of item 45.
- **Labels.** Add `otherFolders(n)`, `viewFiles`, `copyPath`, `copyPathFailed`, `folderMenu(name)`, `collapse(name)`, `expand(name)` to `src/labels.ts`; drop `folders`, `activeSessions`, `activeCount`, `noActiveSessions`, `noStashedSessions`. `stashedCount(n)` ("Để dành (n)") and `removeFolder` stay, the latter now as the menu item text "Bỏ folder".

## Risks / Trade-offs

- [App.test.tsx has about 30 tests that find rows through the Active Sessions list] → group 4 of tasks deletes the obsolete ones first and the rest move to a `sessionRow(title)` helper that queries the tree, so the next items reuse it.
- [The focused session sits under a folded workspace and its Row Focus Mark is hidden] → accepted; the pane itself has the Focus Outline. Folding is the user's choice.
- [A workspace jumps to the top when one of its sessions starts waiting] → intended by SRS-FR-052 (BO-01); the stable partition keeps everything else still.
- [Clipboard write can be refused by the webview] → toast instead of a silent failure; the Tauri clipboard plugin is the fallback if it shows up on Windows during the visual check.

## Migration Plan

UI only; no data migration. The Workspace List and stash files are read as today. Rollback = revert the commit.

## Open Questions

None.
