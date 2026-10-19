## ADDED Requirements

### Requirement: Focused pane outline (SRS-FR-087)
Traces: SRS-FR-087 ← BR-05 ← BO-01

While a pane has keyboard focus, the system SHALL show the Focus Outline around that pane.

#### Scenario: Click into one of three panes
- **GIVEN** three panes are open
- **WHEN** the user clicks into pane 2
- **THEN** pane 2 shows the Focus Outline
- **AND** pane 1 and pane 3 do not

#### Scenario: Focused pane waiting for approval
- **GIVEN** pane 2 is in the state `Needs Approval`
- **WHEN** pane 2 has keyboard focus
- **THEN** pane 2 shows its 2px `Needs Approval` border
- **AND** the Focus Outline outside that border

#### Scenario: Jump from Active Sessions
- **GIVEN** two panes are open and pane 2 has keyboard focus
- **WHEN** the user clicks the Active Sessions row of the session in pane 1
- **THEN** pane 1 shows the Focus Outline
- **AND** pane 2 does not

#### Scenario: Maximized pane
- **GIVEN** pane 1 has keyboard focus
- **WHEN** the user maximizes pane 1
- **THEN** pane 1 still shows the Focus Outline
