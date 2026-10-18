## Why

BR-05 of the agent-deck BRD (v2.3, CR-004): the user works with several Claude Code sessions in one window and
can make the text of the whole window larger or smaller with a keyboard shortcut. Four panes side by side leave
small terminals; on another screen the default size is too large. Backlog item 15 (Should), after items 2 and 13
which built the session terminal and the Pane Shell.

## What Changes

- The Zoom shortcut — Cmd on macOS, Ctrl on Windows, with `+`/`=` (enlarge), `−` (shrink) or `0` (reset) — changes
  the Text Size of the whole window by 10 percentage points between 50% and 200%, or back to 100%
  (SRS-FR-068, SRS-FR-069, SRS-FR-070). It works while a pane has focus, and the pane does not receive the key.
- The Text Size is kept between launches (SRS-FR-071).
- After a change, every session terminal and Pane Shell fits its content to its pane at the new size (SRS-FR-072).

## Capabilities

### New Capabilities

- `text-zoom`: Text Size of the whole window through the Zoom shortcut, its limits, reset, persistence and the
  terminal refit (SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071, SRS-FR-072).

### Modified Capabilities

None.

## Impact

- UI: new `textZoom.ts` (shortcut, steps, stored value), a `useTextZoom` hook used by `App`; `TerminalPane` and
  `ShellArea` refit when the Text Size changes.
- API: new `ZoomClient` in `src/api/zoom.ts` over Tauri's `getCurrentWebview().setZoom()`; `main.tsx` passes it to
  `App`.
- Tauri: capability `default` gains `core:webview:allow-set-webview-zoom`. No Rust code, no new dependency, no
  new token, no change in `design/`.
