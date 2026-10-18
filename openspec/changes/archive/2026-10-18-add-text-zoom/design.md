## Context

`App` (`src/App.tsx`) takes its clients as props from `main.tsx` (`workspaces`, `sessions`, `createTerminal`,
`diag`), so tests pass fakes. Text in the UI is mostly Tailwind `rem` sizes (`text-xs`, `text-sm`), with a few
`text-[10px]`/`text-[11px]` and fixed px widths (sidebar 260 px). Terminals are xterm with its default font size,
opened by `xtermAdapter.ts`, which already intercepts some keys with `attachCustomKeyEventHandler`.
`TerminalPane` keeps a `refit` ref and calls it in an effect keyed on `maximized` (SRS-FR-043); `ShellArea` does
the same on `[visible, ratio, maximized]`. No app-wide keyboard shortcut exists. `latencyLog.ts` already keeps
an opt-in flag in `localStorage`. Tauri 2.12 exposes `getCurrentWebview().setZoom(scale)` behind the permission
`core:webview:allow-set-webview-zoom`. Approach A was chosen at GATE 1. No new UI, nothing in `design/agent-deck/`.

## Goals / Non-Goals

**Goals:**

- Zoom shortcut with 10% steps, 50%–200%, reset, on the whole window including terminals and dialogs
  (SRS-FR-068, SRS-FR-069, SRS-FR-070).
- Keep the Text Size across launches (SRS-FR-071).
- Refit every terminal after a change (SRS-FR-072).

**Non-Goals** (the SRS is silent or CR-004 rules it out; a wish here goes through `/ba-change`):

- A per-pane text size; a menu item or slider for the size (CR-004 out of scope).
- Showing the current percentage on screen.
- Reporting a failed zoom to the user: if `setZoom` rejects, the Text Size stays as it was and nothing is saved.
- Layout that keeps its px widths while text grows: the whole webview scales, as Cmd + does in VS Code.

## Decisions

**D1 — Zoom the webview, not the CSS.**
`ZoomClient { setZoom(scale: number): Promise<void> }` in `src/api/zoom.ts`; the Tauri implementation calls
`getCurrentWebview().setZoom(scale)`. One call scales every glyph, rem or px, terminal canvas or dialog, so
"every text in the window" holds without touching each component. Rejected at GATE 1: root `font-size` plus
xterm `fontSize` (px text and every terminal handled one by one) and Tauri's `zoomHotkeysEnabled` (its steps,
limits and lack of persistence do not match the SRS).

**D2 — Pure rules in `textZoom.ts`.**
- `zoomAction(e, mac)` → `"in" | "out" | "reset" | null`: the modifier is `metaKey` on macOS and `ctrlKey`
  elsewhere, the other modifier and `altKey` must be up; `e.key` `+` or `=` → `in`, `-` → `out`, `0` → `reset`.
- `nextTextSize(current, action)` → the new size, rounded to one decimal so ten steps never drift, clamped to
  `0.5`–`2`; `reset` → `1`.
- `storedTextSize(raw)` → the stored value if it parses to a number on the 0.1 grid inside the range, else `1`.

**D3 — `useTextZoom(client, mac)` in `App`.**
On mount it reads `localStorage["adTextSize"]` through `storedTextSize` and calls `setZoom` with it. It adds one
`keydown` listener on `document` in the capture phase; for an action it calls `preventDefault()` and
`stopPropagation()` — the capture listener runs before xterm's textarea, so the pane never sees the key — then,
if the size changes, awaits `setZoom(next)`, writes `localStorage`, and sets the state. At a limit the key is still
swallowed and nothing is called. `localStorage` access is wrapped in `try`, a failure leaves the default. The
hook returns the current size. `mac` comes from `navigator.userAgent` in `main.tsx`, passed as a prop next to the
clients, so tests choose the platform.

**D4 — Refit through a `textSize` prop.**
`App` passes the size to every `TerminalPane`, which passes it to `ShellArea`; both add it to the keys of their
existing refit effects (D4 of `add-pane-maximize`). The state is set only after `setZoom` resolves, so the refit
runs after the native zoom. The `ResizeObserver` also fires in the real app when the CSS size of a pane changes.

**D5 — Capability.**
`src-tauri/capabilities/default.json` gains `core:webview:allow-set-webview-zoom`; without it `setZoom` rejects.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 domain | `zoomAction(e, mac)`, `nextTextSize(current, action)`, `storedTextSize(raw)` | SRS-FR-068 Cmd +/= on macOS and Ctrl +/= elsewhere → `in`; Ctrl − on macOS → `null`; Cmd+Ctrl, Alt → `null`; 1 → 1.1 → 1.2, 2 stays 2; SRS-FR-069 1 → 0.9, 0.5 stays 0.5; ten steps from 1 land on exactly 2; SRS-FR-070 1.5 → 1; SRS-FR-071 stored "1.3" → 1.3, junk, "3", "0.55" → 1 | Vitest, plain objects |
| S2 UI | `App` with a fake `ZoomClient`, fake clients and adapters, `fireEvent.keyDown` | SRS-FR-068 Ctrl = twice → `setZoom(1.1)`, `setZoom(1.2)`, stored "1.2"; key fired on a pane is `defaultPrevented` and a listener on the pane never sees it; at 2 no call; SRS-FR-069 Ctrl − → `setZoom(0.9)`; SRS-FR-070 Ctrl 0 → `setZoom(1)`; SRS-FR-071 stored "1.3" before render → `setZoom(1.3)` on mount; rejected `setZoom` → nothing stored; SRS-FR-072 fake adapter sizes change → `sessions.resize` and the shell resize called with the new sizes after Ctrl = | Vitest + Testing Library |
| — real app | — | Cmd + / − / 0 on macOS scales sidebar, history, headers, terminals and dialogs; Ctrl − reaches Claude Code; size kept after quit and reopen; terminals redraw without broken lines | task 3.2 demo |

## Risks / Trade-offs

- [The layout scales with the text; at 200% the 1024 px minimum window is 512 CSS px wide] → panes get narrow
  but stay usable; the PO accepted whole-window zoom at GATE 1.
- [`localStorage` lives in the webview's data; dev (`localhost:1420`) and release (`tauri://localhost`) keep
  separate values] → acceptable for one user; the release build is the one used daily.
- [macOS menu or WKWebView taking Cmd + first] → the default Tauri menu has no zoom item; checked in the demo.
- [xterm WebGL renderer blurry after a zoom] → it redraws on a devicePixelRatio change; checked in the demo.

## Migration Plan

No stored data before this change; a missing value means 100%. Rollback = revert the change; the stored key
is then ignored.

## Open Questions

None.
