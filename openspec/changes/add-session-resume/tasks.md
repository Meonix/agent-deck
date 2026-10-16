## 1. Rust (seams S1, S2, S3)

- [ ] 1.1 `resume_id`: UUID only, canonical form, `invalid_session` otherwise (D2)
- [ ] 1.2 `PaneRegistry::open` with `Start::{New, Resume}`: resume keeps the id; sink wrapper marks a pane ended; `AlreadyOpen` while a pane holds the session and has not ended; `Missing` still rejected before spawning (SRS-FR-013, SRS-FR-015, SRS-FR-016)
- [ ] 1.3 `PtySpawner`: `--resume <id>` for a resume, `--session-id <id>` for a new session, hooks unchanged; `open_pane(…, resume_session_id)` maps `already_open` / `invalid_session` (SRS-FR-013)

## 2. UI (seam S4)

- [ ] 2.1 `SessionsClient.open(workspaceId, cols, rows, resumeSessionId?)`; `useSessionPanes.resume` sharing one open path with `newSession`: `Missing` toast, focus an open pane, row title as the first pane title, `already_open` → focus (SRS-FR-013, SRS-FR-015, SRS-FR-016)
- [ ] 2.2 Selectable session rows with a Resume button per design; `onResume` wired through `App` (SRS-FR-013)

## 3. Verification

- [ ] 3.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 3.2 Demo in the `.app` with the real Claude Code: resume a session → earlier conversation shown, "tiếp tục" answered in context, row `Live`, no duplicate row; Resume again → same pane focused, pane count unchanged; rename a workspace folder with its list on screen → Resume shows "Folder not found"; count actions from app start to typing on 5 different sessions (A-09, BO-02 ≤ 3)
- [ ] 3.3 Windows 11 — deferred by the PO; leave unchecked
