## Why

BO-02 of the agent-deck BRD (v1.0): get back to any earlier Claude Code session in at most 3 actions — "chọn
folder, chọn phiên, mở". BR-03 asks that the user can reopen an earlier session to carry on with it. Item 5
put the session list on screen, but its rows do nothing yet, so BO-02 is still out of reach. This is backlog
item 6, the last piece of BO-02.

## What Changes

- Clicking a row in the sidebar session list selects it; the selected row shows a "Resume" button
  (`design/agent-deck/stories/render.js`).
- "Resume" opens a new pane that continues that session in its workspace folder with the earlier
  conversation, keyboard focus in the new pane — folder, session, Resume = 3 actions.
- Resuming a session that is already open in a pane focuses that pane instead of opening a second one.
- Resuming a session of a `Missing` workspace opens nothing and shows "Folder not found".

## Capabilities

### New Capabilities

- `session-resume`: reopening a session from the session list, focusing the pane that already holds it,
  and rejecting a `Missing` workspace (SRS-FR-013, SRS-FR-015, SRS-FR-016).

### Modified Capabilities

None at requirement level. The new pane reuses SRS-FR-014 (focus) and SRS-FR-017 (start failure) of
`session-pane` as they stand.

## Impact

- Rust: `open_pane` takes an optional session id to resume; the pane registry opens it under that id, runs
  `claude --resume <id>` instead of `--session-id`, and refuses a second pane for a session still running.
- UI: selectable session rows with a Resume button; `useSessionPanes` gains `resume`, which focuses an open
  pane or opens a new one titled with the row's title.
- Depends on Claude Code keeping the session id on `--resume` (default since `--fork-session` exists;
  checked on 2.1.301).
- No new dependency. Windows 11 not verified (PO deferral of 2026-10-16 still in force).
