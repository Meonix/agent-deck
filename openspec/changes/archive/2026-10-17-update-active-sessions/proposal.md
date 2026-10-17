## Why

CR-002 (`product/agent-deck/CHANGELOG.md`, approved 2026-10-17) splits the left column. Today one "Sessions" list
mixes the sessions that run now with the whole history of the selected folder, and a session that needs the user
in another folder only shows as a count on its folder row. The user wants the running sessions of every folder in
one place, "Active Sessions", and the history of a folder in its own column that opens when the folder is picked
(SRS v1.2, BR-06 ← BO-01, BR-02 ← BO-02). The two left sections get soft, distinct tints. Backlog item 12 (Should).

## What Changes

- **BREAKING (UI)**: the "Sessions" section leaves the left column. The left column holds Folders and
  Active Sessions, each with its own background tint (SRS-NFR-009).
- Active Sessions lists every session open in a pane across all folders, with its title and folder name
  (SRS-FR-051), most urgent first: `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, then earliest into that
  state (SRS-FR-052); "No active sessions" when nothing is open (SRS-FR-053).
- The Status Highlight and the "<time> · <reason>" line move from the history rows to the Active Sessions rows
  (SRS-FR-032, SRS-FR-033 text unchanged). Clicking or pressing Enter on any Active Sessions row focuses its pane,
  highlighted or not (SRS-FR-037).
- Selecting a folder opens the Session History Panel, a column between the left column and the panes, with the
  folder name, New Session, Close, and the folder's sessions with `Live`, Resume and Delete (SRS-FR-007 to
  SRS-FR-013, SRS-FR-019, SRS-FR-047, SRS-FR-048, SRS-FR-050, SRS-NFR-003). History rows carry no Status
  Highlight and do not jump.
- Close on the panel, or a click on the selected folder, hides the panel; the panes widen (SRS-FR-054).
- A maximized pane also covers Active Sessions and the Session History Panel (SRS-FR-041).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-history`: the session list becomes the Session History Panel; panel close added (SRS-FR-007 to
  SRS-FR-012, SRS-FR-019, SRS-FR-047, SRS-FR-048, SRS-FR-050, SRS-FR-054, SRS-NFR-003).
- `session-resume`: resume from the Session History Panel (SRS-FR-013).
- `status-board`: row highlight and jump move to Active Sessions; Active Sessions list, order, empty state and
  section tints added (SRS-FR-032, SRS-FR-037, SRS-FR-051 to SRS-FR-053, SRS-NFR-009).
- `pane-layout`: the maximized pane also covers Active Sessions and the Session History Panel (SRS-FR-041).

## Impact

- UI: `WorkspaceSidebar.tsx` keeps Folders and gains Active Sessions; the history list moves to a new
  `SessionHistoryPanel.tsx`; `App.tsx` grid gets a third column while the panel is open; `useWorkspaces` gets a
  panel open flag; a pure `activeSessions(entries)` orders the rows. Tests that look for the old "Sessions" list
  are moved to the new lists.
- Design: `design/agent-deck/brief.md` › "Đã chốt cho CR-002"; tokens `--section-folders` and `--section-active`
  already sit in `design/agent-deck/tokens.css`, which the app imports.
- Rust, stored data and latency records: unchanged. No new dependency.
