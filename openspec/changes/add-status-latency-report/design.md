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

- One record per state change of a tracked pane, with the report time and the time the board painted it.
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

**D2 — The UI records after the board has painted.**
When `useSessionPanes` stores a status with a non-null `reportedAt` for a tracked pane, it queues
`{sessionId, state, reportedAt}`. After React commits, one `requestAnimationFrame` callback takes
`shownAt = Date.now()` (same wall clock as Rust) for every queued change and calls
`client.recordStatusShown(...)` per change; failures are ignored (a lost record must not disturb the
panes). A change whose pane is gone before the frame is dropped. `shownAt` is raised to `reportedAt`
when the clocks disagree (data rule: shown is never earlier than reported).

**D3 — `StatusLatencyLog` in Rust, JSON lines in the app data folder.**
`status_latency.rs`: `StatusLatencyLog::new(dir)`, `append(record)`, `report(now) -> { within, total }`,
`prune(now)`. File `status-latency.jsonl`, one line
`{"session": "<id>", "state": "Needs Approval", "reportedAt": …, "shownAt": …}`; appended with
`OpenOptions::append`. `report` counts records with `shownAt >= now − 14 days`; `within` when
`shownAt − reportedAt <= 3000` ms. Unreadable lines are skipped. `prune` rewrites the file keeping the
window (temp file + rename) and runs once at startup. The log sits behind its own `Mutex` in `AppState`;
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
| S3 UI recording (React) | `createStream` status with `reportedAt`; `useSessionPanes` → `recordStatusShown` after a frame | SRS-FR-038 (one record per change, shown ≥ reported, none for `null`) | Vitest, fake client, mocked `requestAnimationFrame` and `Date.now` |
| S4 UI report (React) | `formatShare(within, total)`, report overlay | SRS-FR-039 ("99.5%", "No data yet", "100%" only when all) | Vitest + Testing Library, fake client |
| — commands, startup prune | — | none alone | demo |
| — real `claude` end to end | — | records appear for real changes | demo (task 3.2) |

## Risks / Trade-offs

- [Report time is arrival time] → Claude Code's own delay before sending a hook is not counted; the report
  measures what the app controls (listener → board). Stated in the report's meaning, not hidden.
- [Clock steps (NTP, sleep)] → `Date.now()` and Rust `SystemTime` share the wall clock; a step between the
  two times can skew one record. `shownAt` is raised to `reportedAt`, so a step never gives a negative
  latency.
- [Hidden window] → `requestAnimationFrame` waits while the window is hidden, so a change that arrives
  while the app is minimised records the time the user could first see it. That matches "showed on the
  board".
- [File growth] → a few hundred records a day; pruned at startup.

## Open Questions

None.
