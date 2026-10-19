## Context

`useSessionPanes.openPane` registers `stream.onExit(() => update(paneId, () => ({ ended: true })))`, so every
exit leaves an ended pane that `TerminalPane` renders with "Session ended". `SessionStream.onExit` already passes
the exit code: a number, or `null` when the process died from a signal (`src-tauri/src/pty/session.rs`).
`closePane(paneId)` calls `client.close(paneId)` — which also ends the Pane Shell on the Rust side — disposes
the stream, adapter and shell, and removes the pane from the layout with `removePane`, clearing
`focusedId`/`maximizedId` when they pointed at it. Requirements: SRS v1.5, CR-005; leftover table approved at
GATE 1.

## Goals / Non-Goals

**Goals:**

- Exit code 0 closes the pane through the same path as the Close button, minus the confirmation (SRS-FR-083).
- Any other exit keeps today's ended pane and its Pane Shell (SRS-FR-028, SRS-FR-064).

**Non-Goals:**

- Removing the `Ended` state, its badge or its place in the Active Sessions order — RULE-07 and SRS-FR-052 are
  unchanged by CR-005.
- Drag and drop of panes (backlog item 18) and reopening panes at launch (item 19).

## Decisions

- **Reuse `closePane` from `onExit`.** One close path keeps the Rust registry, the shell process and the layout in
  step. Alternative — remove the pane only in the UI — would leave the Pane Shell process and the backend pane
  entry alive. `client.close` on a pane whose session already exited is the path "removes the pane of a session
  that had already ended" uses today, so it is known to succeed.
- **`code === 0` is the only normal exit.** `null` (signal) and non-zero are abnormal, matching the status
  machine (`exit_codes_map_to_ended_or_error`) and the SRS term "Thoát bình thường".
- **An open close-confirmation goes away.** The App already dismisses the dialog when its pane ends; with the
  pane gone the same check holds.

## Seams to test

- **S1 — App with a fake `SessionsClient` (`App.test.tsx`)**: `stream.exit(0)` → pane region gone,
  `sessions.close` called, remaining pane fills the grid, no dialog; `stream.exit(1)` / `exit(null)` → pane kept
  with "Session ended". Covers SRS-FR-028, SRS-FR-083.
- **S2 — Pane Shell flow (`PaneShell.test.tsx`)**: shell open, session `exit(0)` → pane and shell gone (shell
  stream disposed); session `exit(1)` → "Session ended", shell still accepts input. Covers SRS-FR-064,
  SRS-FR-083.

No new seam in Rust or in `TerminalPane`.

## Risks / Trade-offs

- [`client.close` fails after a normal exit] → the pane would stay as an ended pane with a toast; same handling as
  a failed Close today.
- [A long-running command in the Pane Shell is killed by `/exit` without asking] → accepted by the PO in CR-005;
  SRS-FR-083 says no confirmation.
