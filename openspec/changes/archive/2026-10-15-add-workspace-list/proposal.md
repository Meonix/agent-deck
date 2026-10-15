## Why

BO-01 and BO-02 of the agent-deck BRD (v1.0) both start from a folder: a session is opened, resumed and
tracked inside a workspace folder. BR-01 asks that the user add, remove and select those folders and that
the list survives restarts. This is backlog item 1: every later item (session pane, status board, session
history) needs the Workspace List and the desktop app shell it lives in, so it ships first.

## What Changes

- New Tauri 2 desktop app shell (Rust core + React/TypeScript UI) that builds and runs on macOS 14+.
- New Workspace List: add a folder through the OS folder picker, reject duplicates by selecting the
  existing entry, remove an entry, mark entries whose folder no longer exists as `Missing`.
- Workspace List is persisted in the app's data directory and restored on start, in the same order.
- Removing a workspace that still has open panes is rejected with an English message. In this change no
  pane exists yet, so the guard is wired to a pane registry that is always empty until backlog item 2.
- All labels and messages are in English.
- The UI follows `design/agent-deck/` (layout B, colour proposal 4); this change builds only the
  Folders section of the left sidebar plus the empty state of the main area.

## Capabilities

### New Capabilities

- `workspace-list`: managing the user's working folders — add, de-duplicate, remove, `Missing` marking,
  persistence, removal guard for folders with open panes (SRS-FR-001 to SRS-FR-006, listed in full in the spec).
- `app-shell`: the installable desktop application itself — supported platforms and interface language
  (SRS-NFR-004, SRS-NFR-008).

### Modified Capabilities

None — `openspec/specs/` is empty.

## Impact

- New code: `src-tauri/` (Rust crate, Tauri 2), `src/` (React + TypeScript + Vite + Tailwind v4),
  root `package.json`.
- New dependencies: Rust toolchain via rustup (not yet installed on the dev machine), `tauri` 2,
  `tauri-plugin-dialog`, `serde`/`serde_json`; npm `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, React,
  Vite, Tailwind v4, Vitest, Testing Library.
- Data written by the app: one JSON file in the OS app data directory. Nothing under `~/.claude/` is read
  or written by this change.
- Windows 11 (part of SRS-NFR-004) is **not verified in this change** — the PO chose on 2026-10-16 to
  defer the Windows check; the BRD risk "check Windows from the first milestone" stays open.
