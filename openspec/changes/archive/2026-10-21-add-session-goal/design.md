## Context

Every pane's Claude Code is spawned with inline `--settings` (`hook_settings` in `hooks.rs`) that POSTs ten events
over HTTP, plus `SessionStart` through a `curl` command hook, to a loopback `HookServer`. Each pane registers one
`Arc<dyn HookSink>` under a random token; today that sink is the pane's `StatusTracker`, and `serve()` always
answers with an empty body, because a `SessionStart` command hook's stdout would be added to Claude's context.

Claude Code's hook docs (code.claude.com/docs/en/hooks, read on 2026-10-21): a 2xx JSON body of an HTTP hook is
parsed like a command hook's stdout, so `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit",
"additionalContext":"…"}}` is added to Claude's context for that prompt; a plain-text body is a non-blocking error;
an empty body is a plain success; a non-2xx answer, a refused connection or a timeout is non-blocking, the prompt
goes through without context; `additionalContext` is capped at 10,000 characters. The `UserPromptSubmit` payload
carries `prompt` (raw text) and `session_id`. The docs do not say whether `session_id` changes after `/clear`;
the history directory shows a new `.jsonl` file after `/clear`, so this design keys goals by the hook's
`session_id` and task 5.2 confirms it on the real app.

Panes reach the UI over one `Channel` per pane: output bytes, `{"status": …}` and `{"exited": …}` JSON strings
(`ChannelStatus`, parsed by `asStatus`/`asExit` in `src/api/sessions.ts`). App data lives in `app_data_dir()`;
`WorkspaceStore` writes `workspaces.json` through a `.tmp` file and keeps a `.bak` of an unreadable file.
Session history files are read, never written (SRS-NFR-005); `session_list.rs` already reads their tail.

Approach A was chosen at GATE 1: Rust owns the goal, the UI only shows and edits it. `design/agent-deck/` has no
Goal Line; the PO chose the layout in CR-007 (own line under the header, pencil on the right), so `/ux-design-ui`
is skipped. Per the PO's standing rule this change is built on `master`, no worktree.

## Goals / Non-Goals

**Goals:**

- One goal per Claude Code session, pinned from its first prompt, edited from the pane, kept on disk
  (SRS-FR-091, SRS-FR-093, SRS-FR-096).
- Every `UserPromptSubmit` of a session with a goal is answered with the Focus Reminder (SRS-FR-094, SRS-FR-095).
- Any failure on that path answers like today, so the prompt goes through unchanged (SRS-FR-098).

**Non-Goals** (the SRS is silent or excludes it; a wish here goes through `/ba-change`):

- Classifying prompts with a separate AI call, blocking a prompt, a "done → new session" button (out of scope in
  CR-007).
- Goals for sessions opened outside agent-deck; showing the goal in Active Sessions or the Session History Panel.
- Pruning `session-goals.json` when a session is moved to the Trash; entries of deleted sessions stay (a few
  hundred bytes each).
- Measuring BO-03 inside the app; it is measured by hand with the prompt set of A-11.

## Decisions

**D1 — The sink answers.** `HookSink::hook(&self, event: Value) -> Option<Value>`. `serve()` writes the value as
`Content-Type: application/json` only when it is `Some` and the event's `hook_event_name` is `UserPromptSubmit`;
everything else keeps today's empty body, so the `SessionStart` command hook still prints nothing. The sink still
runs before the answer, so hook order per pane is unchanged. Rejected: a second endpoint per pane for prompts
(two registrations, same token lifecycle twice).

**D2 — `PaneHooks` feeds both.** A small sink in `pane_commands.rs` holds the pane's `StatusTracker` and
`GoalKeeper`, calls the tracker first (status timing untouched), then returns the keeper's answer. `StatusTracker`
returns `None`.

**D3 — `session_goal.rs`.**
- `GoalStore`: `HashMap<session_id, String>` loaded from `session-goals.json` in the app data directory, written
  whole through `.tmp` + rename on each change, unreadable file renamed to `.bak` and started empty — the same
  shape as `WorkspaceStore`. Shared `Arc<Mutex<…>>` in `AppState`. A write that fails is logged with
  `diag::error`; the goal stays in memory for this run.
- `GoalKeeper` (one per pane): the current `session_id` (from the hook payload, else the id the pane was opened
  with) and an out-channel to the pane. On any hook whose `session_id` differs from the current one, it switches and
  sends `{"goal": <stored text or null>}`. On `UserPromptSubmit`: no stored goal and a non-empty `prompt` → store the
  prompt as the goal and send it (SRS-FR-091); then, with a goal, return the reminder body (SRS-FR-094).
  `set(text)`: trimmed empty → no change; else store, send (SRS-FR-093).
- `focus_reminder(goal) -> String`: the goal cut to 500 characters (char boundary), inside this fixed English text
  (SRS-FR-095, RULE-09):
  > agent-deck Session Goal: "<goal>". This session is for that one task. A prompt that serves it — fixing a bug
  > that blocks it, running tests, committing, asking about work done for it — is in scope; do it. A prompt that
  > asks for a separate change that could stand on its own is off-goal: do not carry it out; say in one sentence
  > that it is a different task and suggest opening a new session for it. If the user then says to go ahead, do it.
- `reminder_body(goal) -> Value`: `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":…}}`.
- Any panic-free failure (lock poisoned, bad payload) returns `None` → empty body (SRS-FR-098).

**D4 — First prompt of an old session.** `first_prompt(path) -> Option<String>` beside `read_tail` in
`session_list.rs`: reads from the head, stops at the first `type: "user"` record that is not `isMeta` whose
`message.content` is a string, or a list with a `text` part, and is not a `tool_result`; a
`<command-name>/x</command-name>…<command-args>y</command-args>` wrapper becomes `/x y`; local-command wrappers
(`<local-command-caveat>`, `<local-command-stdout>`, `/clear` with no args) are skipped. Called once in
`open_blocking` for a resume whose session has no stored goal; a hit is stored, so it is read only once per session
(SRS-FR-097). File missing or unreadable → no goal.

**D5 — Command.** `set_session_goal(pane_id, text)` finds the pane's `GoalKeeper` (kept in the pane's
`TrackedProcess` next to the tracker) and calls `set`. Unknown pane → `"not_found"`.

**D6 — UI.** `asGoal(message)` in `sessions.ts` accepts `{"goal": string | null}` and the stream queues it like a
status; `PaneStream.onGoal(cb)`. `useSessionPanes` keeps `goal: string | null` per entry and exposes
`setGoal(paneId, text)` → `client.setGoal`. `TerminalPane` renders, right under `<header>` and outside it, a
`<div role="group" aria-label="Session goal">` with a 📌 mark, the text cut to 79 characters + "…" past 80
(`title` = full text), and a `<button aria-label="Edit goal">` with a pencil. Edit swaps the text for an
`<input>`: Enter → `setGoal` when the trimmed text is not empty, Esc or blur → back. The row sits outside the
`<header>` that owns double-click and drag, so it needs no event handling of its own for them (SRS-FR-066,
SRS-FR-080). Style: `text-xs text-muted-foreground`, one line, same padding as the header.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 pure | `focus_reminder(goal)`, `reminder_body(goal)` | SRS-FR-094: goal of 800 chars → 500 kept, char-safe on Vietnamese text; body has `hookEventName` `UserPromptSubmit`. SRS-FR-095: text names the goal, the in-scope list, "do not carry it out", "new session", "go ahead" | `cargo test` in `session_goal.rs` |
| S2 keeper | `GoalKeeper::hook(event) -> Option<Value>`, `set(text)`, with a temp-dir `GoalStore` and a fake out | SRS-FR-091: first prompt pinned and sent, second unchanged, new `session_id` (after `/clear`) → `null` sent, next prompt pinned, skill text kept whole. SRS-FR-093: set replaces + sent, blank ignored. SRS-FR-096: a new `GoalStore` on the same dir returns the goal; bad file → `.bak`, empty. SRS-FR-098: payload without `prompt`/`session_id` → `None` | `cargo test` |
| S3 server | `HookServer` + a sink returning `Some` / `None` | SRS-FR-094: `UserPromptSubmit` → 200 with the JSON body; SRS-FR-098: same event with `None`, and `SessionStart` with `Some`, → empty body | `cargo test` in `hooks.rs` (replaces `every_response_is_empty_and_closes`) |
| S4 history | `first_prompt(path)` on fixture `.jsonl` | SRS-FR-097: meta and local-command records skipped, `/dev-bug x` rebuilt, list content with text, no user record → `None`, file bytes unchanged | `cargo test` in `session_list.rs` |
| S5 UI | `TerminalPane` / `App` with fake clients | SRS-FR-092: no goal → no group; 120 chars → 79 + "…", `title` full; double-click on the group → not maximized. SRS-FR-093: pencil → input, Enter calls `setGoal`, blank Enter does not, Esc restores. `asGoal` parsing and queueing | Vitest + Testing Library in `TerminalPane.test.tsx`, `sessions.test.ts` |
| — real app | — | SRS-FR-095 with real Claude Code (off-goal pointed out, "cứ làm" goes ahead, "commit giúp" not flagged); `/clear` gives a new `session_id`; restart keeps the edited goal | task 5.2 demo |

## Risks / Trade-offs

- [Claude Code changes the hook answer format] → the prompt still goes through (non-blocking); only the reminder
  is lost. Checked again when Claude Code is upgraded, like the history format.
- [Claude ignores the reminder sometimes] → measured by BO-03; wording lives in one function, easy to tune.
- [`session_id` does not change on `/clear`] → the old goal would stay; task 5.2 checks it, a fix would key on
  `SessionStart` with `source: "clear"` instead.
- [First-prompt reader reads a large file from the head] → it stops at the first user record, normally within the
  first few lines.
