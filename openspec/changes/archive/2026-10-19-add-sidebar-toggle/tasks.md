## 1. Shortcut (seam S1)

- [x] 1.1 RED then GREEN at S1: `sidebarShortcut(e, mac)` in `src/components/sidebarToggle.ts` (SRS-FR-089)

## 2. UI (seam S2)

- [x] 2.1 RED then GREEN at S2: `useSidebarToggle(mac)`, `hidden` on `WorkspaceSidebar`, grid columns and the Sidebar Toggle button in `Workbench`; button, shortcut with a focused pane, shown at launch (SRS-FR-088, SRS-FR-089, SRS-FR-090)

## 3. Verification

- [x] 3.1 Run `npm test`, `npm run build` and paste the output
- [ ] 3.2 Demo in the rebuilt app: toggle at the vertical centre of the edge; hide/show with the button and with Cmd+B while typing in Claude Code; panes refit; history panel open → it moves left; quit hidden, reopen → shown
  - 2026-10-20: the PO approved at GATE 3 without a separately reported demo; issues found in daily use go through `/dev-bug`.
