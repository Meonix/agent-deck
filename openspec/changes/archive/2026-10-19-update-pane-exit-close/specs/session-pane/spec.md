## MODIFIED Requirements

### Requirement: Show session ended (SRS-FR-028)
Traces: SRS-FR-028 ← BR-05 ← BO-01

When the session in a pane exits abnormally, the system SHALL show the message "Session ended" in that pane.

#### Scenario: Claude Code is killed
- **WHEN** the Claude Code process of a pane exits with a non-zero code or from a signal
- **THEN** the pane shows "Session ended"
- **AND** the earlier pane content can still be scrolled and read

#### Scenario: User exits Claude Code
- **WHEN** the user types `/exit` in a pane
- **THEN** the pane closes (SRS-FR-083) and no "Session ended" is shown

## ADDED Requirements

### Requirement: Close pane on normal exit (SRS-FR-083)
Traces: SRS-FR-083 ← BR-05 ← BO-01

When the session in a pane exits normally, the system SHALL close that pane and give its space to the remaining panes.

#### Scenario: /exit in the middle pane
- **GIVEN** three panes side by side
- **WHEN** the user types `/exit` in pane 2
- **THEN** pane 2 disappears without a confirmation
- **AND** pane 1 and pane 3 share the freed space
- **AND** the row of that session leaves Active Sessions

#### Scenario: /exit in the only pane
- **GIVEN** one pane
- **WHEN** the user types `/exit` in it
- **THEN** the pane area is empty as before any session was opened

#### Scenario: /exit in the maximized pane
- **GIVEN** pane 1 is maximized over panes 1 and 2
- **WHEN** the user types `/exit` in pane 1
- **THEN** pane 1 closes and pane 2 is shown in the layout
