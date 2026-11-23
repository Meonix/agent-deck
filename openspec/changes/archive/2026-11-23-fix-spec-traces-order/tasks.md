# Tasks

## 1. Reorder Traces lines

- [x] 1.1 Generate the MODIFIED deltas for the 12 specs (design D1). Verify: `openspec validate fix-spec-traces-order --strict` passes.
- [x] 1.2 Archive with validation (SC-1); then `openspec validate <spec> --type spec --strict` for each of the 12 specs (SC-2); `git diff -U0 -- openspec/specs` shows only `Traces:` lines moving (SC-3).
