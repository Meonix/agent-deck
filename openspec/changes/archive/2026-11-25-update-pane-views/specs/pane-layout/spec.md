## MODIFIED Requirements

### Requirement: Maximize on header double-click (SRS-FR-066)
When the user double-clicks the header of a pane that is not maximized, the system SHALL maximize that pane as in SRS-FR-041.

Traces: SRS-FR-066 ← BR-05 ← BO-01

#### Scenario: Double-click the header of one of three panes
- **GIVEN** three panes are open and none is maximized
- **WHEN** the user double-clicks the header of pane 2
- **THEN** only pane 2 is visible below the title bar, as after choosing Maximize on pane 2

#### Scenario: Double-click inside the terminal
- **GIVEN** a pane that is not maximized
- **WHEN** the user double-clicks a word inside its terminal
- **THEN** the word is selected and the pane is not maximized

#### Scenario: Double-click a header button
- **GIVEN** a pane that is not maximized and shows Term
- **WHEN** the user double-clicks the Shell item of its View Switch, or its Để dành, Phóng to or × button
- **THEN** only that control does its own action (for the Shell item: the pane shows Shell) and the header double-click does not maximize the pane

### Requirement: Show drop zones (SRS-FR-080)
While the user drags the header of a pane over another pane, the system SHALL show the Drop Zones of that other pane.

Traces: SRS-FR-080 ← BR-05 ← BO-01

#### Scenario: Drag pane 1 over pane 2
- **GIVEN** panes 1 and 2 side by side
- **WHEN** the user drags the header of pane 1 over the lower part of pane 2
- **THEN** pane 2 shows its Drop Zones with the bottom zone lit

#### Scenario: Only one pane
- **GIVEN** one pane
- **WHEN** the user drags its header
- **THEN** no Drop Zone is shown

#### Scenario: Press on a header button
- **WHEN** the user presses an item of the View Switch, Để dành, Phóng to or × on a header and moves the pointer over another pane
- **THEN** no drag starts and no Drop Zone is shown
