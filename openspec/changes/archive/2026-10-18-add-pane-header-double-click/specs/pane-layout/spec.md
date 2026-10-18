## ADDED Requirements

### Requirement: Maximize on header double-click (SRS-FR-066)
Traces: SRS-FR-066 ← BR-05 ← BO-01

When the user double-clicks the header of a pane that is not maximized, the system SHALL maximize that pane as in SRS-FR-041.

#### Scenario: Double-click the header of one of three panes
- **GIVEN** three panes are open and none is maximized
- **WHEN** the user double-clicks the header of pane 2
- **THEN** only pane 2 is visible below the title bar, as after choosing Maximize on pane 2

#### Scenario: Double-click inside the terminal
- **GIVEN** a pane that is not maximized
- **WHEN** the user double-clicks a word inside its terminal
- **THEN** the pane is not maximized

#### Scenario: Double-click a header button
- **GIVEN** a pane that is not maximized
- **WHEN** the user double-clicks its Shell button
- **THEN** the pane is not maximized

### Requirement: Restore on header double-click (SRS-FR-067)
Traces: SRS-FR-067 ← BR-05 ← BO-01

When the user double-clicks the header of the Maximized Pane, the system SHALL restore the previous layout as in SRS-FR-042.

#### Scenario: Double-click twice gives the layout back
- **GIVEN** two panes split 30/70 and none is maximized
- **WHEN** the user double-clicks the header of the left pane
- **AND** double-clicks the same header again
- **THEN** the two panes are split 30/70 again and nothing is maximized
