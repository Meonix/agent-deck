## Why

BR-05 of the agent-deck BRD (v2.5, CR-006): the user works with several Claude Code sessions in one window and
must see at a glance which pane takes the next keystroke. Today the focused pane only gets the faint `--ring`
border while it is idle; a `Running`, `Needs Approval` or `Error` pane wears its status colour instead, so the
focused one cannot be told apart. Serves BO-01 (no missed session waiting for approval or failing): the user
answers in the right pane. Backlog item 20 (Should).

## What Changes

- The focused pane gets the Focus Outline: a 2px iris ring outside its border, with a 1px gap (SRS-FR-087).
- The status border (`Running`, `Needs Approval` 2px, `Error`) stays inside, unchanged; only one pane has the
  outline at a time, the Maximized Pane included.
- The old idle-only `border-ring` on the focused pane goes away; an idle pane always uses `border-border`, the
  outline carries focus.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pane-layout`: adds the Focus Outline on the focused pane (SRS-FR-087).

## Impact

- UI: `TerminalPane` maps `focused` to `ring-2 ring-ring ring-offset-1 ring-offset-background` on its `<section>`
  and drops `border-ring` from the idle border.
- No change to `useSessionPanes`, `PaneGrid`, `App`, Rust, dependencies, tokens or `design/`.
