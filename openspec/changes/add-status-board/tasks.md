## 1. Hook behaviour check (needs the PO's permission to start `claude` in a trusted folder; no prompt sent)

- [x] 1.1 Spike outside the repo: start `claude --settings <inline http hooks> --session-id <uuid>` in a trusted folder with a loopback listener; record whether the user's own hooks still run, whether hook `session_id` equals `--session-id`, and the events around an answered permission prompt and question (the last part in the demo of task 5 if it needs a prompt); write the findings into design.md Context and adjust D3 if needed

## 2. State model (seams S1, S2)

- [x] 2.1 `signal_of` per D3: every listed event, reason text for `Edit`/`Bash`/`Write`/notifications, `PostToolUseFailure` is not an error (SRS-FR-032, SRS-FR-033, RULE-06, A-06)
- [x] 2.2 `StatusMachine` per D4: all 35 cells of the SRS section 5 table, re-entry keeps `since`/`reason`, exit codes → `Ended`/`Error` (SRS-FR-032, SRS-FR-035, RULE-08)

## 3. Hook listener and wiring (seams S3, S4)

- [x] 3.1 `HookServer` on `127.0.0.1:0` with per-pane tokens, immediate empty `200`, body cap, unknown token dropped, `tracked` on first request; POST → sink p95 < 100 ms over 50 requests (SRS-FR-034)
- [x] 3.2 `hook_settings(url)` (command `curl` hook for `SessionStart`, `http` for the rest) and the real `Spawner` passing `--settings <inline JSON>`; no file written under `HOME` (SRS-NFR-006); listener down → spawn without hooks
- [x] 3.3 `HookServer` keeps token → `StatusTracker` (R1, the listener never locks `panes`); the tracker applies signals and sends `{"status": …}` on the pane channel; PTY exit applies `ExitedNormally`/`ExitedAbnormally` and sends the final status, then `{"exited": …}` last; hooks after exit are dropped

## 4. UI (seam S5)

- [x] 4.1 `SessionsClient` stream `onStatus`; entries carry `status` and `title`; `boardCards` (SRS-FR-032)
- [x] 4.2 `StatusBoard` column, grid `240px 1fr 280px`, cards with workspace · `HH:MM` · reason, "Nothing here" (SRS-FR-031, SRS-FR-033)
- [x] 4.3 `TerminalPane` header state chip and border colour; `Status unavailable` after 5 s untracked, cleared when tracked (SRS-FR-036)
- [x] 4.4 Confirm dialog on closing a `Running` / `Needs Approval` pane, Cancel default, Escape cancels (SRS-FR-027)

## 5. Verification

- [x] 5.1 Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test`, `npm run build`, `npm run tauri build -- --bundles app` and paste the output
- [ ] 5.2 macOS demo in the built `.app`: prompt → card in `Running`; permission prompt → card in `Needs Approval` within 3 s with `Edit <file>` (SRS-FR-034); answer → back to `Running`, then `Idle` → no card; `/exit` → `Ended`, no card; closing a `Running` pane asks first; untrusted folder → `Status unavailable` until trusted; `shasum ~/.claude/settings.json` before/after unchanged (SRS-NFR-006); the user's own `UserPromptSubmit` hook still runs in a pane (its output appears in the session transcript); approve with `1`/Enter → `Running` within 3 s (answer-key rule, D3 c); deny → card leaves within ~60 s (`idle_prompt`); while a dialog stays open > 60 s the card stays in `Needs Approval`; a prompt that starts subagents in parallel, one of them asking for approval → card stays in `Needs Approval`; record which hooks fired, and fix D3 if they differ
- [ ] 5.4 Final-review fixes: tracker-owned approval answered (pending key, answer keys from pane input), `idle_prompt` → `TurnFinished`, exit marks tracked, user close suppresses the exit status, header chip after abnormal exit, confirm dialog focus trap, UI tests for closing an `Error` pane / `Error` card after exit / no card for `Ended`
- [ ] 5.3 Windows 11 — deferred by the PO; leave unchecked
