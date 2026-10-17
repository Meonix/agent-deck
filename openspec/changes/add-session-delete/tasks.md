## 1. Rust

- [ ] 1.1 RED then GREEN for `trash_session` with a fake `Trash` in `session_trash.rs`; `session_files`, `first_cwd`, `CwdMatcher` made `pub(crate)` (SRS-FR-047, SRS-FR-050, SRS-NFR-005)
- [ ] 1.2 RED then GREEN for `delete_with_pane` (pane process closed before the trash step) with a fake `PaneProcess` (SRS-FR-049)
- [ ] 1.3 `SystemTrash` for macOS and Windows, `Cargo.toml` features, command `delete_session(workspaceId, sessionId, paneId?)` registered; ignored real-Trash test run once by hand; `cargo check --target x86_64-pc-windows-msvc` (SRS-FR-047)

## 2. UI

- [ ] 2.1 `ConfirmClose` → `ConfirmDialog` with `title`, `detail`, `action`; busy-pane close tests stay green (SRS-FR-027)
- [ ] 2.2 RED then GREEN for Delete on the picked row, the dialog, Cancel, confirm → `deleteSession` and list re-read, `not_found` as gone (SRS-FR-047, SRS-FR-048)
- [ ] 2.3 RED then GREEN for deleting an open session: its dialog text, `deleteSession` with the pane id, then the pane leaves the layout (SRS-FR-049)
- [ ] 2.4 RED then GREEN for a failed delete: toast, row stays (SRS-FR-050)

## 3. Verification

- [ ] 3.1 Run `npm test`, `npm run build`, `cargo test`, `cargo check --target x86_64-pc-windows-msvc`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 3.2 Demo in the app: delete an old session → it is in the Trash and gone from the list; drag it back, select the folder → listed again; delete a session open in a pane → pane closes, session in the Trash
