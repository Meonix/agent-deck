## Context

`add-status-summary` mounted `StatusSummary` (and the `LatencyBar` shown while a pane is maximized) above the
Workbench grid in `App.tsx`; the Status Latency button lives only there. CR-014 drops both. The latency record
(`record_status_shown` → `status-latency.jsonl`) stays because BO-01 is measured from it.

## Goals / Non-Goals

**Goals:** remove every trace of the Status Summary and the in-app latency report; keep the record file and its
14-day prune; leave the window with no empty strip at the top.

**Non-Goals:** One UI look (cards, gaps, tokens), `design/agent-deck/oneui/`, `ConfirmDialog` focus restore,
`waitingQueue` / `maximizedBadge`, the record file format.

## Decisions

- D1 Delete, don't hide. `StatusSummary.tsx`, `useSummaryMode.ts`, `StatusLatencyReport.tsx`, `latencyReport.ts`
  and their tests go; no flag keeps them alive.
- D2 Backend keeps `prune` at startup and drops the `status_latency_report` command with `StatusLatencyLog::report`
  and `LatencyReport`; only the app's frontend called it over Tauri IPC (grep). Without the command the prune no
  longer runs on report open, so an app left open for weeks may keep older lines until restart; the PO filters by
  `shown_at` when computing BO-01.
- D3 Maximized pane offset `top-9` → `top-0`: the 36 px band only reserved room for `LatencyBar`; `pane-layout`
  already says the maximized pane covers the window below the title bar.
- D4 The confirm-dialog focus-return test that lived under "Status Summary" stays, re-titled, without summary
  assertions.

## Risks / Trade-offs

- Someone reading `status-latency.jsonl` outside the repo: format unchanged, so unaffected.
- Longer-lived records between restarts (D2): accepted, filtered at measurement time.
