## Context

CR-016 item 38 (SRS v1.17 Baselined, SRS-FR-149 to SRS-FR-153; CR-019 moved SRS-FR-147 to item 39). The approved look is `design/agent-deck/cr016/design.html`: `#final` shows a pane in Chat (`chatBody()`: `.bubble` prompt on the right, reply text on the left, `.tool` cards with icon · tool name · mono argument · short result), `activity()` draws the Activity Bar (busy dot · tool · spacer · `context 42%` · `1 shell nền`), `#loading` the skeleton (`LOADING_CHAT`), `#error` the unreadable message (`ERR_CHAT`, `.callout-err` with `triangle-alert`). Where the design text and the SRS example differ (Activity Bar "context 42%" vs "42% context · 1 shell · 2 subagent"), the SRS wins (`handoff`), the design gives the layout.

Today: each pane's Claude Code runs with inline `--settings` from `hooks::hook_settings`, which posts `SessionStart` and ten other events to the loopback `HookServer` under a per-pane token. `PaneHooks` hands each event to the `StatusTracker` (state machine) and the `SessionFollower`, which notices a new `session_id` (as after `/clear`) and sends `{"session": id}` on the pane channel. The frontend `createStream` in `src/api/sessions.ts` splits channel messages into output bytes, `{"status"}`, `{"session"}` and `{"exited"}`. The View Switch (`ViewSwitch.tsx`) has Chat and Plan disabled; `TerminalPane` stacks a Term and a Shell `ViewLayer` (mounted, hidden with `invisible` + `inert`).

Facts measured on this machine (Claude Code 2.1.332, 2026-11-26, scratch runs):
- Every hook payload carries `session_id` and `transcript_path` (docs: hooks › common input fields).
- Bash with `run_in_background: true`: `PostToolUse.tool_response.backgroundTaskId` = `"bg08ys50j"`; the following `Stop` has `background_tasks: [{"id":"bg08ys50j","type":"shell","status":"running",…}]`, a later `Stop` has `[]`. No hook fires when a background shell ends by itself.
- An inline `--settings '{"statusLine":{…}}'` replaces the user's own status line (this machine has `sh ~/.claude/statusline.sh`); its stdin has `context_window.used_percentage` (null before the first reply) and `context_window_size`.
- Transcript records: `type` `user` (content a string, or an array of `text` / `tool_result`), `assistant` (one content block per record: `text`, `thinking` or `tool_use`), plus many other types (`attachment`, `system`, `mode`, `ai-title`, `api-request*`, `file-history-*`, …); flags `isSidechain`, `isMeta`. The docs call the format internal.

## Goals / Non-Goals

**Goals:**
- Chat view with prompts, replies and tool cards with results, live within 1 s, following `/clear`, with loading and unreadable states.
- Activity Bar while `Running`: tool, context share, background shells, subagents.
- No write to any Claude Code file or setting (SRS-NFR-005, SRS-NFR-006); the user's status line keeps working in Term.

**Non-Goals:**
- Opening panes in Chat, Composer, sending prompts (items 39 and up; SRS-FR-147 moved by CR-019).
- Approval Strip, Question Card (item 40), Plan (item 43), Files View, Settings.
- Markdown rendering of replies: replies are shown as plain text with line breaks kept, like `#final`. Anything richer → `/ba-change`.
- Images in prompts or tool results: shown as the text "[ảnh]".
- Virtualizing very long conversations; tool result text is capped (see Risks).
- Showing a subagent's own conversation.
- Remembering the open/closed state of tool cards or the scroll position across view switches beyond what the mounted layer keeps, or across launches.

## Decisions

- **Rust reads the transcript; the frontend only renders.** New `src-tauri/src/transcript.rs`. Reason: the hook server, the session follower and the pane channel already live there, and the webview needs no file access to `~/.claude/projects` (GATE 1, approach A). Alternative B (Tauri fs plugin in the webview): rejected, wider file permission than needed. Alternative C (`notify` file watcher): rejected, a new dependency with platform quirks; a 250 ms poll is well inside 1 s.

- **Record parsing (`transcript::parse_record(line: &str, cwd: &Path) -> Parsed`).** `Parsed` is `Items(Vec<ChatItem>)`, `Ignored` (a record type or flag Chat does not show) or `Unrecognized` (a `user`/`assistant` record whose `message.content` is not a string or an array of objects with `type`), or `Invalid` (not JSON).
  - Skipped as `Ignored`: any type other than `user`/`assistant`; `isSidechain == true`; `isMeta == true`; `isCompactSummary == true` (the `/compact` summary); the user text "[Request interrupted by user]" and "[Request interrupted by user for tool use]"; assistant `thinking`/`redacted_thinking` blocks; user strings that are Claude Code wrappers (`<local-command-stdout>`, `<local-command-stderr>`, `<local-command-caveat>`, `<system-reminder>`, `<bash-stdout>`, `<bash-stderr>`, `<task-notification>`).
  - `ChatItem::Prompt { text }`: user string, or the joined `text` blocks of a user array. A slash command record (`<command-name>/x</command-name>` … `<command-args>a</command-args>`) becomes the prompt "/x a", except `/clear`, which is Ignored so the new conversation starts with the next prompt (SRS-FR-151); `<bash-input>cmd</bash-input>` becomes "! cmd".
  - `ChatItem::Reply { text }`: assistant `text` block.
  - `ChatItem::Tool { id, name, arg }`: assistant `tool_use` block; `id` = its `id`.
  - `ChatItem::Result { tool_id, text, is_error }`: user `tool_result` block; `text` from a string content or the joined `text` blocks of an array, an `image` block as "[ảnh]", capped at 8 KiB with "…" (see Risks).
  - Each item carries the record's `uuid` plus its block index as `key`, so a re-read never duplicates.

- **Tool card.** Main argument (`transcript::tool_arg(name, input, cwd)`): `file_path` for Read, Edit, MultiEdit, Write and `notebook_path` for NotebookEdit (made relative to the workspace when inside it); `command` for Bash (first line, at most 120 chars including the closing "…"); `pattern` for Grep and Glob; `url` for WebFetch; `query` for WebSearch; `description` for Agent and Task and any other tool that has one; else none. The card is a `<button aria-expanded>` with an icon by tool family (lucide `file-text` Read, `pencil` Edit, `file-plus` Write, `terminal` Bash, `search` Grep/Glob/Web*, `bot` Agent, `wrench` otherwise), the name and the argument in `font-mono`; opening it shows the result text in a `pre` under it, red text when `is_error`. A tool with no result yet shows "đang chạy…" in the muted colour, as `CHAT2`.

- **Tailing (`transcript::Tail`).** State: `path`, `offset`, `partial` (bytes after the last `\n`), `hits` (records that gave `Items` or `Ignored` of type user/assistant), `misses` (`Unrecognized`). `poll()` opens the file read-only, seeks to `offset`, reads to the end, splits complete lines, keeps the tail in `partial`, and returns the new items. File shorter than `offset` → start again from 0 and report a reset. `NotFound` → no items and not unreadable (a new session writes its file on the first prompt). Any other IO error → `unreadable`. `misses > 0 && hits == 0` → `unreadable`; an `Invalid` line is skipped and counts for neither, so one damaged line among good ones is harmless (SRS-FR-153). One `chat` thread per pane polls every 250 ms and stops when the pane process is closed.

- **Which file.** The tail starts on the path Claude Code would use: `~/.claude/projects/<cwd with every non-alphanumeric char replaced by "-">/<session id>.jsonl` (docs: sessions › where transcripts are stored). The first hook event's `transcript_path` replaces it when it differs. When `SessionFollower` sees a new `session_id`, it hands the event's `transcript_path` to the tail, which restarts on that file and sends a reset (SRS-FR-151). The old file is no longer read.

- **Pane channel messages.** `{"chat": {"reset": true, "items": [...]}}` — the first message for a file (after the first poll, also when the file does not exist yet, so the skeleton ends) and after a switch or shrink; `{"chat": {"items": [...]}}` — appended items; `{"chat": {"unreadable": true}}`. A first read of a long file sends its items in chunks of 500 (reset with the first chunk). `{"activity": {"tool": string|null, "arg": string|null, "context": number|null, "shells": number, "subagents": number}}` on every change.

- **Activity state (`src-tauri/src/activity.rs`).** `Activity { tool: Option<(tool_use_id, name, arg)>, context: Option<u8>, shells: BTreeSet<String>, subagents: BTreeSet<String> }`, fed from the pane's hook sink and the status line sink:
  - `PreToolUse` → `tool` = that call; `PostToolUse` / `PostToolUseFailure` / `PermissionDenied` for the same `tool_use_id` → `tool = None`; `UserPromptSubmit`, `Stop`, `StopFailure` → `tool = None`.
  - `PostToolUse` whose `tool_response.backgroundTaskId` is a string → add to `shells`. A `PreToolUse` of KillShell or TaskStop whose `tool_input` has `shell_id`, `bash_id` or `task_id` naming a known shell → remove it; output readers (BashOutput, TaskOutput) leave it. `Stop` / `SubagentStop` with a `background_tasks` array → `shells` = ids of entries with `type == "shell"` and `status == "running"`. Between those events a shell that ended by itself is still counted (measured: no hook fires) — see Risks.
  - `SubagentStart` → add `agent_id`; `SubagentStop` → remove it. `SessionStart` with `source == "clear"` → clear `tool`, `subagents` and `context`.
  - Status line input → `context` = `round(context_window.used_percentage)` when it is a number.
  - The frontend shows the bar only while the pane's status is `Running`.

- **Hook settings gain `SubagentStart` and `SubagentStop`** (added to `POSTED_EVENTS`; same `curl … ; exit 0` command, never answered).

- **Status line.** `hook_settings(url, status_url)` adds `"statusLine": {"type": "command", "command": <wrapper>, "padding": 0}`, where `status_url` is a second token registered for the pane on the same `HookServer` (no server change: the status line JSON has no `hook_event_name`, so it gets its own sink). The wrapper reads stdin once, posts it in the background, and pipes it to the user's own command when there is one:
  - Unix: `i=$(cat); (printf '%s' "$i" | curl -s -m 2 -o /dev/null -X POST --data-binary @- <status_url> >/dev/null 2>&1 &); [ -n "$AGENT_DECK_STATUSLINE" ] && printf '%s' "$i" | sh -c "$AGENT_DECK_STATUSLINE"; exit 0`
  - Windows (Claude Code runs commands in PowerShell, as the hooks): `[Console]::InputEncoding=[Console]::OutputEncoding=$OutputEncoding=[Text.UTF8Encoding]::new($false); $i=[Console]::In.ReadToEnd(); $i | curl.exe -s -m 2 -o NUL -X POST --data-binary '@-' <status_url> | Out-Null; if ($env:AGENT_DECK_STATUSLINE) { $i | powershell -NoProfile -Command $env:AGENT_DECK_STATUSLINE }; exit 0` — the post runs in the foreground (a loopback post, capped at 2 s) because a `Start-Job` job dies with its PowerShell; not runnable on this machine, checked on Windows 11 in task 7.5.
  - `AGENT_DECK_STATUSLINE` is set in the session's environment (`launcher::session_env`) to the user's own `statusLine.command`, read (never written) from, in order of precedence, `<workspace>/.claude/settings.local.json`, `<workspace>/.claude/settings.json`, `~/.claude/settings.json`; an unreadable or invalid file counts as no setting. The user's `padding` is copied; `refreshInterval` too. Passing the command through the environment avoids quoting it inside the JSON and the shell string.

- **No feed.** A pane whose Claude Code did not start (`started == false`) has no tail: its Chat starts not loading and shows the start failure message (`labels.startFailed`) like Term. A pane started without a projects folder gets `{"chat":{"unreadable":true}}` once, so Chat never waits forever.

- **Frontend stream.** `PaneStream` gains `onChat(cb)` and `onActivity(cb)`, queued like `onStatus` until a listener exists. Pure reducer `applyChat(state, message)` in new `src/components/chatState.ts`: `ChatState { loading, unreadable, items: ChatEntry[] }`, a `Result` attaches to its `Tool` by id (a result before its tool is kept until the tool arrives), `reset` replaces everything, duplicate keys are dropped. `activityText(activity)` builds "Bash npm test · 42% context · 1 shell · 2 subagent" from the parts present.

- **Chat view.** New `src/components/ChatView.tsx` in a third `ViewLayer view="chat"` in `TerminalPane`, mounted from the pane's start so scroll and open cards survive view switches. Messages in a scroll box (`role="log"`, `aria-live="polite"`, `tabIndex=-1`), which follows new entries only while the user is within 40 px of the bottom. Choosing Chat focuses the scroll box (the reveal effect of item 37 already focuses the shown layer). `ActivityBar.tsx` sits under the scroll box, `h-7`, busy dot, `role="status"`.

- **View Switch.** `UNAVAILABLE` keeps only `"plan"`; `chooseView("chat")` sets the view and remembers it as `returnView` like Term, so a Shell exit returns to Chat. Panes still open in Term (SRS-FR-014; SRS-FR-147 is item 39).

- **CSS and labels.** `.bubble`, `.tool`, `.dot-busy`, `.ctx-ok` from the design into `src/index.css` (`.skel`, `.callout-err` exist). Labels: `chatUnreadable` "Không đọc được hội thoại, xem ở Term" (SRS); `chatLog` "Hội thoại", `toolRunning` "đang chạy…", `image` "[ảnh]", `activity` (the parts "42% context", "1 shell", "2 subagent") — the last four proposed, not in the Bảng nhãn, for PO confirmation as in item 37.

## Seams to test

Approved at GATE 2; no test is written elsewhere.

1. `transcript::parse_record` — Rust unit tests on fixture lines in the measured shapes (prompt string and array, slash command, `!` command, wrappers, meta, sidechain, thinking, text, tool_use, tool_result string/array/image/error, other types, not JSON, unrecognized user/assistant) and `tool_arg`.
2. `transcript::Tail::poll` — Rust tests on a temp file: append, partial last line, shrink → reset, not found → empty, unreadable rules, switch of path; plus the latency test: the real 250 ms poll thread, 20 appends one after another, each item out ≤ 1 s after its write (SRS-FR-150, SRS verification row).
3. Pane wiring — Rust test through `PaneHooks`/`SessionFollower` with a fake `StatusOut`: first `{"chat": {"reset"}}`, items after an append, reset and new file after a `session_id` change with a new `transcript_path`, nothing from the old file after the switch.
4. `activity::Activity` — Rust unit tests feeding hook events (taken from the measured payloads) and status line JSON, asserting the `{"activity"}` snapshots.
5. Status line command — Rust test (unix) that runs the generated `statusLine` command with `sh` like the existing `run_hook` tests: stdin reaches the test listener's status sink, the fake user command's output is printed, nothing when `AGENT_DECK_STATUSLINE` is unset, `exit 0` with the listener gone; and that the settings lookup reads the three files in precedence order without writing them.
6. `createStream` — TS unit tests: `{"chat"}` and `{"activity"}` messages reach `onChat`/`onActivity`, queued before a listener exists, other messages unaffected.
7. `applyChat` and `activityText` — TS unit tests.
8. App level — RTL tests with the fake `SessionsClient` as in `App.test.tsx`: Chat enabled and Plan disabled in the View Switch; choosing Chat shows the messages, opens a tool card, shows the skeleton before the first chat message, the unreadable message with Term still working, the Activity Bar only while `Running`; new panes still open in Term.

## Risks / Trade-offs

- [The transcript format is internal and may change] → only `user`/`assistant` with known shapes are read; a changed shape shows the SRS-FR-153 message instead of wrong content, and Term keeps working.
- [A background shell that ends by itself mid-turn stays counted until the turn's `Stop`] → measured, no hook exists for it; the bar is shown only while `Running`, and the count is right again at every `Stop`/`SubagentStop`. If the PO finds this wrong in use → `/ba-change` on SRS-FR-152.
- [Overriding the user's status line] → the wrapper runs the user's command with the same stdin, so Term shows the same text (scenario in `status-board`); a user command that depends on being run directly by Claude Code's own shell options may differ slightly.
- [Windows wrapper not run here] → task 7.5 on Windows 11; until then GATE 3 says so.
- [Very long conversations] → tool results capped at 8 KiB each, first read sent in chunks; no virtualization. A conversation of a few thousand entries renders all of them.
- [Poll cost: one thread per pane, a `stat`/read every 250 ms] → reads only new bytes; four panes (SRS-NFR-001) is four small reads per 250 ms.

## Migration Plan

No data migration; sessions launched after the update get the new settings. Rollback = revert the commit.

## Open Questions

None.
