## MODIFIED Requirements

### Requirement: Maximize pane (SRS-FR-041)
Traces: SRS-FR-041 ← BR-05 ← BO-01

When the user chooses Maximize on a pane, the system SHALL show that pane over the whole application window below the title bar, covering the Workspace List, Active Sessions, the Session History Panel and the other panes.

#### Scenario: Maximize one of three panes
- **GIVEN** three panes are open and pane 2 is one of them
- **WHEN** the user chooses Maximize on pane 2
- **THEN** only pane 2 is visible below the title bar
- **AND** panes 1 and 3 keep running and keep their size

#### Scenario: Covered controls cannot be reached
- **GIVEN** the Session History Panel is open and pane 2 is maximized
- **WHEN** the user presses Tab
- **THEN** keyboard focus never reaches the Workspace List, Active Sessions, the Session History Panel or another pane
