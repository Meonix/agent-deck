## Why

BO-01 of the agent-deck BRD (v1.0): every session open in agent-deck that waits for approval or fails must
show on the Status Board within 3 seconds, achieved during the 2-week trial right after the MVP. BR-06 gives
the board; Q-01 settled that BO-01 is measured with an in-app report. Without timing records the trial
cannot say whether BO-01 was met, so this is backlog item 4, right after the board (item 3) and before the
trial starts.

## What Changes

- Every state change of a session open in a pane records when Claude Code reported it and when the Status
  Board showed it.
- A "Status Latency" button in the title bar opens a report with the share of state changes in the last 14
  days that appeared on the board within 3 seconds, or "No data yet" when there are none.
- Records stay on the machine, in the app's data folder, and only the last 14 days are kept.

## Capabilities

### New Capabilities

- `status-latency`: recording status change timing and the Status Latency report (SRS-FR-038,
  SRS-FR-039).

### Modified Capabilities

None at requirement level. `status-board` keeps its requirements; its state messages gain the report time
used by the records.

## Impact

- Rust: a timing log module (append, report, prune) and two commands; the pane state message gains
  `reportedAt`.
- UI: the board records the time it painted each state change; title bar button and report overlay.
- Data: `status-latency.jsonl` in the app data folder (session id, state, two times — no session content;
  SRS-NFR-007 holds).
- No new dependency. Windows 11 not verified (PO deferral of 2026-10-16 still in force).
