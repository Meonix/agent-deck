## Why

OpenSpec 1.5.0 reads the first line under `### Requirement:` as the requirement text. Most main specs put
`Traces: …` on that line, so `openspec validate --specs --strict` fails 14 of 16 specs and `openspec archive` aborts
whenever it rebuilds one of them (it did for `remove-session-progress`, archived with `--no-validate`). This blocks
backlog items 32 and 33.

## What Changes

- In 12 specs, move each `Traces:` line from right under the requirement heading to right after the requirement
  statement. Statements, traces and scenarios keep their exact wording. 112 requirements.
- Not touched: `session-goal` and `status-latency` (all their requirements are removed by items 32 and 33),
  `app-theme` and `diagnostics` (no `Traces:` lines; they already pass).

## Success Criteria

- SC-1 `openspec archive fix-spec-traces-order -y` runs with validation and writes the specs.
- SC-2 After archive, `openspec validate <spec> --type spec --strict` passes for each of the 12 specs.
- SC-3 Apart from the moved `Traces:` lines, the 12 main specs are unchanged (`git diff` shows only those moves).

## Capabilities

### New Capabilities

### Modified Capabilities

- `app-shell`, `pane-layout`, `pane-restore`, `pane-shell`, `session-history`, `session-pane`, `session-resume`,
  `session-stash`, `sidebar-toggle`, `status-board`, `text-zoom`, `workspace-list`: line order only, no behaviour
  change.

## Impact

- `openspec/specs/` only. No code, no SRS change (the SRS-ID and `Traces:` content are unchanged).
