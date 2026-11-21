# Tasks

## 1. Remove the Status Summary (SRS-FR-132 to SRS-FR-140)

- [x] 1.1 Delete the old tests first: the "Status Summary (3.1)" describe in `src/App.test.tsx` (keep the confirm-dialog focus-return check as its own test, re-titled, design D4), the `statusSummary` describe in `statusHighlight.test.ts`, and `useSummaryMode.test.ts`. Add a RED test in `App.test.tsx`: with sessions open (Running, then Needs Approval) and with none open, no region named "Status Summary" and no "All clear" / "need you" / "Agent Deck" headline is shown. Verify: the new test fails.
- [x] 1.2 Remove `StatusSummary.tsx`, `useSummaryMode.ts`, `statusSummary()` and its type from `statusHighlight.ts`, the summary strip and its `inert` wrapper from `App.tsx`. Verify: `npm test` green, `npm run build` passes.

## 2. Remove the Status Latency report (SRS-FR-039)

- [x] 2.1 Delete the report tests in the "Status latency (2.1, 2.2)" describe (open from the title bar, No data yet, focus trap) and `latencyReport.test.ts`; keep the recording tests. Add a RED test: no "Status Latency" button exists, with and without a maximized pane. Verify: the new test fails.
- [x] 2.2 Remove `StatusLatencyReport.tsx`, `latencyReport.ts`, `LatencyBar`, the report state in `App.tsx`, `latencyReport` from `src/api/sessions.ts` and `src/test/fakes.ts`. Verify: `npm test` green, `npm run build` passes.
- [x] 2.3 Backend (design D2): delete the `report()` tests in `src-tauri/src/status_latency.rs`, then remove `status_latency_report`, `StatusLatencyLog::report` and `LatencyReport`; keep `record_status_shown`, `prune` and their tests. Verify: `cargo test` and `cargo clippy` in `src-tauri` clean.

## 3. Maximized pane fills the window (design D3)

- [x] 3.1 RED test in `PaneGrid`/`App` tests: a maximized pane's wrapper is anchored at the top (`top-0`), not `top-9`. Then change `MAXIMIZED` in `PaneGrid.tsx` and its comment. Verify: `npm test` green.

## 4. Reconcile

- [x] 4.1 `grep -rnE "Status Summary|StatusSummary|LatencyBar|latencyReport|status_latency_report|useSummaryMode|All clear"` over `src` and `src-tauri/src` returns nothing; `openspec validate remove-status-summary --strict` passes.
