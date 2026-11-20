## Why

BR-06 of the agent-deck BRD (v5.1, CR-013): the user sees which sessions run, need approval or failed "on the
folder list, the list of open sessions and the summary at the top of the window". Today the only signals sit in the
Sidebar rows and on the maximized pane's badge, so with the Sidebar hidden or many rows the count of sessions waiting
on the user is not visible at a glance. Serves BO-01 (no session waiting for approval or in error goes unnoticed,
signal within 3 seconds); the Go-to button serves BR-07 (jump straight from a status signal to its pane). Backlog
item 29 (Should). The approved One UI design (`design/agent-deck/oneui/`) ships with this item.

## What Changes

- A Status Summary at the top of the window, above the Sidebar and the Pane Grid (SRS-FR-132 to SRS-FR-135):
  "<N> need you" while sessions are `Needs Approval` or `Error`, "All clear" while sessions are open and none needs
  the user, "Agent Deck" / "No sessions running" while no session is open; the count of `Needs Approval`, `Error`
  and `Running` sessions next to it.
- A Go-to button "Go to <title>" that moves keyboard focus to the pane of the most urgent session (SRS-FR-136).
- The Status Summary collapses to one line while keyboard focus is in a pane or the window is narrower than
  1100 px (SRS-FR-137, SRS-FR-138), and hides while a pane is maximized (SRS-FR-139).
- It updates within 3 seconds of a state change (SRS-FR-140).
- The main window takes the One UI look of the approved design: a grey canvas with rounded cards and gaps for the
  Sidebar, the Session History Panel and each pane; grouped Sidebar lists with a round status mark leading each row;
  pane-header titles in Inter; One UI confirm dialogs and toast. Colours and status signals keep their tokens.
- The "Fonts work offline" requirement changes: pane-header text renders in Inter, not JetBrains Mono.

## Success Criteria

- SC-1: With 2 sessions `Needs Approval` and 1 `Error`, the Status Summary reads "3 need you" within 3 seconds of
  the last change.
- SC-2: With 3 `Running` sessions and nothing else, it reads "All clear" and "3 running"; with no pane open it reads
  "Agent Deck" and "No sessions running".
- SC-3: Clicking "Go to <title>" puts keyboard focus in the pane of the `Error` session when one exists, else the
  earliest `Needs Approval` one.
- SC-4: Clicking into a pane leaves the Status Summary one line high (≤ 48 px); maximizing a pane removes it.
- SC-5: The main window screenshot at 1280×800 matches the layout of `design/agent-deck/oneui/design.html#final`
  in dark and light: rounded cards on the canvas, round status marks in Sidebar rows, the existing 2 px Needs
  Approval / Error borders and Focus Outline unchanged.

## Capabilities

### New Capabilities

- `status-summary`: the Status Summary at the top of the window, its headline, counts, Go-to button, collapsed and
  hidden states, and its update latency (SRS-FR-132 to SRS-FR-140).

### Modified Capabilities

- `app-theme`: "Fonts work offline" — pane-header text moves from JetBrains Mono to Inter; terminal text stays in
  JetBrains Mono. The other app-theme requirements (attention borders, dimming, icon names, terminal colours,
  readable sidebar labels) are kept unchanged.

Reused unchanged: Status Highlight and urgency order (SRS-FR-032, SRS-FR-040, SRS-FR-052), the maximized badge and
its jump rule (SRS-FR-044, SRS-FR-045), Active Sessions jump (SRS-FR-037), the pinned "+ Add Folder" bar
(workspace-list), pane dividers (pane-layout, pane-shell).

## Impact

- UI: `statusHighlight.ts` gains the summary computation; new `StatusSummary.tsx` and a hook deciding expanded /
  collapsed / hidden; `App.tsx` places the Status Summary above the Workbench; the title bar row folds into it, its Status Latency
  button kept at the right end (SRS-FR-039 unchanged).
- Look: `index.css` loads `design/agent-deck/oneui/tokens-oneui.css`; `App.tsx`, `PaneGrid.tsx`,
  `WorkspaceSidebar.tsx`, `SessionHistoryPanel.tsx`, `TerminalPane.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`,
  `statusTone.tsx` change classes only, plus a round status mark component.
- No backend, data or Tauri change.
