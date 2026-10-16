## 1. Rust (seams S1, S2)

- [x] 1.1 `parse_timestamp` and `read_tail` (backward 64 KiB chunks, newest timestamp/ai-title/last-prompt, mtime fallback); `session_title` uses it (SRS-FR-008)
- [x] 1.2 `scan_sessions`: head read for the first `cwd`, exact or canonical match, unreadable only in the workspace's encoded folder, newest first; files unchanged; 200 sessions with a 50 MB file < 3 s (SRS-FR-007, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-NFR-003, SRS-NFR-005)
- [x] 1.3 Command `list_sessions(workspace_id)`: `folder_missing` / `not_found`, `spawn_blocking`

## 2. UI (seam S3)

- [ ] 2.1 `SessionsClient.list`, `formatWhen`, `mergeSessions`, `useSessionList` reloading on every selection (SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-012, SRS-FR-019)
- [ ] 2.2 Sidebar session rows (title, label, `Live`) and states: no selection, loading, missing, "No sessions yet", "<N> sessions could not be read" (SRS-FR-010, SRS-FR-011)

## 3. Verification

- [ ] 3.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 3.2 Real data: time `scan_sessions` over this machine's `~/.claude/projects` for its largest workspace (SRS-NFR-003); grep the code path for network APIs (SRS-NFR-007); demo in the `.app`: select `agent-deck` → its sessions newest first with titles; New Session → `Live` row on top; close the pane → label gone; `shasum` of a session file before/after selecting (SRS-NFR-005)
- [ ] 3.3 Windows 11 — deferred by the PO; leave unchecked
