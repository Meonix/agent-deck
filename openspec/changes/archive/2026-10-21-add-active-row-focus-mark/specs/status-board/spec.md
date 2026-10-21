## ADDED Requirements

### Requirement: Focused session row mark (SRS-FR-099)
Traces: SRS-FR-099 ← BR-05 ← BO-01

While a pane has the Focus Outline, the system SHALL show the Row Focus Mark on the row of that pane's session in Active Sessions.

#### Scenario: Two idle panes
- **GIVEN** two panes are open and both sessions are `Idle`
- **WHEN** the user clicks into pane 2
- **THEN** the Active Sessions row of the session in pane 2 shows the Row Focus Mark
- **AND** the row of the session in pane 1 does not

#### Scenario: Focused running pane
- **GIVEN** the session in pane 1 is `Running`
- **WHEN** pane 1 has the Focus Outline
- **THEN** the row of that session shows the `Running` Status Highlight
- **AND** the Row Focus Mark around it

#### Scenario: Jump from Active Sessions
- **GIVEN** two panes are open and pane 2 has the Focus Outline
- **WHEN** the user clicks the Active Sessions row of the session in pane 1
- **THEN** the row of the session in pane 1 shows the Row Focus Mark
- **AND** the row of the session in pane 2 does not

#### Scenario: No pane focused
- **GIVEN** no pane has the Focus Outline
- **WHEN** Active Sessions lists sessions
- **THEN** no row shows the Row Focus Mark
