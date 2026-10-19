## 1. UI (seams S1, S2)

- [x] 1.1 RED then GREEN at S1: `TerminalPane` maps `focused` to `ring-2 ring-ring ring-offset-1 ring-offset-background`, idle border always `border-border` (SRS-FR-087)
- [x] 1.2 RED then GREEN at S2: in `App`, the outline follows a click into a pane, an Active Sessions jump, and stays on a maximized pane (SRS-FR-087)

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run build` and paste the output
- [ ] 2.2 Demo in the rebuilt app: three panes, one `Running`, one `Needs Approval`; click each → only that pane has the iris ring, status border still visible inside; ring not clipped at the grid edges or between panes; check light and dark; maximize → ring stays
  - 2026-10-20: the PO approved at GATE 3 without a separately reported demo; clipping or colour issues found in daily use go through `/dev-bug`.
