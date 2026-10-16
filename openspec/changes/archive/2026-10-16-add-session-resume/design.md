## Context

`open_pane(workspace_id, cols, rows, output)` opens a pane: `PaneRegistry::open` rejects a `Missing`
workspace (`folder_missing`), makes a new session id and asks the `Spawner` to start
`claude --settings <hooks> --session-id <id>` in the workspace folder. The UI side (`useSessionPanes.newSession`)
measures the pane, inserts it to the right of the focused pane, focuses it (SRS-FR-014), wires output,
status and exit, and shows "Folder not found" for a `Missing` workspace. Item 5 lists sessions in the sidebar
(`WorkspaceSidebar.tsx`, `mergeSessions`); rows are not actionable yet. A pane counts as open (`Live`) while
it has started and not ended.

Claude Code 2.1.301: `--resume <session-id>` continues that session and keeps its id unless
`--fork-session` is given; `--session-id` together with `--resume` needs `--fork-session`. The `SessionStart`
hook is ignored by the status signal, so a resumed session is tracked like a new one.

UI source of truth: `design/agent-deck/stories/render.js` — the selected row has a `bg-muted` background and
a right-aligned "Resume" button below its title; `States.stories.js` `ErrorFolderNotFound` — the
"Folder not found" toast. Approach A was chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- Folder → session → Resume opens the session in a focused pane: BO-02 in 3 actions (SRS-FR-013, with
  SRS-FR-014 reused).
- One pane per running session (SRS-FR-015); `Missing` rejected (SRS-FR-016).

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- A session that is running in a terminal outside agent-deck — it is not detected; resuming it starts a
  second writer.
- A session file deleted between the list being read and "Resume" — Claude Code prints its own error in
  the pane and exits; the pane shows the session as ended (SRS-FR-028).
- Resume by double-click or keyboard shortcut, forking a session, resuming several at once.

## Decisions

**D1 — One open path with an optional session to resume.**
`open_pane` takes `resume_session_id: Option<String>`. `PaneRegistry::open(workspace, start, spawner, sink)`
with `start: Start = New | Resume(SessionId)`: `New` makes a fresh id as today, `Resume` keeps the given one.
`Spawner::spawn(cwd, session_id, start_kind, sink)`; `PtySpawner` passes `--resume <id>` for a resume and
`--session-id <id>` otherwise, hooks unchanged. Missing check, hook registration, start-failure handling and
the returned `OpenedPane` stay shared. Rejected: a separate `resume_pane` command (copies `open_blocking`).

**D2 — The id is checked before it reaches the command line.**
`resume_session_id` must parse as a UUID (`uuid::Uuid::parse_str`); the canonical hyphenated form is what
goes to `claude`. Anything else → `Err("invalid_session")` without spawning, so an id can never be read as
a flag. Ids come from session file names, which are UUIDs today.

**D3 — The registry refuses a second pane for a running session.**
The registry wraps each pane's sink so `exited` also marks the pane ended. `open` with
`Resume(id)` returns `OpenError::AlreadyOpen(pane_id)` → `Err("already_open")` when a pane holds `id` and has
not ended. An ended pane or a closed one does not block: resuming then opens a new pane, matching the `Live`
rule (an ended pane is not `Live`). The registry check is the safety net; the UI decides first (D4).

**D4 — UI: `resume` beside `newSession`.**
`useSessionPanes` gains `resume(workspace, session: { id, title })`:
1. `workspace.missing` → toast "Folder not found", nothing opens (SRS-FR-016).
2. An entry with that `sessionId`, started and not ended → `focusPane` on it, nothing opens (SRS-FR-015).
3. Otherwise the same open steps as `newSession` with `client.open(workspaceId, cols, rows, sessionId)`; the
   entry starts with the row's title instead of "(untitled)", then the title poll takes over.
`newSession` and `resume` share one internal `openPane`; the `opening` guard covers both, so a double click
opens one pane. Errors: `folder_missing` → toast "Folder not found" + workspace refresh (as today);
`already_open` → focus the entry holding that session if the UI has one, else the generic
"Could not open session" toast.

**D5 — Selectable rows.**
`SessionList` keeps the selected session id locally, cleared when the workspace changes or the row leaves
the list. A row is a button (`aria-pressed`) carrying title and label; the selected row gets `bg-muted` and a
"Resume" button under the title (design). `Live` rows are selectable too: Resume on them goes to D4 step 2.
`WorkspaceSidebar` gets `onResume(row)`; `App` calls `panes.resume(workspaces.selected, row)`.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 `PaneRegistry::open` (Rust) | `open(workspace, Start, spawner, sink) -> Result<Opened, OpenError>` with a fake spawner | SRS-FR-013 (resume keeps the id, spawned in the workspace folder as a resume), SRS-FR-015 (`AlreadyOpen` while running; allowed after exit or close), SRS-FR-016 (`Missing` → no spawn) | `cargo test` |
| S2 `PtySpawner` (Rust) | `spawn` with a fake `claude` that prints its args | SRS-FR-013 (`--resume <id>`, no `--session-id`; new session unchanged) | `cargo test` |
| S3 id check (Rust) | `resume_id(&str) -> Result<SessionId, …>` | D2 (UUID only, canonical form; `--help`, empty, path rejected) | `cargo test` |
| S4 UI (React) | `App` with fake clients | SRS-FR-013 (select row → Resume → `open` with the id, new pane focused, titled with the row), SRS-FR-015 (open session → its pane focused, `open` not called, pane count unchanged), SRS-FR-016 (`Missing` → toast, no `open`; `folder_missing` from the backend → toast) | Vitest + Testing Library |
| — command glue | `open_pane` | none alone | demo |
| — real Claude Code | — | SRS-FR-013 (conversation shown, "tiếp tục" answered in context, row `Live`, no duplicate row), BO-02 count over 5 sessions (A-09) | task 3.2 |

## Risks / Trade-offs

- [Claude Code changes `--resume` to fork by default] → the row would not turn `Live` and a new row would
  appear; caught by the demo in 3.2, fixed by checking the id Claude Code reports.
- [A session running outside agent-deck] → two writers on one session file; out of scope (Non-Goals).
- [Large session] → Claude Code replays the conversation on resume; the pane may take a moment to fill. The
  open itself does not wait for it.
- [Row selection lost on reload] → the list reloads when a pane opens or closes; the selected id is kept as
  long as the row is still listed.

## Open Questions

None.
