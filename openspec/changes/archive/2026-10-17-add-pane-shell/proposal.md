## Why

BR-05 of the agent-deck BRD (v2.2, CR-003): the user works with several Claude Code sessions in one window and
needs a plain terminal under each session — to run `npm run dev`, a test watcher or a quick `git` command in the
same folder — without leaving the app, and can hide it while it keeps running. A hidden shell must still be seen
(the idea behind SRS-FR-029, "không để phiên chạy ngầm không ai thấy"), so the pane header marks it and names the
command it runs. Backlog item 13 (Should), after items 7 and 10.

## What Changes

- Each pane header gets a Shell chip. Choosing it on a pane without a Pane Shell opens one below the session, in
  the same pane, running the operating system's default shell in the workspace folder, 30% of the pane high
  (SRS-FR-055).
- Choosing it again hides the Pane Shell and keeps its process running; choosing it once more shows it with its
  previous output and height (SRS-FR-056, SRS-FR-057).
- While hidden, the chip shows a running marker; when the shell runs a command, the chip shows that command's name
  instead of "Shell" (SRS-FR-058, design wireframe C).
- A divider between the session and the Pane Shell resizes both; the Pane Shell's terminal fits every size change,
  including maximize and restore (SRS-FR-059, SRS-FR-060).
- The Pane Shell closes when its process exits; closing the pane ends the shell process, hidden or not, and asks
  for confirmation first when the shell is running a command (SRS-FR-061, SRS-FR-062, SRS-FR-063).
- The Pane Shell keeps running after the session in its pane ends (SRS-FR-064).
- A shell that cannot start shows "Shell could not start" in the pane while the session keeps running
  (SRS-FR-065).

## Capabilities

### New Capabilities

- `pane-shell`: the Pane Shell below the session in a pane — open, hide, show, hidden marker, resize, refit, exit,
  end on close, close confirmation, life after the session, start failure (SRS-FR-055 … SRS-FR-065).

### Modified Capabilities

None. SRS-FR-027 and SRS-FR-029 keep their wording; the shell side of closing a pane is new requirements in
`pane-shell`.

## Impact

- Rust: new `shell` module with a registry of Pane Shells keyed by pane id, the shell launch (default shell,
  workspace folder, `session_env`), the foreground-command probe and a command label; new commands `open_shell`,
  `shell_write`, `shell_resize`, `shell_activity`; `close_pane`, `close_all_on_reload` and `close_all_on_exit` also
  end the pane's shell. `windows-sys` gains the `Win32_System_Diagnostics_ToolHelp` feature.
- UI: `SessionsClient` gains the shell calls; `PaneEntry` gains the shell's adapter, stream, visibility, height and
  activity; `useSessionPanes` gains `toggleShell`, `resizeShell` and the activity poll; `TerminalPane` renders the
  chip, the shell area and its divider; `App` folds the shell check into the close confirmation.
- Design: `design/agent-deck/design.html#cr003` and `brief.md` › "Đã chốt cho CR-003".
- No new token, no new npm dependency.
