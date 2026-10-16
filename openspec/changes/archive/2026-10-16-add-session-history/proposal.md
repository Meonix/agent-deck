## Why

BO-02 of the agent-deck BRD (v1.0): get back to any earlier Claude Code session in at most 3 actions.
BR-02 asks to see, for the selected folder, the Claude Code sessions already on the machine, each with its
title and last activity time; BR-04 asks that a session started in the app joins that list. The list is the
ground BO-02 stands on — resume (item 6) acts on a row of it — so this is backlog item 5.

## What Changes

- Selecting a folder reads its Claude Code sessions from the machine and lists them under "Sessions" in the
  sidebar: title per RULE-01 and last activity ("2 min ago", "Yesterday", …), newest first.
- A session belongs to a folder only when it started exactly in that folder (RULE-02); sessions started in a
  subfolder are not listed.
- States: "Select a folder to see its sessions.", loading rows, "No sessions yet", "<N> sessions could not
  be read", and "This folder no longer exists on disk." for a `Missing` folder.
- Sessions open in a pane carry a `Live` label; a session just started in a pane appears at the top at once.
- Session files are only read, never written; nothing leaves the machine.

## Capabilities

### New Capabilities

- `session-history`: listing a workspace's Claude Code sessions with title, last activity, order, empty
  and unreadable states, the `Live` label and new sessions, within 3 s for 200 sessions, read-only and
  local (SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-019,
  SRS-NFR-003, SRS-NFR-005, SRS-NFR-007).

### Modified Capabilities

None at requirement level.

## Impact

- Rust: a session scanner over `~/.claude/projects/*/*.jsonl` (head read for the start folder, backward
  tail read for title and last activity) sharing the RULE-01 title rules with `session_title.rs`; one
  command `list_sessions`.
- UI: the sidebar Sessions section gains the list and its states; `Live` and new rows come from open panes.
- Depends on Claude Code's session file format, which is internal to Claude Code (checked on 2.1.300/301).
- No new dependency. Windows 11 not verified (PO deferral of 2026-10-16 still in force).
