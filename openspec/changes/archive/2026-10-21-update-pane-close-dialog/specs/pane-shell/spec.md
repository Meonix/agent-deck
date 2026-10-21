## ADDED Requirements

### Requirement: Warn about a busy shell in the Close Dialog (SRS-FR-063)
Traces: SRS-FR-063 ← BR-05 ← BO-01

If the user chooses × on a pane whose Pane Shell is running a command, then the system SHALL show the warning "A command is still running in the shell." in the Close Dialog.

#### Scenario: Busy hidden shell warns
- **GIVEN** the session is `Idle` and the hidden Pane Shell runs `npm run dev`
- **WHEN** the user presses the pane's close button
- **THEN** the Close Dialog shows the line "A command is still running in the shell."
- **AND** choosing Cancel keeps the pane and the shell running

#### Scenario: Shell at its prompt has no warning
- **GIVEN** the session is `Idle` and the Pane Shell waits at its prompt
- **WHEN** the user presses the pane's close button
- **THEN** the Close Dialog is shown without the line "A command is still running in the shell."

#### Scenario: Busy session and busy shell share one dialog
- **GIVEN** the session is `Running` and the Pane Shell runs `npm run dev`
- **WHEN** the user presses the pane's close button
- **THEN** exactly one dialog appears
- **AND** it shows both "Session is still running." and "A command is still running in the shell."

## REMOVED Requirements

### Requirement: Confirm closing a pane with a busy shell (SRS-FR-063)
**Reason**: CR-009 drops the separate confirmation and its "Shell at its prompt does not ask" scenario; the warning moves into the Close Dialog.
**Migration**: replaced by "Warn about a busy shell in the Close Dialog (SRS-FR-063)" under ADDED.
