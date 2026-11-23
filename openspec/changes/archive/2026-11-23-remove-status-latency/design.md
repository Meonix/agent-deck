## Context

`add-status-latency-report` made `StatusTracker` stamp each state change with `reportedAt`, the frontend report back
via `record_status_shown` once the change was painted, and `StatusLatencyLog` append to `status-latency.jsonl`
(pruned to 14 days at startup). CR-014 removed the report; CR-015 removes the recording.

## Goals / Non-Goals

**Goals:** no status latency recording left in UI, client, commands or backend; old file left as is.

**Non-Goals:** keystroke latency logging (`latencyLog.ts`, SRS-NFR-002); Status Highlight timing itself
(SRS-FR-034); the `tracked` flag.

## Decisions

- D1 Delete, don't hide: `status_latency.rs`, `latency_commands.rs` and the frontend recorder go with their tests.
- D2 Keep `status-latency.jsonl` on disk: nothing writes, prunes or deletes it.
- D3 Drop `reportedAt` from the status message (user's choice at GATE 1): `status_json` loses its `reported_at`
  argument, `StatusMessage` its field; Rust tests compare the message without it; the TS parser stops reading it.
  `since` keeps the change time, so no information the UI shows is lost.
- D4 The test `a_hook_change_reports_its_arrival_time` becomes a check that a hook change sets `since` to the
  change time and a repeated hook sends nothing; the `reportedAt` part goes.

## Risks / Trade-offs

- Frontend and backend ship together, so dropping a wire field has no old reader.
- Backend removal has no RED test of its own (build, clippy, SC-3 grep); the client and message shape have RED tests.
