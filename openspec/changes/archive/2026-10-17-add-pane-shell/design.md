## Context

A pane runs one Claude Code session in a PTY. Rust: `PaneRegistry` (`panes.rs`) maps a `PaneId` to its workspace,
session and process; `PtySession` (`pty/session.rs`) spawns the child with `portable-pty`, makes it a session leader
and ends its whole process group on close; `QueuedProcess` (`pane_commands.rs`) runs writes and resizes on a worker
thread; `open_blocking` resolves the workspace under the `list` lock and spawns with `session_env` and the PATH
from `LaunchLookup`. `close_pane` takes the process out of the registry and closes it on a thread;
`close_all_on_reload` / `close_all_on_exit` do the same for every pane.

UI: `useSessionPanes` owns `PaneEntry[]` (adapter, stream, status, ended…) and the layout tree; `TerminalPane`
opens the xterm adapter once per entry, fits it on mount, on `ResizeObserver` and on maximize/restore, and sends
`client.resize` only on a size change; `App.requestClose` shows the SRS-FR-027 dialog when the session is busy and
clears it when the session stops being busy.

UI source of truth: `design/agent-deck/brief.md` › "Đã chốt cho CR-003" — wireframe C, colour version 1 · Viền
iris, `design.html#cr003`, `#cr003-v1-iris`, `#cr003-states-*`. Approach A (the backend probes the shell's
foreground command; no shell integration scripts) was chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- One Pane Shell per pane, below the session, opened, hidden and shown from the header chip without losing output
  (SRS-FR-055, SRS-FR-056, SRS-FR-057).
- A hidden shell is always marked, with the name of the command it runs (SRS-FR-058).
- Divider and refit (SRS-FR-059, SRS-FR-060); exit, end on close, confirmation, life after the session, start
  failure (SRS-FR-061 … SRS-FR-065).

**Non-Goals** (the SRS is silent or excludes it; a wish here goes through `/ba-change`):

- Several shells or tabs in one pane; choosing a shell other than the default one.
- Keeping a shell, its output or its height across app restarts.
- A status or Status Highlight for the shell; the shell in Active Sessions.
- The exact typed command line on Windows (the chip shows the program name there, see D3).
- A keyboard shortcut for Shell.
- The session ending because its shell exits, or the other way round (SRS-FR-064 only keeps the shell alive).

## Decisions

**D1 — A separate `ShellRegistry`, keyed by pane id.**
New module `shell.rs`: `ShellRegistry { shells: HashMap<PaneId, ShellEntry> }` in `AppState.shells`, next to
`panes`, with `open`, `write`, `resize`, `activity`, `take`, `take_all`. A shell is tied to an existing pane:
`open_shell(paneId, cols, rows, output)` looks the pane's workspace up through `PaneRegistry` (new
`workspace_of(paneId)`), then its folder under the `list` lock, and fails with `not_found` for an unknown pane or
`already_open` when the pane has a live shell. Rejected: a second process inside `Pane` — every existing registry
method and its tests would have to learn which process they mean, and the session's `ended`/`AlreadyOpen` logic
must never see the shell.

**D2 — The shell process.**
macOS/Unix: the user's shell from `user_shell()` (already used for the login PATH), run with `-l` so rc files and
the prompt are the user's own; Windows: `powershell.exe -NoLogo`. `cwd` = workspace folder, environment =
`session_env(inherited_env(), launch.path)`, so the PATH is the login PATH and the Claude Code variables of the
launching context do not leak in. Spawned through `PtySession` and wrapped in `QueuedProcess`, so it gets the same
process-group end and the same non-blocking writes as a session. Output and the final `{"exited": code}` go on the
shell's own channel; no status messages. A spawn error returns `shell_failed` (SRS-FR-065).

**D3 — Foreground probe and command label.**
`ShellEntry` keeps a `ForegroundProbe`:
- Unix: a `dup` of the PTY master fd taken at spawn (closed on drop) and the shell's pid (= its process group,
  `setsid`). `tcgetpgrp(fd) != shell_pid` → busy; the command is the argv of the foreground group leader, read with
  `sysctl(KERN_PROCARGS2)` on macOS.
- Windows: the shell's pid from the child; a `CreateToolhelp32Snapshot` walk finds its newest child process → busy,
  command = that executable's name without `.exe`.
`command_label(argv)` is a pure function: when `argv[0]`'s file name is an interpreter (`node`, `python`, `python3`,
`ruby`, `perl`, `bun`, `deno`) and `argv[1]` is a script path, the label starts from the script's file name; otherwise
from `argv[0]`'s file name; the remaining arguments follow, joined by spaces (`node /opt/homebrew/bin/npm run dev` →
`npm run dev`). No argv (permission, platform) → busy with label `null`; the chip then says "Shell".
`shell_activity(paneId)` → `{ busy, command }`. Rejected at GATE 1: shell integration scripts (approach B).

**D4 — Closing.**
`close_pane` also takes the pane's shell from `ShellRegistry` and closes it on the same thread as the session
(SRS-FR-062); `close_all_on_reload` and `close_all_on_exit` take all shells too. Deleting an open session closes its
pane through `closePane`, so the shell ends on that path as well. Hiding never touches the process.

**D5 — `PaneEntry.shell`.**
`shell: ShellEntry | null` with `adapter`, `stream`, `visible`, `ratio` (height share, default 0.3), `activity`
(`{ busy, command } | null`), plus `shellFailed: boolean` on the entry. `useSessionPanes` gains
`toggleShell(paneId)` (none → open; visible → hide; hidden → show), `resizeShell(paneId, ratio)` and
`dismissShellFailure(paneId)`. Open: a fresh adapter, `client.openShell(paneId, 80, 24)`; the pane fits it right
after mount and resizes the shell to match (same path as a session pane). Exit → `shell: null`, adapter disposed
(SRS-FR-061). Open failure → `shellFailed: true`, adapter disposed, session untouched (SRS-FR-065); `already_open`
(a second click before the first shell rendered) only disposes the new adapter. The adapter is
never disposed on hide, and output keeps being written to it (SRS-FR-057). Closing a pane disposes its shell's
adapter and stream with the session's.

**D6 — Activity poll.**
While at least one shell is hidden, one interval (1 s) calls `client.shellActivity` for each hidden shell and stores
the result; a failed call keeps the last value. The chip text comes from `activity` (D3); the marker comes from
`visible === false` alone, so it shows even before the first poll answers (SRS-FR-058).

**D7 — Shell area, divider and refit in `TerminalPane`.**
Below the session body: a wrapper with `border-t border-border bg-card`, height `ratio × pane body`, a row-resize
divider at its top edge with the grip of the design, then the shell's xterm container. Hidden = the wrapper gets
`hidden`; the session body then takes the whole pane. The divider drag computes the ratio inside the pane section,
clamped so both parts keep at least 80 px. The shell terminal uses its own `fit` + `ResizeObserver` and
`client.shellResize`, skipped while hidden; showing it, a ratio change and maximize/restore call that `fit`
explicitly (same reason as the session's D4 in add-pane-maximize: jsdom has no `ResizeObserver`). The new chip sits
between `⇣` and `⤢` with the classes of `#cr003-v1-iris`: none `border-border text-muted-foreground`; visible
`border-ring bg-accent text-accent-foreground`; hidden `border-primary text-accent-foreground` + `bg-primary` dot,
text = command (mono, truncated) or "Shell". `aria-label` "Open shell" / "Hide shell" / "Show shell". Failure: the
`--error-*` strip "Shell could not start" with ✕ at the bottom of the pane.

**D8 — One close dialog.**
`App.requestClose`: when the pane has a shell, `await client.shellActivity(paneId)` first, hidden or visible. Session
busy (SRS-FR-027) → the existing dialog, with the detail extended by "… and the shell command will be stopped." when
that answer says the shell is busy. Session not busy and the shell busy → "A command is still running in the shell.
Close anyway?" with detail "`<command>` will be stopped." (or "The shell command will be stopped."), Cancel / Close
(Close in `--error`); not busy or the call fails with `not_found` → close. A failed activity call for any other
reason counts as busy without a command (safer side).

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| R1 domain | `command_label(argv: &[String]) -> Option<String>` | SRS-FR-058 chip text: interpreter + script → script name + args; plain program → its file name + args; empty argv → `None` | `cargo test`, plain vectors |
| R2 registry | `ShellRegistry` with a fake spawner and a fake probe | SRS-FR-055 open for a known pane only, one live shell per pane; SRS-FR-061 a new shell may open after exit; SRS-FR-062 `take` / `take_all` hand back the process so `close_pane` ends it; SRS-FR-065 spawn failure → `shell_failed`, nothing registered | `cargo test` |
| R3 real PTY (Unix) | `spawn_shell(spec) → ShellEntry` + `activity()` | SRS-FR-055 shell runs in `cwd` (`pwd`); SRS-FR-063 at prompt → not busy, `sleep 30` → busy with label `sleep 30`; SRS-FR-062 close ends `sleep` too | `cargo test` with `/bin/sh` |
| U1 UI | `App` with fake clients and fake adapters | SRS-FR-055 chip opens, `openShell` with the pane id, area 30%; SRS-FR-056 hide → area hidden, adapter not disposed, no close call; SRS-FR-057 show → same adapter holds output emitted while hidden, same ratio; SRS-FR-058 marker + command / "Shell", no marker when none or visible; SRS-FR-059/060 divider drag → ratio changes and `shellResize` with the new size, maximize → `shellResize`; SRS-FR-061 exit → area gone, chip back to none, next click opens a new shell; SRS-FR-062 close pane → shell stream and adapter disposed; SRS-FR-063 busy shell → dialog, Cancel keeps it, prompt → no dialog, busy session + busy shell → one dialog; SRS-FR-064 session exit keeps the shell area and its input; SRS-FR-065 `openShell` rejects → "Shell could not start", session still running | Vitest + Testing Library |
| — real app | — | login shell and PATH in the shell, `npm run dev` hidden keeps serving and its name shows on the chip, close ends it, Windows build | task 4.2 demo |

## Risks / Trade-offs

- [`sysctl(KERN_PROCARGS2)` is macOS-only; Linux is out of scope (BRD mục 5)] → other Unix targets compile with a
  probe that reports busy without a label.
- [Foreground pid read just as a command ends] → the next poll corrects the chip within 1 s; the close dialog asks
  again at the moment of closing.
- [Windows sees only the program name (`node`), not `npm run dev`] → accepted at GATE 1; listed in Non-Goals.
- [A shell launched with `-l` may print a slow or interactive rc] → it runs in the Pane Shell like in Terminal; the
  session is not affected.
- [One more PTY per pane] → SRS-NFR-001 (4 panes) is unchanged; the demo runs 4 panes with 2 shells.
