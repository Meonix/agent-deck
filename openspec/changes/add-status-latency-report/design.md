## Context

After `add-status-board`, each pane has a `StatusTracker` in Rust (`pane_status.rs`) that applies hook
signals, user answer keys and the PTY exit to a `StatusMachine` and sends
`{"status": {"state", "since", "reason", "tracked"}}` on the pane's channel. The UI (`useSessionPanes`)
stores the status on the pane entry; `boardCards` derives the Status Board. `since` is the time the state
was entered, so it is not a per-message report time (a "tracked only" message repeats an old `since`).

The workspace list is stored as JSON in the app data folder (`workspace/store.rs`, temp file + rename).
UI source of truth: `design/agent-deck/stories/States.stories.js` `StatusLatency` and
`StatusLatencyNoData`; title bar button in `render.js` (non-floating variant). Approach A was chosen at
GATE 1.

## Goals / Non-Goals

**Goals:**

- One record per state change of a tracked pane, with the report time and the time the board committed it.
- The report in SRS-FR-039, from records that survive app restarts for the 14-day window.

**Non-Goals:**

- Latency inside Claude Code (from a dialog appearing to the hook being sent) — not observable from
  outside; the report time is when the app receives the signal (Risks).
- Per-state or per-session breakdowns, charts, export — not in the SRS.
- Changes of untracked panes — they never reach the board (SRS-FR-036).

## Decisions

**D1 — The state message carries `reportedAt`.**
`{"status": {…, "reportedAt": <Unix ms> | null}}`. The tracker sets it to the `now` it used when a signal
changed the state: hook arrival, the answer key from the pane, or the PTY exit. Messages that only mark a
pane tracked carry `null`. This is "the time Claude Code reported the change" as the app can see it.

**D2 — The UI records once the board has committed the change.**
When `useSessionPanes` stores a status with a non-null `reportedAt` for a tracked pane, it queues
`{sessionId, state, reportedAt}`. The passive effect after that commit (React runs it after the browser
paints when the window is visible) takes `shownAt = Date.now()` (same wall clock as Rust) and calls `client.recordStatusShown(...)`
per queued change; failures are ignored (a lost record must not disturb the panes). `shownAt` is raised to
`reportedAt` when the clocks disagree (data rule: shown is never earlier than reported).
`requestAnimationFrame` was tried first and dropped after review: WKWebView holds frames back while the
window is minimised or covered, which would count the time the user is away as board latency and make the
trial fail for the wrong reason. That passive effects keep running while the WKWebView window is
hidden is checked in the demo (task 3.2).

**D3 — `StatusLatencyLog` in Rust, JSON lines in the app data folder.**
`status_latency.rs`: `StatusLatencyLog::new(dir)`, `append(record)`, `report(now) -> { within, total }`,
`prune(now)`. File `status-latency.jsonl`, one line
`{"session": "<id>", "state": "Needs Approval", "reportedAt": …, "shownAt": …}`; appended with
`OpenOptions::append`; a file whose last line was cut off by a crash gets a newline first, so the cut line
costs only itself. Lines are parsed from bytes, so a non-UTF-8 line is skipped too. `report` counts records with `shownAt >= now − 14 days`; `within` when
`shownAt − reportedAt <= 3000` ms. Unreadable lines are skipped. `prune` rewrites the file keeping the
window (temp file, `sync_all`, rename) only when a record is older than the window; it runs at startup and
each time the report opens. The record command accepts only the five state names (SRS-NFR-007). The log sits behind its own `Mutex` in `AppState`;
no other lock is held while it is used. Records hold a session id and a state — no session content, so
SRS-NFR-007 holds.

**D4 — Commands.**
`record_status_shown(session_id, state, reported_at, shown_at)` → appends; `status_latency_report()` →
`{ within, total }` computed with the current time. Both run off the main thread (`spawn_blocking`).

**D5 — Report overlay.**
A "Status Latency" button on the right of the title bar (classes from `render.js`). It opens a modal
overlay over the main window with the design's card ("Status Latency", "Last 14 days"); the panes stay
mounted underneath. The overlay adds a close button "✕" (`aria-label="Close report"`) and Escape — the
design shows the card only. `total = 0` → "No data yet". Otherwise the share
`floor(within × 1000 / total) / 10` printed without a trailing ".0" ("99.5%", "100%"), and
"`<within>` of `<total>` state changes appeared within 3 s". Flooring keeps 999 of 1000 from showing
"100%". The report loads each time the overlay opens.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 `StatusLatencyLog` (Rust) | `append`, `report(now)`, `prune(now)` | SRS-FR-038 (record kept), SRS-FR-039 (14-day window, `<= 3000` ms inclusive, counts) | `cargo test`, temp dir, injected `now` |
| S2 tracker `reportedAt` (Rust) | status JSON from `StatusTracker` | SRS-FR-038 (report time = change time; none for tracked-only and keep) | `cargo test`, fake `StatusOut` |
| S3 UI recording (React) | `createStream` status with `reportedAt`; `useSessionPanes` → `recordStatusShown` after the commit | SRS-FR-038 (one record per change, same-batch changes, shown ≥ reported, none for `null`) | Vitest, fake client, mocked `Date.now` |
| S4 UI report (React) | `formatShare(within, total)`, report overlay | SRS-FR-039 ("99.5%", "No data yet", "100%" only when all) | Vitest + Testing Library, fake client |
| — commands, startup prune | — | none alone | demo |
| — real `claude` end to end | — | records appear for real changes | demo (task 3.2) |

## Risks / Trade-offs

- [Report time is arrival time] → Claude Code's own delay before sending a hook is not counted; the report
  measures what the app controls (listener → board). Stated in the report's meaning, not hidden.
- [Clock steps (NTP, sleep)] → `Date.now()` and Rust `SystemTime` share the wall clock; a step between the
  two times can skew one record. `shownAt` is raised to `reportedAt`, so a step never gives a negative
  latency.
- [Hidden window] → recorded at commit, not at the next frame (D2), so time away is not latency.
- [Exit report time] → an exit's `reportedAt` is taken after the PTY drain (~100 ms), so exit-driven
  changes read up to ~100 ms faster than they were; small against the 3 s target.
- [Changes in one batch] → two changes committed together (e.g. `Running` then `Needs Approval` within
  one frame) are both recorded at that commit, although the first never showed on its own.
- [File growth] → a few hundred records a day; pruned at startup and each time the report opens.

## Open Questions

None.
