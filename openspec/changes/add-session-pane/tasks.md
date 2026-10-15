## 1. Launcher (seam S1)

- [x] 1.1 `parse_login_path` and the startup login-shell PATH lookup with 3 s timeout and fallback (D1)
- [x] 1.2 `find_in_path("claude", path)`; not found → start failure, no spawn (SRS-FR-017)
- [x] 1.3 `session_env`: resolved PATH, `TERM`, `COLORTERM`, `LANG=en_US.UTF-8` only when no locale is set (D2)

## 2. PTY session and output (seams S2, S3)

- [x] 2.1 `OutputBatcher` with injected clock: 16 ms / 64 KiB flush, order preserved (SRS-NFR-002)
- [x] 2.2 `PtySession::spawn` in a given cwd with env and size; output reader thread through the batcher; exit notification with code (SRS-FR-018, SRS-FR-028)
- [x] 2.3 `write` and `resize` — child sees the new size (SRS-FR-024); PTY echo round trip p95 < 100 ms over 200 bytes with `cat` (SRS-NFR-002)
- [x] 2.4 `close` ends the whole process group (SIGHUP → SIGTERM → SIGKILL after 2 s); Windows Job Object behind `cfg(windows)` (SRS-FR-029)

## 3. Pane registry and commands (seam S4)

- [x] 3.1 `PaneRegistry` with `Spawner` trait: open (rejects a `Missing` workspace — SRS-FR-020), close, implements `OpenPanes` (SRS-FR-006 source)
- [x] 3.2 Commands `open_pane(workspace_id, cols, rows, channel)`, `pane_write`, `pane_resize`, `close_pane`; `remove_workspace` uses the registry instead of `NoPanes`; close all panes on app exit

## 4. Session title (seam S5)

- [x] 4.1 `session_title(projects_dir, session_id)` per RULE-01 (`ai-title` → `last-prompt` → "(untitled)"), parse failures → "(untitled)"; command `pane_title(pane_id)` (SRS-FR-030)

## 5. UI (seam S6)

- [x] 5.1 `SessionsClient` (TS) over the commands and the binary channel; npm `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl`
- [x] 5.2 `insertRight` and `PaneGrid`: new pane right of the focused one, equal columns (SRS-FR-021)
- [x] 5.3 `TerminalPane` with `TerminalAdapter` (xterm + fit + webgl fallback): focus on open (SRS-FR-014), fit on resize → `pane_resize` (SRS-FR-024), "Claude Code could not be started" (SRS-FR-017), "Session ended" keeps scrollback (SRS-FR-028), close (SRS-FR-029), header `<workspace> · <title>` refreshed every 10 s (SRS-FR-030)
- [x] 5.4 Sidebar Sessions header with "New Session"; `Missing` workspace → "Folder not found" toast, no client call (SRS-FR-018, SRS-FR-020); dev-only latency log for the NFR-002 demo

## 6. Verification

- [ ] 6.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 6.2 macOS demo in the built `.app` started from Finder: New Session runs `claude`; Telex "sửa lỗi đăng nhập" (SRS-FR-026); colours/selection/copy/paste/mouse vs Terminal.app (SRS-FR-025); second pane splits right and the first reflows (SRS-FR-021, SRS-FR-024); `/exit` → "Session ended"; close pane → `ps` shows no leftover `claude`; remove a folder with an open pane → blocked (SRS-FR-006); latency log p95 ≤ 100 ms measured in `npm run tauri dev` (Web Inspector console; the release build has no devtools) (SRS-NFR-002)
- [ ] 6.3 Windows 11 — deferred by the PO; leave unchecked
