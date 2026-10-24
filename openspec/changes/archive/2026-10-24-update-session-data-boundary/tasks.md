## 1. Spec boundary

- [x] 1.1 Grep `src-tauri/src` and `src` for network clients (`reqwest`, `ureq`, `TcpStream::connect`, `fetch(`) and confirm only the loopback hook listener exists (SRS-NFR-007)
  - 2026-10-25: only `hooks.rs` hits, all `127.0.0.1` (line 111 wakes the app's own listener, the rest are tests); no HTTP client in `Cargo.toml` or `package.json`.
- [x] 1.2 Run `openspec validate update-session-data-boundary --strict` and paste the output
  - 2026-10-25: `Change 'update-session-data-boundary' is valid`
