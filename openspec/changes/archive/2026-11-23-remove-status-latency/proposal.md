## Why

CR-015 (BRD v6.0, SRS v1.15): the user no longer wants the app to record status latency. CR-014 already removed the
in-app report; the record file `status-latency.jsonl` was only there so the PO could measure BO-01, which is now
checked by the PO while using the app. SRS-FR-038 is deleted; SRS-FR-034 (every Status Highlight within 3 seconds)
stays and keeps its test. Backlog item 33, the last of CR-015.

## What Changes

- **BREAKING** Remove status change timing records (SRS-FR-038 `Deleted (CR-015)`): the `record_status_shown`
  command, the record file writer and its startup prune, and the frontend that reported when a change was shown.
- Remove `reportedAt` from the pane status message: it existed only to time those records.
- `status-latency.jsonl` already on the user's disk stays untouched.

## Success Criteria

- SC-1 The sessions client exposes no `recordStatusShown`; a status change on a pane makes no client call besides
  what the pane already does (no `record_status_shown`).
- SC-2 A pane status message carries `state`, `since`, `reason`, `tracked` and no `reportedAt`.
- SC-3 `grep` finds no `StatusLatencyLog`, `status_latency`, `record_status_shown`, `recordStatusShown`,
  `reportedAt` or `reported_at` in non-test files under `src` and `src-tauri/src`.
- SC-4 An existing `status-latency.jsonl` in the app data folder is byte-identical after the app starts (the
  startup prune no longer runs).

## Capabilities

### New Capabilities

### Modified Capabilities

- `status-latency`: its only requirement removed.

## Impact

- Backend: `status_latency.rs`, `latency_commands.rs` deleted; `AppState.latency` and the startup prune removed;
  `reportedAt` dropped from `StatusMessage` in `pane_status.rs`.
- Frontend: `recordStatusShown`, the `unrecorded` queue and its effect, `reportedAt` in `PaneStatus` and its parser.
- Out of scope: `latencyLog.ts` (keystroke latency, SRS-NFR-002), the `tracked` flag (Status Highlight uses it),
  SRS-FR-034 and its test.
