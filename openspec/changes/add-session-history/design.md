## Context

Claude Code keeps one file per session at `~/.claude/projects/<encoded folder>/<session id>.jsonl`, one
JSON record per line. The format is internal to Claude Code. Measured on this machine (Claude Code
2.1.300/301, read-only):

- 167 session files, 563 MB in all, the largest 58 MB — reading every file whole cannot meet SRS-NFR-003.
- Every file has records with `cwd`; the first one is always within the first 35 lines (p95: line 4).
  53 files change `cwd` later in the session, so the start folder is the first `cwd`.
- The folder name is the start folder with every non-alphanumeric character replaced by `-` — lossy:
  `/a/b-c` and `/a/b/c` share a folder, so `cwd` must be compared exactly (RULE-02).
- Last activity: the newest `timestamp` (ISO 8601 UTC, e.g. `2026-10-16T07:12:33.123Z`). The file mtime
  can be up to 25 h later than the last record, so it is only a fallback.
- Title per RULE-01: newest `{"type":"ai-title","aiTitle":…}`, else newest
  `{"type":"last-prompt","lastPrompt":…}` (already read by `session_title.rs` for pane headers).
- 4 sessions hold no user message (started and quit); they are sessions and are listed (SRS-FR-007).
- Subfolders of a project folder (89) hold other data, not sessions.

The sidebar (`WorkspaceSidebar.tsx`) has a Sessions header with "New Session"; panes know their
`sessionId`. UI source of truth: `design/agent-deck/stories/render.js` (session rows, `Live` label) and
`States.stories.js` (`EmptyNoFolders`, `EmptyNoSessions`, `LoadingSessions`, `ErrorUnreadableSessions`,
`ErrorFolderNotFound`). Approach A was chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- The list of SRS-FR-007..012 and SRS-FR-019 for any workspace, within 3 s for 200 sessions.
- Session files opened read-only; no network.

**Non-Goals:**

- Resume from a row (SRS-FR-013, SRS-FR-015, SRS-FR-016) — backlog item 6. Rows are not actionable yet.
- Live updates of the list while a folder stays selected (a session created outside the app shows on the
  next selection — SRS-FR-007 Giải thích); search, filters, deleting sessions.
- Showing sessions of a `Missing` folder — the design shows "This folder no longer exists on disk."; a
  different wish goes through `/ba-change`.

## Decisions

**D1 — Head read decides membership, without trusting folder names.**
`scan_sessions(projects_dir, workspace: &Path) -> SessionListing { sessions, unreadable }` walks
`projects_dir/*/*.jsonl` (one level, files only). For each file it reads lines from the start until the
first record with a string `cwd` (at most 1 MiB). The session belongs to the workspace when that `cwd` is
exactly the workspace path, or canonicalises (`dunce`) to it — memoised per distinct `cwd` — so a symlinked
start path still matches while a subfolder never does. Reading every file's head is cheap (a few lines
each) and keeps working if Claude Code changes how it names folders.

**D2 — Unreadable is counted where it can be attributed.**
A file that cannot be opened or read, or whose head has no parseable `cwd`, has no known folder. It is
counted as unreadable for the workspace only when it sits in the folder whose name is the workspace path
encoded the way Claude Code does today (non-alphanumerics → `-`). Elsewhere it is skipped silently.

**D3 — Tail read for title and last activity.**
`read_tail(file) -> TailFacts { last_activity_ms, ai_title, last_prompt }` reads the file backwards in
64 KiB chunks, parsing complete lines only (a cheap byte filter skips lines without `"timestamp"`,
`"ai-title"`, `"last-prompt"`). It stops once it has the newest `timestamp` and the newest `ai-title`, or at
the start of the file. `timestamp` is parsed by a small pure parser for `YYYY-MM-DDTHH:MM:SS[.fff]Z`; no
timestamp → file mtime. Title per RULE-01 with the existing cleaning (one line, ≤ 80 chars). The pane header
lookup `session_title` switches to the same tail reader, so a 58 MB file no longer costs a full read every
10 s.

**D4 — Command.**
`list_sessions(workspace_id)` → `{ sessions: [{ id, title, lastActivity }], unreadable }`, newest first,
run with `spawn_blocking`; `Missing` workspace → `Err("folder_missing")` without scanning; unknown id →
`Err("not_found")`. Files are opened with `File::open` only (read-only, SRS-NFR-005); nothing touches the
network (SRS-NFR-007).

**D5 — UI list merged with open panes.**
`useSessionList(client, selected, selectionCount, panes)` loads on every selection (also re-selecting the
same folder). `mergeSessions(scanned, panes, workspaceId)`:
rows of the scan; a pane session of that workspace missing from the scan gets a row with the pane's title
and its open time as last activity (SRS-FR-019 — Claude Code may not have written the file yet); every row
whose id is open in a pane gets `Live` (SRS-FR-012); order by last activity, newest first. A live row uses
the pane's title when the pane has one other than "(untitled)".
`formatWhen(ms, now)`: < 1 min "Just now"; < 60 min "N min ago"; < 24 h "N h ago"; previous calendar day
"Yesterday"; < 7 days "N days ago"; < 14 days "Last week"; otherwise "Oct 2" (with the year when not the
current year). The labels refresh every minute.
States per design: no selection → "Select a folder to see its sessions."; loading → skeleton rows; `Missing`
→ "This folder no longer exists on disk."; empty → "No sessions yet"; unreadable > 0 → the notice
"<N> sessions could not be read" above the rows ("1 session could not be read" for one).

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 `scan_sessions` (Rust) | `scan_sessions(projects_dir, workspace) -> SessionListing` | SRS-FR-007 (exact folder, subfolder and name-collision excluded), SRS-FR-008 (title, last activity), SRS-FR-009 (order), SRS-FR-010 (none), SRS-FR-011 (unreadable counted only in the workspace's folder), SRS-NFR-005 (content and mtime unchanged), SRS-NFR-003 (200 sessions incl. a 50 MB file < 3 s) | `cargo test`, temp `projects/` tree |
| S2 `read_tail` + `parse_timestamp` (Rust) | pure / file | SRS-FR-008 (newest timestamp, newest title, mtime fallback, chunk boundaries) | `cargo test` |
| S3 UI (React) | `formatWhen`, `mergeSessions`, sidebar list with fake client | SRS-FR-008 labels, SRS-FR-009, SRS-FR-010, SRS-FR-011 notice, SRS-FR-012 `Live` on/off, SRS-FR-019 new row on top, re-read on every selection | Vitest + Testing Library |
| — command glue | `list_sessions` | none alone | demo |
| — real data | — | SRS-NFR-003 on this machine's largest folder; SRS-NFR-007 inspection (no network API in the code path) | task 3.2 |

## Risks / Trade-offs

- [Claude Code changes its session format] → membership needs only `cwd`; title and activity degrade to
  "(untitled)" and mtime; files without a readable `cwd` in the workspace's folder are reported (SRS-FR-011).
- [Session without `ai-title`] → the tail read goes to the start of the file to be sure no older title
  exists; long untitled sessions are rare (6 418 `ai-title` records over 167 files).
- [Unreadable file elsewhere] → not counted (D2); a broken file whose folder name no longer matches is
  invisible.
- [Clock] → relative labels use the local clock; a wrong clock shows wrong labels, not a wrong order.

## Open Questions

None.
