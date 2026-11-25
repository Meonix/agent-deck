## MODIFIED Requirements

### Requirement: Toggle sidebar by button (SRS-FR-088)
When the user clicks the Sidebar Toggle, the system SHALL hide the Sidebar if it is shown and show it if it is hidden.

Traces: SRS-FR-088 ← BR-05 ← BO-01

The Sidebar hides completely; the pane area takes its width and the terminals fit again (SRS-FR-024); sessions, panes and Pane Shells do not change.

#### Scenario: Hide the sidebar
- **GIVEN** the Sidebar is shown and two panes are open side by side
- **WHEN** the user clicks the Sidebar Toggle
- **THEN** the Sidebar is hidden and the panes take its width
- **AND** the Sidebar Toggle sits at the left edge of the window

#### Scenario: Show it again
- **GIVEN** the Sidebar was hidden while the workspace `agent-deck` was folded in the Folder Tree
- **WHEN** the user clicks the Sidebar Toggle
- **THEN** the Sidebar is shown again as before
- **AND** `agent-deck` is still folded
