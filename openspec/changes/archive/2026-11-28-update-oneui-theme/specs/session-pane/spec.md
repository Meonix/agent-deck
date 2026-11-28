## MODIFIED Requirements

### Requirement: Pane header (SRS-FR-030)
The system SHALL show the workspace name, the session title and the View Switch in the header of each pane.

Traces: SRS-FR-030 ← BR-05 ← BO-01

The header reads, left to right: the 28px round status icon, "<workspace> · <title>", the state chip, the View Switch "Chat · Term · Shell · Plan", then the buttons Để dành, Phóng to (Thu về on the Maximized Pane) and ×. When the pane is narrower than 560px the View Switch moves to a second header line, so the title is never squeezed out.

#### Scenario: Named session
- **WHEN** a pane runs the session titled "Scaffold Tauri app" in workspace `agent-deck`
- **THEN** the pane header reads "agent-deck · Scaffold Tauri app" with the View Switch "Chat · Term · Shell · Plan"

#### Scenario: New session not yet named
- **WHEN** a pane runs a new session that Claude Code has not titled and that has no prompt yet
- **THEN** the pane header reads "agent-deck · (untitled)" per RULE-01

#### Scenario: Order of the header controls
- **GIVEN** a pane "agent-deck · Fix login bug" that is not maximized
- **WHEN** the user looks at its header
- **THEN** after the title and the state chip it shows the View Switch, then Để dành, Phóng to and × in that order

#### Scenario: Narrow pane
- **GIVEN** a pane 420px wide running "agent-deck · Fix login bug"
- **WHEN** the user looks at its header
- **THEN** the first line shows the icon, "agent-deck · Fix login bug" (shortened with … if needed), the state chip, Để dành, Phóng to and ×
- **AND** the second line shows the View Switch
