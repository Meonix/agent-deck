## 1. Transcript records (tests first) — seam 1

- [x] 1.1 RED in new `src-tauri/src/transcript.rs` tests: `parse_record` on fixture lines in the measured shapes — user string → Prompt; user array of `text` → Prompt; slash command record → Prompt "/x a"; `<bash-input>` → Prompt "! cmd"; `<local-command-stdout>`, `<system-reminder>` and the other wrappers → Ignored; `isMeta`, `isSidechain`, `thinking` → Ignored; assistant `text` → Reply; `tool_use` → Tool with id, name, arg; `tool_result` string, array, `image` ("[ảnh]"), `is_error`, over 8 KiB (capped with "…") → Result; types `attachment`, `system`, `mode`, `ai-title` → Ignored; not JSON → Invalid; `user` with `message.content` a number or missing → Unrecognized; item keys are `uuid` + block index (SRS-FR-149, SRS-FR-153)
- [x] 1.2 RED: `tool_arg` — Read/Edit/MultiEdit/Write/NotebookEdit `file_path` relative to the workspace when inside it, absolute otherwise; Bash first line capped at 120 chars; Grep/Glob `pattern`; WebFetch `url`; WebSearch `query`; Agent/Task and others `description`; none
- [x] 1.3 Implement `parse_record`, `ChatItem`, `tool_arg` — GREEN

## 2. Transcript tail (tests first) — seam 2

- [x] 2.1 RED: `Tail::poll` on a temp file — first poll returns all items and a reset; appended lines come on the next poll; a partial last line waits for its `\n`; a shorter file restarts from 0 with a reset; a missing file gives a reset with no items and not unreadable; a directory at the path (read error) gives unreadable; only Unrecognized user/assistant records → unreadable; one Invalid line among good ones → items, not unreadable; `switch(path)` restarts on the new file with a reset and never reads the old one again (SRS-FR-151, SRS-FR-153)
- [x] 2.2 RED latency: the real poll thread at 250 ms, 20 records appended one after another with a pause, every item sent ≤ 1 s after its write; the thread stops when told to (SRS-FR-150)
- [x] 2.3 Implement `Tail`, the poll thread and the expected-path function (cwd encoding) — GREEN

## 3. Pane wiring (tests first) — seam 3

- [x] 3.1 RED in `src-tauri/src/pane_commands.rs` tests with a fake `StatusOut`: a pane's first chat message is `{"chat":{"reset":true,…}}`; a hook's `transcript_path` different from the expected path moves the tail there; a `session_id` change with a new `transcript_path` sends `{"session"}` and then a reset from the new file, and later writes to the old file send nothing; a first read of 1 200 records arrives as a reset of 500 plus two appends; closing the pane stops the chat thread
- [x] 3.2 Implement: `PaneHooks` and `SessionFollower` hand `transcript_path` to the pane's tail; the chat thread starts with the pane process and stops in `TrackedProcess` close; messages on the pane channel — GREEN

## 4. Activity state and status line (tests first) — seams 4, 5

- [x] 4.1 RED in new `src-tauri/src/activity.rs` tests: `PreToolUse` Bash `npm test` → tool "Bash"/"npm test"; `PostToolUse` of the same id → no tool; `PostToolUse` with `backgroundTaskId` → shells 1; `PreToolUse` with `shell_id` of that shell → shells 0; `Stop` with `background_tasks` (measured payload) → shells = running shell entries; `SubagentStart` ×2 → subagents 2, one `SubagentStop` → 1; status line with `used_percentage` 41.6 → context 42, null → unchanged; `SessionStart` `source: clear` → tool and subagents cleared; a snapshot is sent only on change (SRS-FR-152)
- [x] 4.2 RED in `src-tauri/src/hooks.rs` tests: `hook_settings` has handlers for `SubagentStart` and `SubagentStop` and a `statusLine` command with padding 0; run the command with `sh` (unix) — stdin reaches the status sink of the test listener, a fake `AGENT_DECK_STATUSLINE` (`cat >/dev/null; echo main · 3 files`) prints "main · 3 files", no output when unset, exit 0 when the listener is gone (status-board › SRS-NFR-006)
- [x] 4.3 RED: user status line lookup reads `<ws>/.claude/settings.local.json`, then `<ws>/.claude/settings.json`, then `~/.claude/settings.json` (temp home), first `statusLine.command` wins, invalid JSON counts as none, `padding`/`refreshInterval` copied; file bytes and mtimes unchanged after the lookup (SRS-NFR-005, SRS-NFR-006)
- [x] 4.4 Implement `Activity`, the status line sink on a second token, `SubagentStart`/`SubagentStop` in `POSTED_EVENTS`, the wrapper commands (unix and Windows), the lookup and `AGENT_DECK_STATUSLINE` in the session env; `{"activity"}` on the pane channel — GREEN

## 5. Frontend stream and state (tests first) — seams 6, 7

- [x] 5.1 RED in `src/api/sessions.test.ts`: `{"chat"}` and `{"activity"}` messages reach `onChat`/`onActivity`, are queued before a listener exists, and do not disturb output, status, session and exit delivery
- [x] 5.2 RED in new `src/components/chatState.test.ts`: `applyChat` — starts loading; reset ends loading and replaces items; appends keep order; a Result attaches to its Tool, also when it comes first; duplicate keys dropped; unreadable sets the flag; `activityText` — all parts, zero counts and unknown parts left out, the SRS example string
- [x] 5.3 Implement `onChat`/`onActivity` in `sessions.ts`, `chatState.ts`, and `chat`/`activity` per pane in `useSessionPanes.ts` — GREEN

## 6. Chat view, Activity Bar, View Switch (tests first) — seam 8

- [x] 6.1 RED in `src/components/ViewSwitch.test.tsx`: Chat is not `aria-disabled` and calls `onChoose("chat")`; Plan still disabled (pane-views › SRS-FR-146)
- [x] 6.2 RED in new `src/components/ChatView.test.tsx`: prompt bubble, tool card "Read src/login.ts" with `aria-expanded="false"`, opening shows the result, error result in red, tool without result shows "đang chạy…", reply text with line breaks kept; skeleton while loading with no "Đang tải"; empty body for no items; unreadable shows "Không đọc được hội thoại, xem ở Term" with the `triangle-alert` icon; follows new entries at the bottom, not when scrolled up (SRS-FR-149, SRS-FR-153)
- [x] 6.3 RED: `ActivityBar` shows `activityText` with the busy dot while the status is `Running`, nothing otherwise (SRS-FR-152)
- [x] 6.4 RED in `src/App.test.tsx` › new `describe("Chat view (CR-016)")` with the fake client: choosing Chat shows the pane's conversation and hides Term without stopping the session; entries sent while Term is shown are there when Chat is chosen; a reset after `{"session"}` shows only the new conversation; unreadable then Term still takes input; Activity Bar appears on `Running` and goes on `Idle`; a new pane still opens in Term with focus in its terminal (SRS-FR-014); a Shell exit while Chat was the previous view returns to Chat
- [x] 6.5 Implement `ChatView.tsx`, `ActivityBar.tsx`, the Chat `ViewLayer` in `TerminalPane.tsx`, `UNAVAILABLE = {"plan"}` and `chooseView("chat")`, `.bubble`/`.tool`/`.dot-busy`/`.ctx-ok` in `src/index.css`, labels in `src/labels.ts` with `labels.test.ts` cases — GREEN

## 6b. Design follow-ups before archive (approved at GATE 3)

- [x] 6b.1 Status line wrappers use `CURL`, `DISCARD` and `launcher::STATUS_LINE_ENV` instead of literals; one shared curl timeout constant or a one-line why for the status line's 2 s
- [x] 6b.2 Activity Bar words come from `labels.activity` (context, shells, subagents) with `labels.test.ts` cases; a labels.ts note names the Rust "[ảnh]" placeholder
- [x] 6b.3 One `reported_session(event)` helper (SessionEnd skip + non-empty id) used by `SessionFollower::follow` and `PaneChat::follow`
- [x] 6b.4 `createStream` parses each channel message once and shares one queue helper for session, chat and activity (status keeps its exit ordering)
- [x] 6b.5 `activityParts(a)` returns the count parts; `ActivityBar` maps over them; drop the test-only tool branch of `activityText`
- [x] 6b.6 One `send_unreadable(out)` in pane_chat.rs used by both unreadable paths

## 7. Close

- [x] 7.1 `npm test` green and `cargo test` (in `src-tauri`) green
- [x] 7.2 `npx tsc --noEmit` clean and `npm run build` succeeds
- [x] 7.3 `openspec validate add-chat-view --strict`
- [x] 7.4 Build and run the app under a separate identifier (never close the running agent-deck), open a real session in a scratch workspace, send a prompt that reads a file and runs a background `sleep`; screenshot Chat and the Activity Bar against `design.html` `#final`, `#loading`, `#error`; time a reply from transcript write to Chat; check Term still shows the user's status line; check `~/.claude/settings.json` unchanged (`shasum` before and after) — run 2026-11-26 on the real app (dev.agentdeck.verify, scratch folder): 7/7 cases pass; the /clear case failed first ("/clear" bubble) and was fixed in 257007a, then passed; reply on screen at +1.08 s after its transcript timestamp
- [x] 7.5 Windows 11: the status line wrapper posts and runs the user's command in PowerShell — needs the user's Windows machine; not run: no Windows machine here; stated at GATE 3 and archived on the user's go-ahead (the Windows code compiles: `cargo check --tests --target x86_64-pc-windows-msvc`)
