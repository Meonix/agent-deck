## Context

`list_sessions` (`session_commands.rs`) scans `~/.claude/projects/*/*.jsonl` through `scan_sessions`
(`session_list.rs`): a file belongs to a workspace when its first `cwd` matches the workspace path (RULE-02,
`CwdMatcher`), and the row id is the file stem. On the PO's machine every session is `<id>.jsonl` plus a folder
`<id>/` (`subagents/`, `tool-results/`) next to it. The app never writes there today (SRS-NFR-005 v1.0).

UI: `WorkspaceSidebar` shows Resume on the picked row; `App` owns `ConfirmClose` (focus trap, Escape and Tab kept
out of the terminal) for busy panes; `useSessionPanes.closePane` ends a session and shows a toast on failure;
`useSessionList` re-reads the list when the selection or the open sessions change. UI source of truth:
`design/agent-deck/brief.md` › "Đã chốt cho CR-001" (Delete next to Resume on the picked row) and
`design/agent-deck/stories/StatesCr001.stories.js` › DeleteConfirm, DeleteConfirmOpen, DeleteFailed,
DeleteConfirmLight. Approach A (operating-system trash through crates already in `Cargo.lock`) was chosen at
GATE 1.

## Goals / Non-Goals

**Goals:**

- Delete one session to the trash with confirmation, also when it is open in a pane (SRS-FR-047 to SRS-FR-049).
- Keep the row and say so when the move fails (SRS-FR-050).
- Touch nothing but the deleted session's own files (SRS-NFR-005 v1.1).

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Deleting several sessions at once, or all sessions of a folder.
- Claude Code's other per-session caches (`~/.claude/file-history/<id>`, `~/.claude/session-env/<id>`).
- Finder's "Put Back": the files can be dragged back from the Trash, `NSFileManager` does not record Put Back.
- Undo inside the app.

## Decisions

**D1 — `session_trash.rs`: find, then move through a trait.**
`trash_session(projects_dir, workspace, session_id, trash: &dyn Trash) -> Result<(), DeleteError>`.
The id must be non-empty and only ASCII letters, digits and `-` (no path can be built from it). It looks for
`<folder>/<id>.jsonl` under `projects_dir` whose first `cwd` matches the workspace (the same `session_files`,
`first_cwd`, `CwdMatcher` the list uses, made `pub(crate)`). None → `DeleteError::NotFound`. Found → trash the
`.jsonl` first; failure → `DeleteError::Failed`, the folder is not touched. Then trash `<folder>/<id>/` if it
exists; a failure there is logged with `diag::warn` and still counts as deleted, because without the `.jsonl` the
session is gone from Claude Code and from the list. Rejected: one combined call — no platform API makes two moves
atomic, and the order keeps the session either fully listed or not listed.

**D2 — Platform trash.**
`SystemTrash: Trash`. macOS: `NSFileManager::defaultManager().trashItemAtURL_resultingItemURL_error` with a file
`NSURL` (`objc2-foundation` 0.3, features `NSFileManager`, `NSURL`, `NSString`, `NSError`; already resolved in
`Cargo.lock` through Tauri, so nothing is downloaded). Windows: `SHFileOperationW` with `FO_DELETE` and
`FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT` (Recycle Bin, no shell dialog), feature
`Win32_UI_Shell` on the existing `windows-sys` 0.59. Rejected at GATE 1: the `trash` crate (new download, Finder
automation prompt by default) and shelling out to `osascript` / `powershell`.

**D3 — Command `delete_session(workspaceId, sessionId, paneId?)`.**
Same workspace lookup as `list_sessions` (`folder_missing`, `not_found`). With a `paneId` it first takes that
pane's process out of the registry and calls `PaneProcess::close`, which returns only once the child is reaped —
so the session has ended before its files move (SRS-FR-049). `close_pane` cannot be reused for this: it closes on
a spawned thread and returns at once. Then `trash_session` with `SystemTrash`; all of it in `spawn_blocking`.
`NotFound` → `"not_found"`, `Failed` → its message. The closing-then-trashing order lives in one function,
`delete_with_pane(registry, pane_id, trash_step)`, so it is testable with a fake process.

**D4 — One confirm dialog for close and delete.**
`ConfirmClose.tsx` becomes `ConfirmDialog.tsx` with `title`, `detail`, `action` props and the same focus trap.
Close uses "Session is still running. Close anyway?" / "<ws> · <title> will be ended." / "Close" (unchanged
text). Delete uses "Move “<title>” to Trash?" / "You can restore it from the Trash." / "Move to Trash", or for an
open session "Close “<title>” and move it to Trash?" / "The session will be ended and its pane closed." /
"Close and move" (design stories).

**D5 — Flow in `App`.**
Delete on the picked row → `App` looks up a live pane of that session (`pane.started && !ended`) → dialog. Confirm →
`sessions.deleteSession(workspaceId, id, paneId ?? undefined)`. Then, if there was a pane, `closePane(paneId)`
removes it from the layout (its process is already gone, so the backend close is a no-op) — also when the delete
failed, because the session has ended either way. Resolved or `"not_found"` (nothing left on disk, e.g. a session
Claude Code never wrote) → bump a `reloads` counter that `useSessionList` depends on. Any other error → toast
"Session could not be deleted", list untouched (SRS-FR-050). The busy-pane confirm of SRS-FR-027 is not shown in
addition: the delete dialog already says the session ends.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 Rust core | `trash_session(projects_dir, workspace, id, &FakeTrash)`, `delete_with_pane(registry, pane_id, step)` | SRS-FR-047 moves `<id>.jsonl` then `<id>/` and nothing else; folder optional; SRS-NFR-005 other sessions' files untouched; id of another workspace or with `/`, `..`, empty → `NotFound`, nothing moved; SRS-FR-050 `.jsonl` move fails → `Failed`, folder not moved; folder move fails → `Ok`; SRS-FR-049 the pane process is closed (reaped) before the trash step runs, and is gone from the registry | `cargo test`, `tempfile` dirs, a fake `Trash` and a fake `PaneProcess` recording calls |
| S2 Rust platform | `SystemTrash.trash(path)` | the real macOS Trash takes a temp file (`#[ignore]`, run once by hand with `--ignored`, leaves one probe file in the user's Trash); Windows: `cargo check --target x86_64-pc-windows-msvc` | `cargo test -- --ignored`, `cargo check` |
| S3 UI | `App` with fake clients (`deleteSession` added to `fakeSessions`) | SRS-FR-048 Delete → dialog text, Cancel → no call; SRS-FR-047 confirm → `deleteSession("a", id)`, list read again, row gone; `not_found` → row gone, no toast; SRS-FR-049 open session → its dialog text, `deleteSession("a", id, paneId)`, pane gone afterwards; SRS-FR-050 rejected → toast "Session could not be deleted", row stays; SRS-FR-027 busy-pane close dialog still works after the rename | Vitest + Testing Library |
| — real app | — | delete a real session, it is in the Trash, drag it back, select the folder → listed again | task 3.2 demo |

## Risks / Trade-offs

- [Claude Code changes its file layout] → only `<id>.jsonl` and `<id>/` are moved; anything else stays where it
  was, which never breaks the list (it reads `.jsonl` only).
- [A session writes once more while it is being closed] → `delete_session` waits for `PaneProcess::close` to reap
  the child before moving anything, so the move runs after the last write. This can take as long as the existing
  hang-up → terminate → kill sequence; the dialog closes at once and the row goes when the list is read again.
- [Windows build not run on Windows] → `cargo check` for the MSVC target compiles the call; the delete itself is
  only demoed on macOS in this change.

## Migration Plan

No stored data changes. Rollback = revert; files already moved stay in the Trash and can be put back by hand.

## Open Questions

None.
