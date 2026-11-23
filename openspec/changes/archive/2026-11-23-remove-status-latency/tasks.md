# Tasks

## 1. Frontend (SRS-FR-038)

- [x] 1.1 Delete the old tests first: "Status latency (2.1, 2.2)" describe in `src/App.test.tsx`. Add RED tests: (a) `tauriSessionsClient` has no `recordStatusShown` (SC-1); (b) a status message parsed by the client yields a status without a `reportedAt` key, even when the message carries one (SC-2). Verify: the new tests fail.
- [x] 1.2 Remove `recordStatusShown` from `src/api/sessions.ts`, `src/test/fakes.ts`; the `unrecorded` queue, its effect and the push in `onStatus` from `useSessionPanes.ts`; `reportedAt` from `PaneStatus`, `asStatus` and every fixture. Verify: `npm test` green, `npx tsc --noEmit` clean, `npm run build` passes.

## 2. Backend (SRS-FR-038, design D3, D4)

- [x] 2.1 Delete `status_latency.rs`, `latency_commands.rs` with their tests; remove `mod` lines, `AppState.latency`, the startup prune and the `record_status_shown` registration; drop `reported_at` from `StatusMessage`/`status_json` and `reportedAt` from every expected JSON in `pane_status.rs` and `pane_commands.rs` tests; reshape `a_hook_change_reports_its_arrival_time` (design D4). Verify: `cargo test` and `cargo clippy -- -D warnings` clean; `cargo clippy --all-targets -- -D warnings` shows no error beyond the 3 pre-existing unix-only dead-code items.

## 3. Reconcile

- [x] 3.1 `grep -rnE "StatusLatencyLog|status_latency|record_status_shown|recordStatusShown|reportedAt|reported_at"` over `src` and `src-tauri/src`, excluding `*.test.*`, returns nothing but the absence assertion in the `pane_status.rs` test module (SC-3); `openspec validate remove-status-latency --strict` passes; a build with a separate app identifier, started on a copy of the app data folder, leaves `status-latency.jsonl` byte-identical (SC-4).
