## 1. Rust shell module (seams R1, R2, R3)

- [x] 1.1 RED then GREEN for `command_label(argv)` in `shell.rs` (SRS-FR-058)
- [x] 1.2 RED then GREEN for `ShellRegistry`: open for a known pane, one live shell per pane, reopen after exit, `take` / `take_all`, spawn failure → `shell_failed` (SRS-FR-055, SRS-FR-061, SRS-FR-062, SRS-FR-065)
- [x] 1.3 RED then GREEN for the real shell spawn and `ForegroundProbe` on Unix: `cwd`, not busy at the prompt, busy with label for `sleep 30`, close ends the group; Windows probe through Toolhelp32 behind `cfg(windows)` (SRS-FR-055, SRS-FR-058, SRS-FR-062, SRS-FR-063)

## 2. Rust commands

- [x] 2.1 `open_shell`, `shell_write`, `shell_resize`, `shell_activity` in `pane_commands.rs`, registered in `lib.rs`; `AppState.shells`; `close_pane`, `close_all_on_reload`, `close_all_on_exit` also end shells; `windows-sys` feature `Win32_System_Diagnostics_ToolHelp` (SRS-FR-055, SRS-FR-062)

## 3. UI (seam U1)

- [x] 3.1 RED then GREEN for the client and the chip: `openShell`, `shellWrite`, `shellResize`, `shellActivity` in `SessionsClient` and the fakes; `toggleShell` open / hide / show with output kept while hidden; chip states and marker; activity poll (SRS-FR-055, SRS-FR-056, SRS-FR-057, SRS-FR-058)
- [x] 3.2 RED then GREEN for the shell area divider, `resizeShell` and the shell refit on drag, show and maximize/restore (SRS-FR-059, SRS-FR-060)
- [x] 3.3 RED then GREEN for shell exit, the shell surviving the session's end, and the start failure strip (SRS-FR-061, SRS-FR-064, SRS-FR-065)
- [x] 3.4 RED then GREEN for closing: shell disposed with its pane, the shell confirmation dialog, one dialog when both are busy (SRS-FR-062, SRS-FR-063)

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run build`, `cargo test`, `npm run tauri build -- --bundles app` and paste the output
- [x] 4.2 Demo in the app: open a shell in a pane, `pwd` is the workspace folder, `npm run dev` then hide → chip shows `npm run dev` and the server answers; show → output kept; drag the divider; maximize; `/exit` the session → shell still runs; close the pane → dialog, Close → server stops; `exit` in a shell → area closes
  - 2026-10-18: the PO ran the demo in the app and approved it.
