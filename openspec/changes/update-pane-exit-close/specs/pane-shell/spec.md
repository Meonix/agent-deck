## MODIFIED Requirements

### Requirement: Shell outlives the session (SRS-FR-064)
Traces: SRS-FR-064 ← BR-05 ← BO-01

While the session in a pane has exited abnormally, the system SHALL keep that pane's Pane Shell running.

#### Scenario: Crash leaves the shell running
- **GIVEN** a pane whose Pane Shell runs `npm run dev`
- **WHEN** the Claude Code process of that pane is killed
- **THEN** the pane shows "Session ended"
- **AND** the Pane Shell still runs and accepts input

#### Scenario: /exit ends the shell with the pane
- **GIVEN** a pane whose Pane Shell runs `npm run dev`
- **WHEN** the user types `/exit` in Claude Code
- **THEN** the pane closes and its Pane Shell process has ended (SRS-FR-083)
