# Tasks

## 1. Foundations

- [x] 1.1 Add `--selection` (iris-5 light/dark) to design/agent-deck/tokens.css with its measured contrast
- [x] 1.2 Install `lucide-react`, `@fontsource-variable/inter`, `@fontsource/jetbrains-mono`; import the fonts in src/main.tsx
- [x] 1.3 xterm: read `--selection` and the 16 `--ansi-*` tokens; lock test in xtermAdapter.test.ts extended to cover them

## 2. Panes

- [x] 2.1 TerminalPane: flush grid with 1px dividers in PaneGrid, header in mono, Lucide icons for Track / Stash / Maximize / Restore / Close with names unchanged
- [x] 2.2 TerminalPane: Needs Approval glow, Error 2px border, dimming of panes that are not focused, maximized, Needs Approval or Error — tests for each scenario in specs/app-theme
- [x] 2.3 Target Box uses `text-goal`; update the assertion that pinned `text-red-500`
- [x] 2.4 PaneShell chip and ShellFailure, PaneProgress ▸/▾ to Lucide; ✓ and ● stay text

## 3. Sidebar, history, dialogs

- [x] 3.1 WorkspaceSidebar: `// Section` mono titles, 4px rows, hover states, Lucide folder / archive / remove icons, glowing status markers
- [x] 3.2 SessionHistoryPanel: mono header, Lucide close / play / trash icons on buttons, hover states
- [x] 3.3 ConfirmDialog, StatusLatencyReport, Toast, SidebarToggle, top bar, CenteredState: token colours (`text-error-solid`, overlay), Lucide icons, hover + transition

## 4. Verify

- [x] 4.1 Full test suite green; `npm run build` passes
- [x] 4.2 Re-measure contrast of every new pair with the WCAG script and compare with tokens.css comments
- [x] 4.3 Rebuild the release .app and compare each region with design.html#overhaul in dark and light
