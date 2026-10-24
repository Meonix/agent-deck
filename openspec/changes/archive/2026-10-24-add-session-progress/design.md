## Context

Each pane runs Claude Code in a PTY with per-pane hook settings (`--settings`, loopback `HookServer`), so the app
already receives `UserPromptSubmit`, `Stop`, `SessionEnd`… per pane (`hooks.rs`). `PaneHooks` in `pane_commands.rs`
fans each event out to `StatusTracker`, `SessionFollower` (follows `/clear` to the new session id) and `GoalKeeper`
(`session_goal.rs`: a store keyed by session id in `session-goals.json`, one keeper per pane that follows the
session and sends `{"goal": …}` on the pane's channel). The UI parses those messages in `src/api/sessions.ts`
(`onGoal`, `onSession`) and `TerminalPane.tsx` shows the Target Box. Claude Code's history is
`~/.claude/projects/<dir>/<id>.jsonl`, found by `session_title::find_session_file`; `session_list.rs` already parses
its records. `launcher::session_env` and `LaunchLookup` give the `claude` path and a sane env.

Spike (2026-10-25, Claude Code 2.1.310): `claude -p --model haiku --safe-mode --no-session-persistence --tools ""
--output-format json` with the prompt on stdin works on the user's login, returns `{"result": "...", "is_error":
false, ...}` in ~2.6 s, writes no project folder or `.jsonl`; `--json-schema` exists. `--bare` cannot be used: it
skips keychain reads, so the login is lost. Approach A was chosen at GATE 1. UI follows mockup A of the CR-012
brainstorm (strip under the Target Box) with existing tokens; no `/ux-design-ui` run.

## Goals / Non-Goals

**Goals:**

- SRS-FR-113 to SRS-FR-131 and SRS-NFR-011 to SRS-NFR-013, with no change to how the pane's Claude Code is launched.

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Turning on tracking for an old, very long session may need several summary runs in a row and then take longer
  than 30 seconds; SRS-FR-117 has no time bound and SRS-FR-124 applies to turns after that.
- A spending cap per day or per session; each run gets `--max-budget-usd 0.05` only as a guard against a runaway.
- Tracking a Pane Shell, or sessions open outside agent-deck.
- Editing, merging or deleting a Checkpoint by hand.
- Re-summarising history that was already summarised (e.g. after the PO edits the Target Box).

## Decisions

**D1 — `session_progress.rs`, mirroring `session_goal.rs`.**
`ProgressStore` keeps `HashMap<session id, ProgressRecord>` in `session-progress.json` (version 1, write to `.tmp`
then rename, corrupt file → `.bak`, unreadable → in-memory only — same policy as `GoalStore`).
`ProgressRecord = { tracking: On | Off, checkpoints: Vec<Checkpoint>, collapsed: bool, offset: u64 }`;
`Checkpoint = { summary, result, done: bool, started_at: "HH:MM" }`. A session with no record is `Unset` for a pane
opened with `Start::New` and `Off` for a resumed one (SRS-FR-113, SRS-FR-130); no record is written until the user
chooses. `offset` is the byte offset in the history file up to which content was summarised.
`remove(session)` is called by `delete_session` once the files are in the Trash; at launch, records whose history
file is not found are dropped (SRS-FR-129).

**D2 — `ProgressKeeper`, one per pane.**
Built in `PtySpawner::spawn` next to `GoalKeeper`, added to `PaneHooks` and `TrackedProcess`. It holds the current
session id (follows any event but `SessionEnd`, as `GoalKeeper` does) and whether the pane was opened new.
On a session change after `/clear` it gives the new session the previous session's `tracking` (SRS-FR-131).
On `Stop` with `tracking == On` it schedules an update (D3). `set_tracking(on)` writes the record, sends the state and,
when turning on, schedules an update from the record's `offset` (0 for a first turn on → whole history,
SRS-FR-117). `set_collapsed(c)` writes and sends. Every change sends one message on the pane channel:
`{"progress": {"tracking": "unset"|"on"|"off", "checkpoints": [...], "collapsed": bool, "updating": bool,
"failed": bool}}`. The pane never sends anything to Claude Code (SRS-NFR-011): the hook settings stay exactly as
today.

**D3 — Update run: single flight per session, coalesced.**
An update runs on its own thread: read the history file from `offset`, condense (D4), run the summarizer (D5),
merge (D6), store the new list and offset, send. While a run is in flight for a session, further `Stop`s only set a
`pending` flag; when the run ends and `pending` is set, one more run starts. Nothing new after condensing → no run
(SRS-FR-124 "nothing new"). `updating: true` is sent at start, `false` at the end. Failure (spawn error, timeout,
non-zero exit, `is_error`, output not matching the schema) → list and offset unchanged, `failed: true`, a
`diag::error` line (SRS-FR-128); the next successful run clears `failed`. More than one chunk (D4) → chunks run in
sequence, each merged and sent.

**D4 — Condenser: history records → compact text.**
Pure function over the JSONL lines after `offset`: user prompts (skipping meta, local-command and tool-result
records, as `first_prompt` does), assistant text, each tool call as `tool: Name — <first 120 chars of its main
input>`, tool errors as one line of at most 200 chars; each line prefixed with the record's local `HH:MM`. Tool
outputs are left out. Only whole lines are consumed; a trailing partial line stays for the next run. Output is cut
into chunks of at most 40 000 characters, each with the offset it ends at.

**D5 — `summarizer.rs`: the Claude Code run.**
(As built: `summarize` returns the parsed `Vec<Checkpoint>`, not the raw `result` string.)
Trait `Summarizer { fn summarize(&self, prompt: &str) -> Result<String, SummaryError> }` so the keeper is tested
with a fake. `ClaudeSummarizer` spawns the `claude` from `LaunchLookup` with
`-p --model haiku --safe-mode --no-session-persistence --tools "" --output-format json --json-schema <schema>
--max-budget-usd 0.05`, env from `session_env`, cwd the app data folder, prompt on stdin; kills it after 25 s so
the update lands within 30 s (SRS-FR-124). It returns the `result` string of the JSON output. Prompt (English
instructions, built by a pure function): the Session Goal, the current Checkpoint List as JSON, RULE-10 and RULE-11
in plain words, "write summaries and results in the language the user writes in, summary ≤ 80 characters, result
≤ 60", "`started_at` must be one of the HH:MM times in the text", then the condensed chunk. Schema: `{"checkpoints":
[{"summary", "result", "done", "started_at"}]}` — the full list, old ones first.

**D6 — Merge keeps the app's rules, whatever the model says.**
Pure `merge(old, proposed, fallback_time)`: the first `old.len()` proposed items update the old ones in order —
summary and result may change, `done` may go false → true but never back (SRS-FR-127 "Done stays done"); a
proposal shorter than `old` keeps the missing old items unchanged; extra items are appended as new Checkpoints;
an invalid `started_at` becomes `fallback_time` (the first time in the chunk). Empty summaries are dropped.

**D7 — Commands and UI.**
Tauri commands `set_progress_tracking(pane_id, on)` and `set_progress_collapsed(pane_id, collapsed)` (→ `PaneRegistry`
→ `PaneProcess`, like `set_goal`). `sessions.ts` parses `{progress}` into
`PaneProgress = { tracking, checkpoints, collapsed, updating, failed }` with `onProgress`, buffered like `onGoal`;
`useSessionPanes` keeps it per pane entry. `TerminalPane`:
- Tracking button before Stash, same size, glyph `☰`, `aria-label`/`title` "Track progress", `aria-pressed` when
  on (SRS-FR-116); excluded from the header double-click like other header buttons.
- `TrackingPrompt` below the Target Box while `tracking == "unset"`: "Track progress for this session?" · Track ·
  No; it never takes keyboard focus from the terminal (SRS-FR-113 to SRS-FR-115).
- `ProgressStrip` below that while `tracking == "on"` and the list is not empty (SRS-FR-118): header "Progress ·
  d/n", an updating dot while `updating`, "Couldn't update" while `failed`, a collapse/expand chevron. Rows: ✓ on
  `--running` for done, ● on `--approval` for in progress, summary, result in `--muted-foreground`, time; row height
  fixed so `max-height` = 4 rows with `overflow-y: auto` (SRS-FR-120); after each list change the last in-progress
  row gets `scrollIntoView({block: "nearest"})` (SRS-FR-121). Collapsed: one line "Progress · d/n · <latest
  in-progress summary>" (SRS-FR-122).

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 store | `ProgressStore::{load, get, set, remove, prune_missing}` | SRS-FR-129 round trip and delete; SRS-FR-130 no record → resumed `Off`, new `Unset` | `cargo test`, temp dir |
| S2 condenser | `condense(bytes, offset) -> Vec<Chunk>` | SRS-FR-124 nothing new → no chunk; partial last line left; tool output dropped; 40 000-char chunks | `cargo test`, fixture JSONL lines |
| S3 merge | `merge(old, proposed, fallback)` | SRS-FR-126 append only new; SRS-FR-127 done never reverts, missing kept; invalid time | `cargo test` |
| S4 keeper | `ProgressKeeper` with a fake `Summarizer` and a fake channel, fed hook events | SRS-FR-114/115/125 on/off; SRS-FR-117 whole history then continue; SRS-FR-124 Stop → update, coalescing; SRS-FR-128 failure keeps list; SRS-FR-131 `/clear` inherits | `cargo test` |
| S5 summarizer args | `ClaudeSummarizer::args()`, `parse_output(stdout)`, `prompt(goal, list, chunk)` | SRS-NFR-012 `--no-session-persistence`; SRS-NFR-013 `--model haiku`, `--safe-mode`, no API key needed; NFR-011 pane args unchanged (existing spawn test) | `cargo test` |
| S6 UI | `parseMessage` in `sessions.ts`; `TerminalPane` props | SRS-FR-113, SRS-FR-116, SRS-FR-118 to SRS-FR-123 rendering and callbacks | Vitest + Testing Library |
| S7 app | `App` with fake clients (as in `App.test.tsx`) | prompt only on New Session, none on Resume (SRS-FR-113, SRS-FR-130); Track/No/button call the client | Vitest |
| — real app | — | SRS-FR-124 30 s on a real turn; SRS-NFR-012 no new `.jsonl`; BO-04 quality (A-12) | demo in the rebuilt `.app` |

## Risks / Trade-offs

- [Haiku splits or merges wrongly] → RULE-10 in the prompt plus the merge rules; BO-04 measures it over 10
  sessions; prompt tuning stays inside `summarizer.rs`.
- [Claude Code changes `-p` output or flags] → parse failure shows "Couldn't update" and logs the raw head of the
  output; the pane keeps working.
- [Many panes finish at once] → one run per tracked session at most, each ~3 s; no global limit.
- [`--safe-mode` disables something summaries need] → none needed: `--tools ""`, the prompt is self-contained.

## Migration Plan

New `session-progress.json` only; nothing to migrate. Rollback = revert; the file is then ignored.

## Open Questions

None.
