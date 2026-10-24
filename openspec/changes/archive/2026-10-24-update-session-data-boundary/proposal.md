## Why

CR-012 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-25) adds Progress Tracking: for a session the user
opts in, the app hands new parts of the session history to Claude Code (Claude Haiku on the user's login) to
summarise into checkpoints. Claude Code sends that text to its own servers, which the current SRS-NFR-007 forbids
without exception. SRS v1.12, BRD v5.0, backlog item 27; must land before item 28 (`add-session-progress`).

## What Changes

- SRS-NFR-007 gains one exception: session content may leave the machine only through Claude Code, and only for
  a session whose Progress Tracking is on.
- A session with Progress Tracking off keeps today's guarantee: the app sends none of its data anywhere.
- No code changes: the app has no network path today; the exception is used first by `add-session-progress`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-history`: "Data stays on the machine" (SRS-NFR-007) modified to allow summaries through Claude Code
  for tracked sessions.

## Impact

- Spec only: `openspec/specs/session-history/spec.md` after archive.
- Code: none. `src-tauri/src/hooks.rs` stays a loopback-only listener; no network client exists in `src-tauri/src`
  or `src` (grep for `reqwest`, `ureq`, `TcpStream::connect`, `fetch(`).
- Unchanged: `status-latency.jsonl` still holds no prompt text (`add-status-latency-report`).
