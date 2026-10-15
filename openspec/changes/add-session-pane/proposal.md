## Why

BO-01 of the agent-deck BRD (v1.0) — never miss a Claude Code session that waits for approval or fails —
needs the sessions to run inside agent-deck first; BO-02 needs a new session to start in one click.
BR-04 asks to start a Claude Code session in the selected workspace and BR-05 to work with several sessions
at once in one window, with full terminal behaviour. This is backlog item 2 and the riskiest piece of the
product (embedded terminal, Vietnamese input, process lifetime), so it ships right after the Workspace List.

## What Changes

- "New Session" in the sidebar starts a new interactive Claude Code session in the selected workspace
  folder, inside a new pane, with keyboard focus on that pane.
- Each pane is a full terminal: colours, cursor, scrolling, selection, copy/paste, mouse, resize reflow,
  Vietnamese input through the OS input method.
- Every new pane splits the focused pane and goes to its right.
- Pane header shows `<workspace> · <session title>`; the title follows RULE-01 ("(untitled)" until
  Claude Code names the session).
- Failure and end states in the pane: "Claude Code could not be started", "Session ended".
- Closing a pane ends its Claude Code session, including child processes.
- Starting a session in a `Missing` workspace is rejected with "Folder not found".
- Open panes now feed the Workspace List removal guard (SRS-FR-006): removing a folder with open panes is
  rejected in the running app, not only in tests.
- The app finds `claude` even when launched from Finder, whose PATH does not contain `~/.local/bin`.

## Capabilities

### New Capabilities

- `session-pane`: running interactive Claude Code sessions in panes — start, focus, split right, terminal
  behaviour, reflow, Vietnamese input, header, start failure, session end, close, keystroke latency
  (SRS-FR-014, SRS-FR-017, SRS-FR-018, SRS-FR-020, SRS-FR-021, SRS-FR-024, SRS-FR-025, SRS-FR-026,
  SRS-FR-028, SRS-FR-029, SRS-FR-030, SRS-NFR-002).

### Modified Capabilities

None at requirement level. `workspace-list` "Reject removing a workspace with open panes (SRS-FR-006)"
keeps its text; this change only supplies the real open-pane source behind it.

## Impact

- Rust: new modules for launching `claude`, PTY sessions, pane registry, session title lookup; new
  commands and a binary output channel; `NoPanes` replaced by the pane registry in `commands.rs`.
- New Rust dependencies: `portable-pty`, `uuid`; `libc` (Unix process groups); `windows-sys` Job Object
  code behind `cfg(windows)` (compiled only on Windows, not verified — Windows check stays deferred).
- New npm dependencies: `@xterm/xterm` 6, `@xterm/addon-fit`, `@xterm/addon-webgl`.
- Reads `~/.claude/projects/**/<session-id>.jsonl` read-only for the title (SRS-NFR-005, delivered by
  backlog item 5, is respected: nothing under `~/.claude/` is written).
- Windows 11 not verified in this change (PO deferral of 2026-10-16 still in force).
