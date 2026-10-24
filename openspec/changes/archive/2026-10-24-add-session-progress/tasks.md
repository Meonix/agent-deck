## 1. Store, condenser, merge (seams S1, S2, S3)

- [x] 1.1 RED then GREEN at S1: `ProgressStore` load/save/`.bak`/read-only, `get` with `Unset` for new and `Off` for resumed, `remove`, `prune_missing` (SRS-FR-129, SRS-FR-130)
- [x] 1.2 RED then GREEN at S2: `condense` — prompts, assistant text, tool calls, tool errors with `HH:MM`; meta and tool output skipped; partial last line kept; nothing new → no chunk; 40 000-char chunks with end offsets (SRS-FR-124)
- [x] 1.3 RED then GREEN at S3: `merge` — old items updated in order, `done` never reverts, missing old kept, extras appended, bad `started_at` → fallback, empty summary dropped (SRS-FR-126, SRS-FR-127)

## 2. Summarizer (seam S5)

- [x] 2.1 RED then GREEN: `ClaudeSummarizer::args()` holds `-p --model haiku --safe-mode --no-session-persistence --tools "" --output-format json --json-schema … --max-budget-usd 0.05`; `parse_output` takes `result` and rejects `is_error` or bad JSON; `prompt()` holds the goal, the list, RULE-10, RULE-11 and the chunk (SRS-NFR-012, SRS-NFR-013)
- [x] 2.2 Spawn with `session_env`, cwd the data folder, stdin prompt, 25 s kill; covered by one `#[ignore]` test that runs the real `claude` (run once by hand, output pasted)

## 3. Keeper and wiring (seam S4)

- [x] 3.1 RED then GREEN at S4: `ProgressKeeper` — Stop with tracking on → one run and a `{progress}` message; off/unset → no run; Stops during a run coalesce into one more; failure keeps list and sends `failed`; success clears it (SRS-FR-114, SRS-FR-115, SRS-FR-124, SRS-FR-125, SRS-FR-128)
- [x] 3.2 RED then GREEN at S4: turn on with history → runs from offset 0 over every chunk; turn on again → from the stored offset; `/clear` → new session inherits `tracking`, empty list (SRS-FR-117, SRS-FR-131)
- [x] 3.3 Wire into `PtySpawner`, `PaneHooks`, `TrackedProcess`, `PaneRegistry`; commands `set_progress_tracking`, `set_progress_collapsed`; load and prune the store in `lib.rs`; `delete_session` removes the record; existing spawn test still shows the same pane args (SRS-NFR-011, SRS-FR-129)

## 4. UI (seams S6, S7)

- [x] 4.1 RED then GREEN at S6: `sessions.ts` parses `{progress}`, buffers like `onGoal`; client `setProgressTracking`, `setProgressCollapsed`
- [x] 4.2 RED then GREEN at S6: Tracking button before Stash with `aria-pressed`; `TrackingPrompt` while unset with Track/No (SRS-FR-113 to SRS-FR-116)
- [x] 4.3 RED then GREEN at S6: `ProgressStrip` — header count, rows with marks/summary/result/time, 4-row max with scroll, scroll to latest in progress, collapse/expand line, updating dot, "Couldn't update" (SRS-FR-118 to SRS-FR-123, SRS-FR-128)
- [x] 4.4 RED then GREEN at S7: `App` — Tracking Prompt on New Session, none on Resume; Track/No/button call the client; collapsed state passed through (SRS-FR-113, SRS-FR-130)

## 5. Verification

- [x] 5.1 Run `npm test`, `npm run build`, `cargo test`, `cargo clippy` and paste the output; `openspec validate add-session-progress --strict`
  - 2026-10-25: `npm test` 16 files / 401 passed; `npm run build` built; `cargo test` 316 passed, 3 ignored; `cargo clippy --all-targets -- -D warnings` fails only on the pre-existing `collapsible_if` at `src-tauri/src/session_trash.rs:31` (file not touched by this change); `Change 'add-session-progress' is valid`
- [ ] 5.2 Rebuild the release `.app`; demo: New Session → Track → a real turn updates within 30 s; No → nothing; Resume old session → no prompt; turn on mid-session; collapse; quit and reopen; count `~/.claude/projects` files before/after (SRS-NFR-012)
  - 2026-10-25: `.app` rebuilt (02:48). The PO ran a real session with Track on: the Progress Strip appeared and updated after turns; it showed a delivered answer still in progress, fixed in the summary prompt (b263dc9). The PO approved at GATE 3 without the rest of the scripted demo; issues found in daily use go through `/dev-bug`.
