## Why

BR-05 of the agent-deck BRD (v2.5, CR-006): the user works with several Claude Code sessions in one window and
wants the panes to take the room of the left column when it is not needed. Today the Sidebar (Workspace List and
Active Sessions) always takes 260px. Serves BO-01: wider panes keep Claude Code's prompts and approval questions
readable with four panes side by side. Backlog item 21 (Should), after items 1 and 12 which built the Sidebar.

## What Changes

- A Sidebar Toggle at the vertical centre of the Sidebar's right edge (window's left edge while the Sidebar is
  hidden) hides or shows the Sidebar (SRS-FR-088).
- The Sidebar shortcut, Cmd+B on macOS and Ctrl+B on Windows, does the same, also while a pane has focus; the pane
  never receives the key and keeps focus (SRS-FR-089).
- The application always starts with the Sidebar shown; the hidden state is not stored (SRS-FR-090).
- Hiding gives the 260px to the next column (Session History Panel if open, else the pane area); terminals refit.

## Capabilities

### New Capabilities

- `sidebar-toggle`: hide and show the Sidebar by button and shortcut, shown at launch (SRS-FR-088, SRS-FR-089,
  SRS-FR-090).

### Modified Capabilities

None.

## Impact

- UI: new `src/components/sidebarToggle.ts` (pure shortcut match) and `useSidebarToggle.ts` (state + capture
  key listener); `App`/`Workbench` drops the 260px grid column and adds `hidden` to `WorkspaceSidebar` while
  hidden, and renders the toggle button.
- No change to `useSessionPanes`, `PaneGrid`, `TerminalPane`, Rust, dependencies, tokens or stored settings.
