## Context

Errors are printed with `eprintln!` in 6 places (`lib.rs` setup, `pane_commands.rs` spawn and input, `hooks.rs`
accept, `latency_commands.rs` prune), invisible in a Finder launch. Release builds use `panic = "abort"`; a panic
hook still runs before the abort. `PaneRegistry` knows each pane's process; `QueuedProcess` ends a process group
on close. The UI keeps `entries` (panes), creates one xterm adapter per pane and one title timer per live pane
(`useSessionPanes`). The PO chose a lean change (one gate, no SRS/backlog change) on 2026-10-17.

## Goals / Non-Goals

**Goals:** a log that shows crashes, errors, memory growth, busy loops and leaked processes/terminals, with no
private data.

**Non-Goals:** a log viewer in the UI, uploading logs, Windows process sampling, profiling which code leaks.

## Decisions

**D1 — Own writer, no crate.** `diag::Log` (new `src-tauri/src/diag.rs`): `Mutex<File>` append, line
`<RFC 3339 UTC ms> <LEVEL> <source>: <message>`, rotate before a write that would pass 5 MB
(`.log` → `.log.1` → `.log.2`, `.log.3` dropped). One global instance set in `setup` from
`app.path().app_log_dir()`; before setup (or if the folder cannot be created) lines go to stderr. Messages are
single-lined (newlines → `\n`) and capped at 2 000 chars. Rejected: `tauri-plugin-log` (new dependency for what
is ~80 lines).

**D2 — Errors and panics.** `std::panic::set_hook` writes `ERROR panic: <message> at <file:line>` then calls the
previous hook. The 6 `eprintln!` sites call `diag::error(source, msg)` (pane input logs the error only, never the
bytes). Startup writes `INFO app: agent-deck <version> on <os>`.

**D3 — Sampler.** A thread started in `setup` wakes every 10 s and reads `ps -o pid=,rss=,%cpu= -p <app>,<pane
pids>` (unix); pane pids come from a new `PaneRegistry::pids()` (pane id → child pid). Every 6th sample it writes
the health line. A pure `Watchdog` takes each sample and returns warnings:
- memory: app RSS higher than the previous sample for 10 consecutive 60 s samples and ≥ 25 % above the first of
  them → `WARN watchdog: app memory grew …` once per streak;
- CPU: app %CPU > 90 on 3 consecutive 10 s samples → `WARN watchdog: app CPU … busy loop?`, again only after it
  drops below 90;
Windows: one `INFO` line that sampling is unavailable.

**D4 — Survivors.** `close_pane` (and close-all) hands the closed process ids to the sampler; 5 s later any
still alive (`kill(pid, 0)` succeeds) → `WARN pane: process <pid> of pane <id> survived close`.

**D5 — UI side.** `src/diagnostics.ts`: `installErrorHooks(client)` adds `error` / `unhandledrejection` listeners
sending `diag_log("ERROR", "ui", message)`, at most 20 per minute then one `WARN` with the dropped count;
`useSessionPanes` reports every 60 s `diag_report({ panes, terminals, titleTimers })` (terminals = adapters
created − disposed), and the backend warns when `terminals ≠ panes` or `titleTimers > live panes` twice in a
row.

### Seams to test (approve at the gate)

| Seam | Interface | Proves | How |
| --- | --- | --- | --- |
| S1 `diag::Log` | `Log::open(dir)`, `write(level, source, msg)` | format, single-line + cap, rotation 5 MB × 3 | `cargo test`, tempdir, small cap injected |
| S2 `Watchdog` (pure) | `observe(sample) -> Vec<Warning>` | memory streak, CPU sustain + re-arm, survivor check, report mismatch twice | `cargo test` |
| S3 panic hook | `diag::install_panic_hook(log)` | a panic in a thread writes the ERROR line | `cargo test` (spawned thread panics) |
| S4 UI | `installErrorHooks`, counters report | error + rejection logged, rate limit 20/min, report values | Vitest with fake client |
| — real app | — | log file appears with INFO start line and health lines | one manual look at the file |

## Risks / Trade-offs

- [`ps` every 10 s] → a short process spawn; cheap, and skipped when it fails (logged once).
- [False memory warnings] → RSS grows normally when panes open; the 25 % + 10-sample streak keeps noise low; it
  is a hint to look, not a verdict.
- [Log volume] → health line per minute ≈ 150 B → ~200 KB/day; rotation caps the total at 15 MB.
- ["app" is the Rust process only] → on macOS the WKWebView content process is launched by the system (parent
  pid 1), so JS heap growth or a render loop never shows in the app's rss / CPU and never trips the memory or CPU
  warning. UI-side leaks are caught only through the counters report (terminals, title timers). Measuring the
  web process (its pid via WebKit private API) is a follow-up if a UI leak is suspected.
- [Linux `ps`] → `%cpu` there is an average since process start, so the busy-loop check is close to blind on
  Linux; macOS reports recent CPU. Linux is not a target today.
- [Panic text] → a panic message is logged as Rust formats it; a string-slicing panic would quote up to 256
  bytes of that string. No slicing of terminal or prompt data was found; keep it that way.
- [Pane ids after exit] → a pane whose process was reaped reports no pid (an id can be reused), so it drops out
  of the health line and of the survivor check.

## Open Questions

None.
