# sidebar-toggle Specification

## Purpose
TBD - created by archiving change add-sidebar-toggle. Update Purpose after archive.
## Requirements
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

### Requirement: Toggle sidebar by shortcut (SRS-FR-089)
When the user presses the Sidebar shortcut, the system SHALL hide the Sidebar if it is shown and show it if it is hidden.

Traces: SRS-FR-089 ← BR-05 ← BO-01

#### Scenario: Cmd+B while typing in a pane on macOS
- **GIVEN** the Sidebar is shown and pane 1 has keyboard focus on macOS
- **WHEN** the user presses Cmd+B
- **THEN** the Sidebar is hidden
- **AND** pane 1 receives no key and still has keyboard focus

#### Scenario: Ctrl+B on macOS
- **GIVEN** pane 1 has keyboard focus on macOS
- **WHEN** the user presses Ctrl+B
- **THEN** the Sidebar does not change

#### Scenario: Ctrl+H
- **GIVEN** pane 1 has keyboard focus
- **WHEN** the user presses Ctrl+H
- **THEN** the Sidebar does not change

### Requirement: Sidebar shown at launch (SRS-FR-090)
When the application starts, the system SHALL show the Sidebar.

Traces: SRS-FR-090 ← BR-05 ← BO-01

#### Scenario: Hidden before quitting
- **GIVEN** the user hid the Sidebar and quit the application
- **WHEN** the application starts again
- **THEN** the Sidebar is shown

