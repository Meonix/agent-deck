## 1. Rust (seams S1, S2)

- [x] 1.1 `StatusLatencyLog`: append, `report(now)` over 14 days with `<= 3000` ms inclusive, bad lines skipped, `prune(now)` via temp file + rename (SRS-FR-038, SRS-FR-039)
- [x] 1.2 Tracker status message gains `reportedAt` = the change time; `null` for tracked-only messages (SRS-FR-038)
- [x] 1.3 Commands `record_status_shown` and `status_latency_report`; log in `AppState`, pruned at startup

## 2. UI (seams S3, S4)

- [x] 2.1 `PaneStatus.reportedAt`; `useSessionPanes` records each change after its commit via `recordStatusShown`, `shownAt >= reportedAt`, skips `null` (SRS-FR-038)
- [x] 2.2 Title bar "Status Latency" button and report overlay: `formatShare`, "No data yet", close ✕ / Escape (SRS-FR-039)

## 3. Verification

- [x] 3.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 3.2 macOS demo in the built `.app`: before any change → "No data yet"; a few real state changes (prompt, permission prompt, answer, finish) → report shows `n of n`; the lines in `status-latency.jsonl` hold no prompt text (SRS-NFR-007)
- [ ] 3.3 Windows 11 — deferred by the PO; leave unchecked
