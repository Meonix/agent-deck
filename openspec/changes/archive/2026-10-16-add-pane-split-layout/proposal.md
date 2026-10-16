## Why

BO-01 of the agent-deck BRD (v1.0): miss no session that needs approval or failed, while several Claude
Code sessions run at once. BR-05 asks that the user works with several sessions in one window, "chia ô
ngang và dọc", using each pane like a normal terminal. Item 2 shipped panes that only split to the right in
equal columns; this item adds splitting down, resizing by dragging the divider, and proves 4 panes at once.
Backlog item 7.

## What Changes

- Panes form a split layout: each split divides one pane into two, side by side or one above the other.
- Every pane header gets ⇥ and ⇣ (design `render.js` header "⇥ ⇣ ✕"): ⇥ opens a new session in the same
  folder to the right of that pane, ⇣ opens it below. The new pane takes half of the split pane and gets
  focus.
- New Session and Resume in the sidebar keep splitting the focused pane to the right (SRS-FR-021); the new
  pane now takes half of the focused pane instead of an equal column.
- The divider between two panes can be dragged; both panes follow it and their sessions reflow
  (SRS-FR-024).
- Closing a pane gives its space to the pane it was split from (its sibling).
- At least 4 panes run at once with keystroke echo still within 100 ms p95.

## Capabilities

### New Capabilities

- `pane-layout`: splitting down, resizing panes by dragging the divider, and 4 concurrent panes within the
  input latency target (SRS-FR-022, SRS-FR-023, SRS-NFR-001).

### Modified Capabilities

None at requirement level. SRS-FR-021 (split right) keeps its wording; it now splits only the focused pane.

## Impact

- UI: a pure split-tree module, a recursive `PaneGrid` with draggable dividers, ⇥ ⇣ buttons in
  `TerminalPane`'s header, `useSessionPanes` placing panes in the tree and sizing a new session from the pane
  it splits.
- Rust: a test that runs 4 busy PTY sessions and measures echo latency on one of them.
- No new dependency. The layout is not kept across app restarts. Windows 11 not verified (PO deferral of
  2026-10-16 still in force).
