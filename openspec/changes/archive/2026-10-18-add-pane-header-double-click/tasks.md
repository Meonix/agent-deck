## 1. UI (seam S1)

- [x] 1.1 RED then GREEN for header double-click: `onDoubleClick` on the `TerminalPane` header calling the shared Maximize / Restore toggle, ignored on buttons, `select-none` on the header (SRS-FR-066, SRS-FR-067)

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run build` and paste the output
- [ ] 2.2 Demo in the app: double-click a pane header among three → maximized, double-click again → same sizes back; double-click the Shell button → only the shell toggles; double-click the Maximize button, Close on the left pane and Split right → no extra maximize or restore; double-click a word in the terminal → the word is selected, pane not maximized
  - 2026-10-18: the PO approved without the scripted demo and will check the header double-click in daily use; bugs found there go through `/dev-bug`.
