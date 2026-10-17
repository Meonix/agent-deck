## 1. Backend

- [x] 1.1 `diag.rs`: log writer with format, single-line cap and rotation; panic hook; startup line; the 6 `eprintln!` sites write to it (S1, S3)
- [x] 1.2 `Watchdog` + sampler thread (`ps`), `PaneRegistry::pids()`, survivor check after close, commands `diag_log` / `diag_report` (S2)

## 2. UI

- [x] 2.1 `diagnostics.ts` error hooks with rate limit; counters report every 60 s from `useSessionPanes` (S4)

## 3. Verification

- [x] 3.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app`; open the app once and show the log file's first lines
  - 2026-10-17, release `.app`: `~/Library/Logs/dev.agentdeck.desktop/agent-deck.log` got `INFO app: agent-deck 0.1.0 on macos aarch64` at start and `INFO watchdog: health: app rss=94.7MB cpu=0.0% panes=0` 60 s later.
