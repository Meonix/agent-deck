## Context

Panes today sit in one row: `PaneGrid` is a CSS grid with `repeat(n, 1fr)` columns, `insertRight` puts a new
pane after the focused one in a flat order, and `measureOpenSize` sizes a new session as one of `n + 1` equal
columns (`paneBodySize`). `TerminalPane` keeps its xterm across re-renders and re-attaches it when its container
changes (`xtermAdapter.open`), but a remount of the component re-runs its open/focus effect.

UI source of truth: `design/agent-deck/stories/render.js` — pane header "workspace · title", status chip, then
"⇥ ⇣ ✕"; panes separated by the 8 px grid gap. The PO chose at GATE 1 that ⇥ / ⇣ in a pane header open a new
session in that pane's folder, beside or below it; sidebar New Session and Resume keep splitting the focused
pane to the right (SRS-FR-021). Approach A (own split tree, no library) was chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- Split right or down from any pane; drag any divider; close any pane (SRS-FR-021, SRS-FR-022, SRS-FR-023).
- 4 panes at once with echo ≤ 100 ms p95 (SRS-NFR-001 with SRS-NFR-002).

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- Keeping the layout across app restarts; moving panes by drag and drop; keyboard shortcuts for splitting or
  resizing; equalising pane sizes.
- Choosing Split Down for Resume or for the sidebar New Session — they split right (PO decision at GATE 1).

## Decisions

**D1 — A pure split tree.**
`paneTree.ts`: `Layout = { pane: string } | { split: "right" | "down"; ratio: number; first: Layout; second: Layout }`.
`splitPane(layout | null, targetId | null, newId, dir)` replaces the target leaf with a split whose `first` is the
target and `second` the new pane, ratio 0.5; no layout → the new pane alone; target null or unknown → the last
pane in order is split (today's behaviour when nothing is focused). `removePane(layout, id)` replaces the
removed leaf's parent with its sibling. `setRatio(layout, splitPath, ratio)` changes one split. `paneOrder`
lists panes depth-first (left/top first) — the "last pane" above. `entries` keep their insertion order, so the
Status Board does not change.

**D2 — Flat, absolutely positioned panes from computed rectangles.**
`layoutRects(layout)` returns, in fractions of the pane area, one rectangle per pane and one per divider (with
its split path and direction). `PaneGrid` renders every `TerminalPane` as a keyed child of one container,
positioned by its rectangle and inset by half the 8 px gap; dividers are 8 px strips on the boundaries. Panes
never change parent when the tree changes shape, so no pane remounts and no xterm is re-attached on a split or
close. Rejected: nested flex containers (a split moves a pane under a new parent and remounts it).

**D3 — Dragging a divider.**
A divider is a `role="separator"` element with `aria-orientation`, `cursor: col-resize` / `row-resize`. Pointer
down captures the pointer; each move sets the split's ratio from the pointer position within that split's box,
clamped so neither side gets below 200 px wide or 120 px tall (about 20 columns / 5 rows of terminal). Each pane
already refits on resize (`ResizeObserver` → `fit` → `pane_resize`, SRS-FR-024), so sessions reflow while
dragging.

**D4 — Opening a pane.**
`useSessionPanes` keeps `layout` beside `entries`. `newSession(workspace)` and `resume(...)` split the focused
pane to the right; new `splitFrom(paneId, dir)` opens a new session in that pane's workspace (looked up by id; a
`Missing` or removed workspace → "Folder not found", nothing opens) split from that pane. All three go through
the one open path from item 6 (`opening` guard, focus on the new pane, SRS-FR-014). The new session's size is
half of the split pane's current terminal box along the split direction (the pane's body is measured by its
`data-pane-id`); the first pane gets the whole area. `paneBodySize(area, columns)` is replaced by this.

**D5 — Header buttons.**
`TerminalPane` gets `onSplit(paneId, "right" | "down")` and two buttons before ✕: "Split right" (⇥) and "Split
down" (⇣), `aria-label`ed, same style as ✕. Ended or not-started panes keep them: the new session needs only the
folder.

**D6 — Closing.**
`closePane` removes the pane from the tree; its sibling takes the space. Focus behaviour is unchanged (no pane
focused after closing the focused one).

**D7 — Proving SRS-NFR-001.**
Backend: a Rust test opens 4 `PtySession`s that each write output continuously (`sh` loop printing a line every
10 ms); one of them also runs `cat`, and 200 single-byte writes to it are timed until echoed, p95 < 100 ms, as the
existing `echo_round_trip_p95_is_under_100ms`. Rendering cost of 4 xterms is not covered by a unit test: the
demo (task 3.2) runs 4 real Claude Code sessions busy at once in the `.app` with the existing `adLatency` log.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 `paneTree` (TS, pure) | `splitPane`, `removePane`, `setRatio`, `paneOrder`, `layoutRects` | SRS-FR-021 (right of the target, half its width), SRS-FR-022 (below, half its height; in a column of panes), SRS-FR-023 geometry (ratio → rectangles), close gives space to the sibling | Vitest |
| S2 UI (React) | `App` with fake clients | SRS-FR-022 (⇣ → `open` with that pane's folder, new pane below and focused; ⇥ → right), SRS-FR-023 (drag a divider +200 px in a 1200 px area → 800/400; clamp at the minimum), sidebar New Session still splits right, Missing folder → "Folder not found" | Vitest + Testing Library, `getBoundingClientRect` stubbed |
| S3 Rust | 4 `PtySession`s | SRS-NFR-001 backend share (echo p95 < 100 ms with 4 busy sessions) | `cargo test` |
| — real app | — | SRS-FR-023 reflow while dragging; SRS-NFR-001 with 4 real Claude Code sessions and rendering (`adLatency` p95) | task 3.2 demo |

## Risks / Trade-offs

- [Absolute layout] → panes no longer flow; the area's size must be known — the container fills `main`, and
  rectangles are percentages, so a window resize needs no recomputation.
- [Many nested splits] → panes can get very small; dividers stop at the minimum, and opening more panes than fit
  is not prevented (SRS sets no maximum).
- [Rendering cost] → 4 busy xterms are only measured in the demo; if p95 fails there, the fix (e.g. throttling
  writes per frame) is a follow-up, not hidden in this change.

## Open Questions

None.
