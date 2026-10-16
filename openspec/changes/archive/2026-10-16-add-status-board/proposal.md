## Why

BO-01 of the agent-deck BRD (v1.0) — never miss a Claude Code session that waits for approval or fails:
such a session must show on the Status Board within 3 seconds. BR-06 asks for one board that shows which
sessions are running, which need approval and which failed; BR-05 asks that panes behave safely while a
session is busy. Panes now run real sessions (item 2), so this is backlog item 3, the item that delivers
BO-01 itself. The BRD constraint "do not change the machine-wide Claude Code configuration" (section 8)
shapes how state is tracked.

## What Changes

- The main window gets a Status Board column on the right with three columns `Running`, `Needs Approval`
  and `Error`; every session open in a pane in one of those states shows a card in its column.
- Each card shows the workspace name, the session title, the time the session entered its state and the
  reason (the action waiting for approval, or the error type).
- Session state follows RULE-03 to RULE-08 and the transition table in SRS section 5; signals that do not
  apply to the current state are ignored.
- State is tracked through Claude Code hooks passed to each pane's `claude` process on its own command line
  (`--settings`), delivered to a local listener in the app; nothing in the user's Claude Code configuration
  is written.
- The pane header shows the session state; a pane whose state cannot be tracked shows `Status unavailable`
  and stays off the board.
- Closing a pane whose session is `Running` or `Needs Approval` asks for confirmation first.

## Capabilities

### New Capabilities

- `status-board`: session state tracking for sessions open in panes and the Status Board — columns, cards,
  card content, update latency, ignored signals, unavailable status, no machine-wide configuration change
  (SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-035, SRS-FR-036, SRS-NFR-006).

### Modified Capabilities

- `session-pane`: adds "Confirm closing a busy pane" (SRS-FR-027). Existing requirements keep their text;
  "Close pane ends its session (SRS-FR-029)" still holds once the close is confirmed.

## Impact

- Rust: new modules for the hook signal mapping, the per-pane state machine and the local hook listener;
  the `claude` command line gains `--settings <inline JSON>`; the pane channel carries state messages.
- No new HTTP dependency: the local hook listener on 127.0.0.1 is built on `std::net`.
- UI: Status Board column, state chip and border in the pane header, `Status unavailable` badge,
  confirmation dialog on close; the grid becomes `240px 1fr 280px` as in design proposal 4.
- Depends on Claude Code hook events documented at code.claude.com/docs/en/hooks.md; checked on Claude
  Code 2.1.300 (A-08).
- Card click → pane focus (SRS-FR-037) is backlog item 8; status timing records and the latency report
  (SRS-FR-038, SRS-FR-039) are item 4.
- Windows 11 not verified in this change (PO deferral of 2026-10-16 still in force).
