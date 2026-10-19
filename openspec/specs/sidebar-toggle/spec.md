# sidebar-toggle Specification

## Purpose
TBD - created by archiving change add-sidebar-toggle. Update Purpose after archive.
## Requirements
### Requirement: Toggle sidebar by button (SRS-FR-088)
Traces: SRS-FR-088 ← BR-05 ← BO-01

When the user clicks the Sidebar Toggle, the system SHALL hide the Sidebar if it is shown and show it if it is hidden.

#### Scenario: Hide the sidebar
- **GIVEN** the Sidebar is shown and two panes are open side by side
- **WHEN** the user clicks the Sidebar Toggle
- **THEN** the Sidebar is hidden and the panes take its width
- **AND** the Sidebar Toggle sits at the left edge of the window

#### Scenario: Show it again
- **GIVEN** the Sidebar was hidden while folder "agent-deck" was selected
- **WHEN** the user clicks the Sidebar Toggle
- **THEN** the Sidebar is shown again
- **AND** "agent-deck" is still selected

### Requirement: Toggle sidebar by shortcut (SRS-FR-089)
Traces: SRS-FR-089 ← BR-05 ← BO-01

When the user presses the Sidebar shortcut, the system SHALL hide the Sidebar if it is shown and show it if it is hidden.

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
Traces: SRS-FR-090 ← BR-05 ← BO-01

When the application starts, the system SHALL show the Sidebar.

#### Scenario: Hidden before quitting
- **GIVEN** the user hid the Sidebar and quit the application
- **WHEN** the application starts again
- **THEN** the Sidebar is shown

