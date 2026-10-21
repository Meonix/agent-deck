## 1. UI (seam S1)

- [x] 1.1 RED then GREEN at S1: `App` passes `focusedPaneId` to `WorkspaceSidebar`; `ActiveRow` adds `ring-2 ring-inset ring-ring` and `aria-current="true"` to the focused pane's row, in every state, over the Status Highlight (SRS-FR-099)

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run build` and paste the output
- [ ] 2.2 Demo in the rebuilt app: two panes, one `Idle`, one `Running`; click each → only its row has the iris ring, `Running` fill still visible; check light and dark
  - 2026-10-21: the PO approved at GATE 3 without a demo; look issues found in daily use go through `/dev-bug`.
