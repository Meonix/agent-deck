## Why

BR-08 of the agent-deck BRD (v2.0, CR-001): the user deletes an old session of a folder by moving it to the Trash,
serving BO-02 — a session list without dead experiments is faster to pick from. The BRD constraint "only read
Claude Code's session data" now has one exception: moving a whole session to the operating system's trash when the
user chooses Delete (SRS-NFR-005 v1.1). Backlog item 11 (Should), the last item of CR-001.

## What Changes

- The picked session row gets a Delete button next to Resume; it asks "Move "<title>" to Trash?" first
  (SRS-FR-048).
- On confirm the session's history — `<id>.jsonl` and its `<id>/` folder under `~/.claude/projects/<folder>/` —
  goes to the macOS Trash or the Windows Recycle Bin and the row leaves the list (SRS-FR-047).
- A session open in a pane is asked about with "Close "<title>" and move it to Trash?"; on confirm its pane is
  closed (ending the session) before the move (SRS-FR-049).
- If the move fails the row stays and the message "Session could not be deleted" shows (SRS-FR-050).
- SRS-NFR-005 changes from "never modify session history" to "never modify it, except moving a session the user
  deletes to the trash".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-history`: adds deleting a session to the trash (SRS-FR-047 to SRS-FR-050) and relaxes the read-only
  requirement (SRS-NFR-005).

## Impact

- Rust: new module `session_trash.rs` (find the session files of a workspace, move them through a `Trash` trait),
  platform trash for macOS (`objc2-foundation` `NSFileManager`, already in `Cargo.lock`) and Windows
  (`windows-sys` `Win32_UI_Shell`), command `delete_session`. No new crate is downloaded; `objc2-foundation`
  becomes a direct macOS dependency and `windows-sys` gets one more feature.
- UI: `SessionsClient.deleteSession`; `ConfirmClose` generalised into a confirm dialog used for close and delete;
  Delete in `WorkspaceSidebar`; `App` runs the confirm → close pane → delete → reload flow.
- Design: `design/agent-deck/stories/StatesCr001.stories.js` › DeleteConfirm, DeleteConfirmOpen, DeleteFailed,
  DeleteConfirmLight; `brief.md` › "Đã chốt cho CR-001".
