## Why

The PO now uses agent-deck daily instead of running scripted demos, and wants serious problems to leave a trace
to fix later: crashes and unhandled errors, memory that keeps growing, the app stuck in a busy loop, and pane
processes or terminals that outlive their pane. Today errors go to `eprintln!`, which a Finder launch never
shows. Not in the backlog: the PO chose (2026-10-17) a change without `/ba-change`, so the SRS and backlog stay
as they are.

## What Changes

- One local diagnostic log file, rotated by size, written by the backend; the UI sends its errors there too.
- Errors and crashes: Rust panics, the errors now printed with `eprintln!`, and uncaught UI errors
  (`window.onerror`, `unhandledrejection`), rate-limited.
- Every 60 s a health line: memory and CPU of the app and of each pane's `claude` process, pane count.
- Warnings: app memory growing across 10 samples in a row, app CPU above 90 % for 30 s, a pane's process still
  alive 5 s after its pane closed, UI terminals or title timers not matching the open panes.
- Never logged: terminal output, keystrokes, prompts, session contents.

## Capabilities

### New Capabilities

- `diagnostics`: the diagnostic log, what it records, its warnings and what it never records.

### Modified Capabilities

None.

## Impact

- Rust: a log writer with rotation, a panic hook, a sampler thread (`ps` on macOS/Linux; Windows logs that
  sampling is unavailable), a check after pane close, commands `diag_log` and `diag_report`; `eprintln!` sites
  write to the log.
- UI: a small diagnostics module (error hooks, rate limit, counters report every 60 s).
- No new dependency. Log at `~/Library/Logs/dev.agentdeck.desktop/agent-deck.log` on macOS (Tauri's app log
  dir).
