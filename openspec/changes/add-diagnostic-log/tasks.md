## 1. Backend

- [ ] 1.1 `diag.rs`: log writer with format, single-line cap and rotation; panic hook; startup line; the 6 `eprintln!` sites write to it (S1, S3)
- [ ] 1.2 `Watchdog` + sampler thread (`ps`), `PaneRegistry::pids()`, survivor check after close, commands `diag_log` / `diag_report` (S2)

## 2. UI

- [ ] 2.1 `diagnostics.ts` error hooks with rate limit; counters report every 60 s from `useSessionPanes` (S4)

## 3. Verification

- [ ] 3.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app`; open the app once and show the log file's first lines
