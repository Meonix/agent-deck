## Context

After `add-workspace-list` the app has a Rust `workspace` module (list, store), thin Tauri commands with a
`NoPanes` open-pane source, a typed TS client and a `WorkspaceSidebar` component (folders + empty state +
toast). Approach A was chosen at GATE 1: our own PTY layer in Rust (`portable-pty`) and xterm.js 6 in the
webview — the combination the brainstorm research recommended (Wave, Tabby and VS Code run xterm.js; the
`tauri-plugin-pty` plugin is still marked "Developing").

Facts measured on the dev machine: `claude` is `~/.local/bin/claude` → `~/.local/share/claude/versions/2.1.300`;
login shell `/bin/zsh`. A `.app` started from Finder gets launchd's PATH (`/usr/bin:/bin:/usr/sbin:/sbin`),
which does not contain `~/.local/bin`.

UI source of truth: `design/agent-deck/` layout B, proposal 4 — pane header (`render.js` `pane()`), states
`ErrorClaudeNotStarted` and `SessionEnded` in `States.stories.js`, `New Session` button in the sidebar
Sessions header. The Status Board column and the session list are later items.

## Goals / Non-Goals

**Goals:**

- Interactive `claude` sessions in panes on macOS with full terminal behaviour and Vietnamese input.
- Process lifetime is owned by the app: closing a pane or quitting the app leaves no `claude` or child
  process behind.
- The open-pane source behind SRS-FR-006 becomes real.

**Non-Goals:**

- Confirmation before closing a busy pane (SRS-FR-027) — backlog item 3; panes close immediately here.
- Status tracking, hooks, Status Board — items 3–4.
- Session list, resume, `Live` label — items 5–6. FR-014 and FR-021 are shown with "New Session" only.
- Split down, dragging dividers, 4-pane load target (SRS-FR-022, SRS-FR-023, SRS-NFR-001) — item 7. Panes
  are laid out left-to-right in equal columns in this change.
- Restoring panes after an app restart — not in the SRS; raise through `/ba-change` if wanted.
- What happens to running sessions when the app quits — the SRS is silent; this change ends them like a
  pane close (same reason as FR-029: no hidden sessions). Raise through `/ba-change` for another rule.
- Windows 11 run — deferred by the PO; Windows-only code compiles behind `cfg(windows)` but is unverified.

## Decisions

**D1 — Find `claude` through the login shell's PATH.**
At startup on Unix, run `$SHELL -l -c 'printf "__AD__%s__AD__" "$PATH"'` once (timeout 3 s), extract the
text between the markers, and use it as PATH for every pane; fall back to the process PATH. Then resolve
`claude` by scanning that PATH. Not found → the pane shows the start-failure message (SRS-FR-017) without
spawning anything. Alternatives: spawning every pane through `zsh -lc claude` (shell rc noise in every pane,
slower start); hard-coding `~/.local/bin` (breaks npm/Homebrew installs).

**D2 — One PTY per pane via `portable-pty`, spawn `claude --session-id <uuid>`.**
The app generates the session id (UUID v4) so later items (title lookup, status hooks, session list) can
find the session without guessing. Environment: inherited + resolved PATH, `TERM=xterm-256color`,
`COLORTERM=truecolor`, and `LANG=en_US.UTF-8` when `LANG`/`LC_ALL`/`LC_CTYPE` are unset — a Finder launch
has no locale, and without a UTF-8 locale Vietnamese input breaks (SRS-FR-026).

**D3 — Output: reader thread → batcher → binary `tauri::ipc::Channel`.**
A reader thread per pane reads the PTY; an `OutputBatcher` (pure, clock injected) flushes when 16 ms have
passed since the first unflushed byte or 64 KiB are buffered; chunks go to the webview as raw bytes
(`InvokeResponseBody::Raw`) on a per-pane `Channel`, not JSON events (Tauri docs: events are not for high
throughput). When the child exits, the pane gets an `exited` message with the exit code.

**D4 — Input and resize are plain commands.**
`pane_write(pane_id, data: string)` writes UTF-8 bytes; `pane_resize(pane_id, cols, rows)` resizes the PTY.
xterm.js `onData` already delivers the composed IME text, so Vietnamese composition happens in the webview
(SRS-FR-026) and Rust only forwards bytes.

**D5 — Ending a session ends its process group.**
On Unix the child is a session leader (portable-pty `setsid`); close sends `SIGHUP` then `SIGTERM` to the
process group, and `SIGKILL` after 2 s if still alive, then reaps. On Windows the child is assigned to a Job
Object with `KILL_ON_JOB_CLOSE` (portable-pty's `kill()` only terminates the root process). App exit
(`RunEvent::Exit`) closes every pane the same way.

**D6 — `PaneRegistry` owns panes and is the real `OpenPanes`.**
`PaneRegistry` maps pane id → (workspace id, session id, handle). It implements the existing `OpenPanes`
trait, replacing `NoPanes` in `remove_workspace`. The registry takes a `Spawner` trait so its rules
(open, close, per-workspace lookup, Missing rejection) are tested without real processes.

**D7 — Session title per RULE-01 from Claude Code's session file, read-only.**
`session_title(projects_dir, session_id)` finds `~/.claude/projects/*/<session-id>.jsonl` and returns the
newest `ai-title` record's title, else the newest `last-prompt`, else `(untitled)`. The file format is
internal to Claude Code (its docs say so) — any parse failure yields `(untitled)`, never an error. The UI
asks for the title when the pane opens and every 10 s while it is open.

**D8 — UI: `PaneGrid` + `TerminalPane` behind small seams.**
`insertRight(panes, focusedId, newPane)` is a pure layout function. `TerminalPane` wraps xterm.js
(`@xterm/addon-fit` on a `ResizeObserver`, `@xterm/addon-webgl` with canvas fallback) behind a
`TerminalAdapter` interface, so component tests run in jsdom with a fake adapter. A `SessionsClient` (typed,
like `WorkspacesClient`) wraps the commands and the channel. The "New Session" button lives in the
sidebar's Sessions header per the design; for a `Missing` workspace it shows the "Folder not found" toast
and calls nothing.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 launcher (Rust) | `parse_login_path(output) -> Option<String>`, `find_in_path(name, path) -> Option<PathBuf>`, `session_env(base) -> env` | SRS-FR-017 (not found → no spawn), locale for SRS-FR-026 | `cargo test`, temp dirs with fake executables |
| S2 `OutputBatcher` (Rust) | `push(bytes, now) -> Option<Vec<u8>>`, `flush_due(now)` | SRS-NFR-002 (≤ 16 ms batching budget), output order | `cargo test`, injected clock |
| S3 `PtySession` (Rust, real PTY) | `spawn(cmd, cwd, env, size)`, `write`, `resize`, `close`, exit notification | SRS-FR-018 (runs in the workspace folder), SRS-FR-024 (child sees new size), SRS-FR-028 (exit reported), SRS-FR-029 (group killed, children gone), SRS-NFR-002 (PTY echo round trip p95 < 100 ms over 200 bytes with `cat`) | `cargo test` integration tests on macOS using `/bin/sh`, `cat`, `stty size`, `sleep` instead of `claude` |
| S4 `PaneRegistry` (Rust) | `open(workspace, spawner) -> PaneId`, `close(id)`, `OpenPanes::has_open_panes` | SRS-FR-020 (Missing rejected), SRS-FR-006 now fed by real panes | `cargo test`, fake `Spawner` |
| S5 `session_title` (Rust) | `session_title(projects_dir, session_id) -> String` | SRS-FR-030 via RULE-01 | `cargo test`, temp `projects/` tree with sample jsonl lines |
| S6 UI (React) | `insertRight`, `PaneGrid`, `TerminalPane` with fake `TerminalAdapter` + fake `SessionsClient`, sidebar "New Session" | SRS-FR-014 (adapter focused on open), SRS-FR-017 / SRS-FR-028 messages, SRS-FR-020 toast, SRS-FR-021 order, SRS-FR-029 (close calls client and removes pane), SRS-FR-030 header text | Vitest + Testing Library |
| — Tauri command / channel glue | `open_pane`, `pane_write`, `pane_resize`, `close_pane`, `pane_title` | none alone | macOS demo |
| — Real `claude` in the built `.app` | — | SRS-FR-025, SRS-FR-026 (Telex), SRS-FR-024 visual, end-to-end SRS-NFR-002 (key → render) | demo script; for NFR-002 a dev-only latency log (`localStorage.adLatency = 1`) records key → echo time per keystroke and prints p95 after 200 keys |

## Risks / Trade-offs

- [Login shell slow or prints to stdout] → markers around PATH, 3 s timeout, fall back to process PATH.
- [xterm.js IME with Vietnamese Telex in WKWebView] → known weak spot of web terminals; covered by the demo
  on day one, not at the end. If it fails, the fallback is xterm's `screenReaderMode`/textarea composition
  tuning, and the change does not close until FR-026 passes.
- [WebGL context limits with many panes] → webgl addon falls back to the DOM renderer on context loss.
- [Claude Code session file format changes] → title falls back to "(untitled)"; never breaks the pane.
- [Orphaned processes if the app crashes] → process groups die with SIGHUP when the PTY master closes; a
  crash closes the master. Windows relies on the Job Object (unverified).

## Open Questions

None blocking.
