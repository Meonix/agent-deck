## Why

CR-014 (BRD v5.2, SRS v1.14): the user no longer wants the Status Summary ("All clear" / "N need you") at the top
of the window, nor the Status Latency button and in-app report that sit in it. BR-06 now names only the folder list
and the list of open sessions as places to see session state. BO-01 is unchanged: status change timing is still
recorded (SRS-FR-038) and the PO computes the share within 3 seconds from the record file. Backlog item 30.

## What Changes

- **BREAKING** Remove the Status Summary: headline, counts, "All clear", "Agent Deck · No sessions running", Go-to
  button, collapse while working in a pane or in a narrow window, hide while maximized, update latency
  (SRS-FR-132 to SRS-FR-140, all `Deleted (CR-014)`).
- **BREAKING** Remove the Status Latency button and report (SRS-FR-039 `Deleted (CR-014)`).
- Keep recording status change timing into `status-latency.jsonl` (SRS-FR-038), same format, still pruned to 14 days.
- With the slim bar gone, a maximized pane starts directly below the title bar, as `pane-layout` already requires.

## Capabilities

### New Capabilities

### Modified Capabilities

- `status-summary`: every requirement removed.
- `status-latency`: the report requirement removed; recording kept.

## Impact

- Frontend: `StatusSummary.tsx`, `useSummaryMode.ts`, `StatusLatencyReport.tsx`, `latencyReport.ts` and their
  tests deleted; `statusSummary()` removed from `statusHighlight.ts`; `App.tsx` loses the summary strip and report
  state; `PaneGrid.tsx` maximized offset `top-9` → `top-0`; `latencyReport` leaves the sessions client and fakes.
- Backend: Tauri command `status_latency_report` and `StatusLatencyLog::report` removed; `record_status_shown`,
  `prune` and the record file unchanged.
- Out of scope: the One UI design files under `design/agent-deck/oneui/` (owned by `design-ui`), One UI tokens and
  card look.
