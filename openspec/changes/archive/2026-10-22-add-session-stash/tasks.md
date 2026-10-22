## 1. List logic (seam S1)

- [x] 1.1 RED then GREEN at S1: `stash.ts` with `addStashed`, `removeStashed`, `pruneStashed`, `readStash`, `writeStash` (SRS-FR-106, SRS-FR-110, SRS-FR-111, SRS-FR-112)

## 2. Tint (seam S3)

- [x] 2.1 Add `--section-stash` light and dark to `design/agent-deck/tokens.css` and `section.stash` to `tailwind.preset.js`; compute the WCAG ratios with a script and write them in the token comment (SRS-NFR-010)

## 3. UI (seam S2)

- [x] 3.1 RED then GREEN: Stashed Sessions section in `WorkspaceSidebar` with rows, empty text and ×, fed by `useStash` in `App`; rows read from `localStorage` at launch (SRS-FR-106, SRS-FR-107, SRS-FR-110, SRS-FR-111)
- [x] 3.2 RED then GREEN: Stash button in `TerminalPane` before Maximize, disabled without history; stash flow in `App` with the Stash Dialog for busy panes (SRS-FR-103, SRS-FR-104, SRS-FR-105)
- [x] 3.3 RED then GREEN: reopen from a row, `Missing` keeps the row, unstash on any open (SRS-FR-108, SRS-FR-109)
- [x] 3.4 RED then GREEN: drop rows on in-app delete and on the launch listing (SRS-FR-112)

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run build` and paste the output; `openspec validate add-session-stash --strict`
- [ ] 4.2 Rebuild the release `.app`; demo: stash an idle and a running pane, reopen one, remove one, relaunch; check light and dark
  - 2026-10-22: the `.app` was rebuilt; the PO approved at GATE 3 without a demo; look issues found in daily use go through `/dev-bug`.
