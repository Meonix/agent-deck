## Context

CR-016 item 36. The approved look is `design/agent-deck/cr016/design.html` › `#chooser` (the `chooser()` function: a 440px `.dlg` over a `.scrim`, header with the folder name and ×, a full-width primary "Phiên mới" button, the label "Mở lại phiên cũ", h-10 rows with checkbox, title, relative time or the "Đang mở" chip and a trash icon on the hovered row, a footer with "Chọn tất cả" and the red "Xoá đã chọn (n)" once something is ticked), `#empty-chooser` ("Chưa có phiên nào") and `#loading` (four skeleton rows, no text), with the rules in `design/agent-deck/brief.md` › "Đã chốt cho CR-016". SRS v1.17 (Baselined) rewrote SRS-FR-007 to SRS-FR-013, SRS-FR-018, SRS-FR-019, SRS-FR-041, SRS-FR-047 to SRS-FR-050, SRS-FR-054, SRS-FR-073 to SRS-FR-079, SRS-FR-102, SRS-FR-109 and SRS-NFR-003 around the Session Chooser.

Today `src/components/SessionHistoryPanel.tsx` is a 280px grid column between the Sidebar and the panes. `useWorkspaces.select` sets the selected workspace and toggles `historyOpen`; a second click on the selected name closes it. `useSessionList(client, selected, selections, openSessions, reloads)` reads the selected workspace's sessions. A row is picked with a click and then shows "Mở lại" and "Xoá"; the Session Selection, Delete and Delete selected logic lives in `App.tsx` (`selection`, `requestDelete`, `requestDeleteMany`, `deleteManyText`) and renders `ConfirmDialog`. Items 34 and 35 are archived: remote tokens and classes (`.dlg`, `.scrim`, `.send`, `.btn-danger`, `.chip-idle`, `.skel`) and the Folder Tree exist.

## Goals / Non-Goals

**Goals:**
- One modal Session Chooser replaces the Session History Panel, matching `#chooser`, `#empty-chooser` and `#loading`.
- Open from + on every workspace row (tree and "Folder khác") and from the workspace name; close with ×, Esc, a click outside, "Phiên mới" or a session row.
- Delete, multi-select delete, failure messages and the Session Selection behave as today, inside the chooser.
- The workbench grid is Sidebar | panes; no pane changes size when the chooser opens.
- Every test of the panel is deleted first, not left skipped.

**Non-Goals:**
- No View Switch on the pane header (item 37).
- No Settings button or page (item 45).
- No change to the stash beyond the wording of its scenarios; reopening from "Để dành" works as today.
- No change to the backend, the session listing, the Workspace List file or the stash file.
- No new requirement for SRS-FR-003: the duplicate add still selects the existing row (`aria-current`); it does not open the chooser.

## Decisions

- **New `src/components/SessionChooser.tsx`, `SessionHistoryPanel.tsx` deleted.** `SessionList`, `SessionRows` and `Notice` move into the new file almost as they are; the panel shell (`section`, `inert={covered}`, the header pills) and the picked-row state go. Props: `workspaceName`, `sessions: SessionListState`, `openSessions`, `now`, `blocked`, `onNewSession`, `onResume`, `onDelete`, `onClose`, plus today's `SelectionProps`. Alternative — restyle the panel in place: rejected, the grid column, `covered` and the picked row are exactly what goes away; a new file keeps the diff readable.
- **Single open/close state in `App`.** `const [chooser, setChooser] = useState<{ workspaceId: string; opener: HTMLElement | null; opens: number } | null>(null)`. `openChooser(workspace, opener)` sets it, calls `workspaces.select(id)` (selected row, `aria-current`) and bumps `opens`; `closeChooser()` sets it to null and empties the Session Selection (SRS-FR-076). `useWorkspaces` loses `historyOpen`, `closeHistory` and `selections`; `select` only sets `selectedId`. Alternative — keep the open flag in `useWorkspaces`: rejected, the chooser also needs the opener element and the selection reset, which belong to `App`.
- **Name click = +.** `WorkspaceSidebar` gets `onOpenChooser(workspace, opener)` and calls it from both the new + button and the name button, in the tree and in "Folder khác". The + is an icon button with the accessible name `labels.openChooser(name)` ("Mở phiên của <name>", proposed, not in the Bảng nhãn — for PO confirmation with the other strings of `brief.md`). It sits between the count and ⋯ as drawn in `#final`.
- **Reading.** `useSessionList(client, workspace | null, opens, openSessions, reloads)`: `workspace` is the chooser's workspace (null while closed, state `none`); `opens` replaces `selections` so every open reads again (SRS-FR-007, SRS-FR-054). A read starts on the click, so SRS-NFR-003 is measured from the click on +. Skeleton rows on every open of a different workspace; the same workspace keeps its last rows while re-reading, as today.
- **Dialog mechanics reuse `ConfirmDialog`'s approach.** `role="dialog"`, `aria-modal`, `aria-labelledby` on the header name; `.scrim` covering the workbench (`absolute inset-0 z-10`, below the toast's `z-20`), `.dlg w-[440px] max-w-[calc(100%-2rem)]` centred, rows scroll inside `max-h` so the footer stays visible. A document capture-phase `keydown` handler takes Esc (close) and Tab/Shift+Tab (cycle through the dialog's focusable elements) so neither reaches a terminal; a `focusin` guard pulls focus back. Focus goes to "Phiên mới" on open, so Enter starts a session. A `mousedown` on the scrim itself closes.
- **Focus on close.** Closed by ×, Esc or a click outside → focus returns to `opener` if still connected. Closed by "Phiên mới" or a row → the opener is not restored; the new or existing pane takes focus (SRS-FR-014, SRS-FR-015). Implemented by `closeChooser({ restoreFocus })`.
- **Stacked confirm.** The delete `ConfirmDialog` renders after the chooser in the same container, so it paints above it with no z-index change. While it is shown, App passes `blocked` to the chooser, which sets `inert` on itself and skips its key handler — two capture listeners on `document` fire in registration order and `stopPropagation` does not stop the chooser's, so the chooser must stand down rather than rely on the confirm. Esc or "Huỷ" closes only the confirm; focus returns to the trash icon or footer button that opened it (ConfirmDialog already restores focus).
- **Rows.** Each row is an `li` with a checkbox (`labels.select(title)`), a row button (title + time or "Đang mở") that resumes on click or Enter (SRS-FR-013), and a trash button (`labels.deleteSession(title)`, "Xoá <title>") shown via `group-hover`/`group-focus-within`, as the stash ×. Resume on an open session goes through `panes.resume`, which already focuses the existing pane (SRS-FR-015). No `aria-pressed`, no picked state.
- **Delete keeps the chooser open.** `requestDelete`, `requestDeleteMany`, `deleteManyText` and the failure toasts stay in `App`; after a delete the list is re-read (`reloads`) and the rows disappear in place. Deleting an open session closes its pane behind the chooser (SRS-FR-049).
- **Empty pane area.** `CenteredState` for "no pane" loses `action`: title `labels.noPanes` "Chưa mở phiên nào", hint `labels.noPanesHint` changed to "Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ." (both from `brief.md`); `pickFolderHint` is deleted.
- **Grid.** `gridColumns(sidebarShown)` returns `grid-cols-[var(--sidebar-w)_1fr]` or `grid-cols-[1fr]`; the 280px column and `historyShown` go. Maximize already makes the Sidebar `inert`; with the panel gone that covers SRS-FR-041.
- **Labels.** Add `oldSessions` "Mở lại phiên cũ", `openChooser(name)`, `deleteSession(title)`; change `noPanesHint`; delete `sessionHistory`, `closeHistory`, `pickFolderHint`, `resume`. `loadingSessions` stays as the skeleton list's accessible name; `close` names the × button.

## Risks / Trade-offs

- [About 40 `App.test.tsx` tests reach sessions through `historyPanel()` / `newSessionButton()`] → group 1 deletes the tests that pin the panel, group 2 introduces `openChooser(name)` / `chooser()` helpers, and the remaining tests are repointed in one pass.
- [With a pane maximized the Sidebar and its + are inert, so no new pane can be started until Restore] → accepted, the SRS asks the maximized pane to cover the Sidebar; SRS-FR-046 stays and its test fires the + click directly (jsdom ignores `inert`) to keep the restore-before-place guard.
- [Clicking the name now opens a dialog; a user who only wanted to select loses that] → nothing else uses the selection since the panel is gone; PO approved at GATE 1.
- [A modal over running panes hides their state while it is open] → the chooser is small and centred and the Session Rows stay readable under the 45% scrim; closing it is one click or Esc.
- [Two document-level key handlers (chooser + confirm)] → `blocked` makes the order irrelevant; a test presses Esc on the stacked confirm and checks the chooser is still open.

## Migration Plan

UI only; no data migration. Rollback = revert the commit.

## Open Questions

None.
