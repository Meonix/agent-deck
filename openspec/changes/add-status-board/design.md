## Context

After `add-session-pane` each pane runs `claude --session-id <uuid>` in a PTY owned by Rust; output and the
final `{"exited": code}` message reach the webview on one per-pane `tauri::ipc::Channel`. The UI keeps pane
entries in `useSessionPanes`; `TerminalPane` polls the title every 10 s. Approach A was chosen at GATE 1:
Claude Code hooks of type `http`, passed per process through `--settings`, posted to a listener inside the
app.

Facts (Claude Code 2.1.300, docs at code.claude.com/docs/en/hooks.md and cli-reference.md):

- `--settings` takes a file path or an inline JSON string; its values apply to that run only.
- Hook type `http` POSTs the event JSON to `url` with optional `headers` and `timeout`; a non-2xx answer or
  a connection failure does not block Claude Code.
- Every event carries `session_id`, `cwd`, `hook_event_name`. Events used here: `SessionStart`,
  `UserPromptSubmit`, `PreToolUse` (`tool_name`, `tool_input`), `PermissionRequest` (`tool_name`,
  `tool_input`), `Notification` (`notification_type`: `permission_prompt`, `elicitation_dialog`, …),
  `PostToolUse`, `PostToolUseFailure`, `PermissionDenied`, `Stop`, `StopFailure` (`error`: `rate_limit`,
  `overloaded`, `server_error`, `authentication_failed`, …), `SessionEnd`.
- `AskUserQuestion` has no event of its own; it is a `PreToolUse` with `tool_name` `AskUserQuestion`.
- Measured: in a folder the user has not trusted yet, `claude` stops at the trust prompt and no hook runs
  before the user accepts. A `--settings` path that does not exist makes `claude` exit with code 1.

Not documented, to be measured in task 1 before the code depends on it: whether `--settings` hooks add to
the user's own hooks or replace them; whether hook `session_id` equals the `--session-id` we pass; which
hook follows an answered (allowed or denied) permission prompt and an answered question.

UI source of truth: `design/agent-deck/` proposal 4 "Dark attention" — `render.js` `board`, `card`,
`pane()` header chip and status border; `States.stories.js` `StatusUnavailable`, `ConfirmClose`,
`DenseData`. This design does not copy tokens or layout from there.

## Goals / Non-Goals

**Goals:**

- Every session open in a pane has a state per SRS section 5, shown on the board within 3 s (BO-01).
- No write to the user's Claude Code configuration (SRS-NFR-006).
- Honest failure: a pane whose state is not tracked says so instead of looking `Idle`.

**Non-Goals:**

- Clicking a card to focus its pane (SRS-FR-037) — backlog item 8; cards are not interactive here.
- Recording status timing and the Status Latency report (SRS-FR-038, SRS-FR-039) — item 4. The title bar
  button "Status Latency" from the design is not added yet.
- The amber dot on folders with a waiting session (design proposal 4 sidebar) — not in any SRS-FR; raise
  through `/ba-change` if wanted.
- Sessions opened outside agent-deck — no state, not on the board (BRD section 5, SRS 2.6 A1).
- Windows 11 run — deferred by the PO; HTTP hooks on Windows are undocumented and unverified.

## Decisions

**D1 — One local HTTP listener, one secret token per pane.**
At startup Rust binds `tiny_http` on `127.0.0.1:0` (random port, loopback only) and serves on one thread.
Each pane gets a random token (UUID v4, not the pane id); hook URLs are
`http://127.0.0.1:<port>/hook/<token>`. The listener answers every request at once with `200 {}` (so Claude
Code is never held), caps bodies at 256 KiB, and drops requests whose token is unknown. Alternatives:
command hooks writing to a socket (one process per event, `.exe` path issues on Windows — option B at
GATE 1); a Tauri-managed server plugin (more surface than needed).

**D2 — Hooks go inline on the command line, never into a file under `~/.claude/`.**
`hook_settings(url) -> String` builds `{"hooks": {<Event>: [{"hooks": [{"type": "http", "url": …,
"timeout": 5}]}]}}` for the events in Context; the pane spawns `claude --settings <that JSON> --session-id
<uuid>`. No file is written, so nothing needs cleanup and SRS-NFR-006 holds by construction. If the
listener failed to start, panes spawn without `--settings` and their state is unavailable (D5).
If task 1 shows that `--settings` hooks replace the user's own hooks, stop and revise this decision through
`/opsx:update` before task 3.

**D3 — Hook event → signal, a pure function.**
`signal_of(event: &serde_json::Value) -> Option<Signal>` maps:

- `UserPromptSubmit` → `PromptSent`
- `PermissionRequest` → `ApprovalRequested(reason)`; reason = tool name plus its main target
  (`file_path`, `command` first line, `url`, `pattern`), e.g. `Edit src/main.rs` (path relative to the
  pane's workspace when inside it), capped at 60 chars
- `Notification` with `notification_type` `permission_prompt` or `elicitation_dialog` →
  `ApprovalRequested(reason)`, reason from `message`
- `PreToolUse` with `tool_name` `AskUserQuestion` → `ApprovalRequested("Question")` (A-06)
- `PostToolUse`, `PostToolUseFailure`, `PermissionDenied`, other `PreToolUse` → `ApprovalAnswered`
- `Stop` → `TurnFinished`
- `StopFailure` → `ErrorOccurred(reason = error)`, e.g. `overloaded`
- `SessionStart`, `SessionEnd`, anything else → no signal (`SessionStart` still marks the pane tracked, D5)

`PostToolUseFailure` is never an error: a failing command inside a continuing turn is not `Error`
(RULE-06). Task 1 may adjust which events count as `ApprovalAnswered`; the table in D4 does not change.

**D4 — Per-pane state machine that is the SRS section 5 table.**
`StatusMachine { state, since, reason }` starts `Idle` at pane open. `apply(signal, now) ->
Option<StatusChange>` looks up the 5 × 7 table of SRS section 5 cell by cell; a "keep" cell returns `None`
(SRS-FR-035). Re-entering the same state (`Running` + `PromptSent`, `Needs Approval` + `ApprovalRequested`,
`Error` + `ErrorOccurred`) keeps `since` and `reason` — the card shows when the wait began. The PTY exit
feeds `ExitedNormally` (code 0) or `ExitedAbnormally` (non-zero or killed by a signal; reason
`exit code N` / `killed`). A pane closed by the user is removed, so its card disappears (RULE-08); its
exit is not applied.

**D5 — Tracked or unavailable.**
A pane is `tracked` from the first hook request that reaches its token. The UI shows `Status unavailable`
in the pane header and keeps the pane off the board while the pane is not tracked and 5 s have passed since
it opened (SRS-FR-036). This covers a missing listener, `disableAllHooks`, an old Claude Code, and a folder
still waiting at the trust prompt; once hooks arrive the badge goes away. The 5 s timer lives in the UI.

**D6 — State travels on the pane's existing channel.**
Each change is sent on the pane's channel as JSON `{"status": {"state", "since", "reason", "tracked"}}`
(`since` = Unix ms), in order with output and before `{"exited": …}`. No new event type, no listener
permission, and messages that arrive before the UI subscribes are buffered by `createStream` as today.
`PaneRegistry` keeps token → pane; the listener thread looks the token up, applies the signal under the
`panes` lock (cheap, no I/O), and sends outside the lock. Lock order stays `list` before `panes`.

**D7 — UI: board derived from pane entries.**
Pane entries gain `status` and `title` (the title poll moves from `TerminalPane` into the entry so cards can
use it). `boardCards(entries) -> { Running, "Needs Approval", Error }` is pure; cards keep pane order.
`StatusBoard` renders the column as in design `board`/`card` ("Nothing here" when empty; time as local
`HH:MM`). `TerminalPane` header shows the state chip, or `Status unavailable` / `Not started` / `Ended`
badges, and its border takes the state colour (proposal 4). The grid becomes `240px 1fr 280px`.

**D8 — Confirm close in the UI.**
Close on a `Running` or `Needs Approval` pane opens a modal "Session is still running. Close anyway?" with
"`<workspace> · <title>` will be ended.", Cancel (default focus) and Close (SRS-FR-027); other states close
at once. Escape cancels.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 `signal_of` (Rust) | `signal_of(&Value) -> Option<Signal>` | SRS-FR-032 (event mapping, RULE-06 negative, A-06 question), SRS-FR-033 (reason text) | `cargo test`, JSON samples per event |
| S2 `StatusMachine` (Rust) | `new(now)`, `apply(signal, now) -> Option<StatusChange>` | SRS-FR-032 (all 35 cells of the section 5 table), SRS-FR-035 (keep cells), RULE-08 | `cargo test`, table-driven, injected time |
| S3 `HookServer` (Rust, real loopback) | `start() -> HookServer { port }`, `register(token, sink)`, `hook_settings(url)` | SRS-FR-034 (POST → sink < 100 ms), unknown token dropped, `tracked` on first request, settings JSON shape | `cargo test` with a real `127.0.0.1` POST |
| S4 spawn command (Rust) | real `Spawner` args | SRS-NFR-006 (`--settings` inline, no file written; spawn under a temp `HOME` leaves it empty) | `cargo test` with a fake `claude` script printing its args |
| S5 UI (React) | `boardCards`, `StatusBoard`, `TerminalPane` header, confirm dialog, unavailable timer | SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-036 (fake timers), SRS-FR-027 | Vitest + Testing Library, fake `SessionsClient` stream emitting `status` messages |
| — channel glue, listener thread wiring | — | none alone | demo |
| — real `claude` | — | end-to-end SRS-FR-034 with a real permission prompt; settings files unchanged (SRS-NFR-006 inspection) | demo script in task 5 |

## Risks / Trade-offs

- [`--settings` hooks replace the user's hooks] → measured in task 1 before any wiring; if so, D2 is revised
  through `/opsx:update` (e.g. merge the user's hook lists into the inline JSON, read-only).
- [Hook event set changes in a later Claude Code] → unknown events map to no signal; a pane that stops
  receiving hooks is not marked unavailable once tracked (only "never tracked" is detectable).
- [`StopFailure` cannot be provoked on demand] → covered by S1/S2 tests with sample JSON; the demo cannot
  show a real `overloaded` error.
- [Loopback port reachable by other local processes] → per-pane random token; unknown tokens dropped; the
  worst a local process can do is fake a state on a pane whose token it read from `ps`.
- [Long inline JSON on Windows command lines] → unverified; Windows deferred.

## Open Questions

None blocking. The three undocumented hook behaviours are task 1.
