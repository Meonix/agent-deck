## MODIFIED Requirements

### Requirement: Close pane ends its session (SRS-FR-029)
Traces: SRS-FR-029 ← BR-05 ← BO-01

When the user closes a pane, the system SHALL end the Claude Code session running in that pane.

#### Scenario: Closing an idle pane
- **GIVEN** a pane whose Claude Code session is idle
- **WHEN** the user presses the pane's close button and chooses Close
- **THEN** the pane disappears
- **AND** the Claude Code process of that pane and its child processes have ended

#### Scenario: Close keeps the history
- **GIVEN** the session "Fix login bug" is open in a pane
- **WHEN** the user presses the pane's close button and chooses Close
- **THEN** "Fix login bug" is still listed in the Session History Panel

## ADDED Requirements

### Requirement: Warn about a busy pane in the Close Dialog (SRS-FR-027)
Traces: SRS-FR-027 ← BR-05 ← BO-01

If the user chooses × on a pane whose session is `Running` or `Needs Approval`, then the system SHALL show the warning "Session is still running." in the Close Dialog.

#### Scenario: Cancel keeps the pane
- **GIVEN** a pane is `Running`
- **WHEN** the user presses the pane's close button
- **THEN** the Close Dialog shows the line "Session is still running."
- **AND** choosing Cancel keeps the pane and its session running

#### Scenario: Close ends the busy session
- **GIVEN** a pane is `Needs Approval` and the Close Dialog shows "Session is still running."
- **WHEN** the user chooses Close
- **THEN** the pane closes and its session ends

#### Scenario: Idle pane has no warning
- **GIVEN** a pane is `Idle`
- **WHEN** the user presses the pane's close button
- **THEN** the Close Dialog is shown without the line "Session is still running."


### Requirement: Close Dialog on pane close (SRS-FR-100)
Traces: SRS-FR-100 ← BR-05 ← BO-01

When the user chooses × on a pane header, the system SHALL show the Close Dialog for that pane before closing it.

#### Scenario: Idle pane asks
- **GIVEN** the pane of "Fix login bug" is `Idle` and its Pane Shell, if any, waits at its prompt
- **WHEN** the user presses the pane's close button
- **THEN** the dialog `Close "Fix login bug"?` is shown with the buttons Cancel, Close and Close and move to Trash
- **AND** the pane is still open

#### Scenario: Cancel changes nothing
- **GIVEN** the Close Dialog of a pane is shown
- **WHEN** the user chooses Cancel or presses Escape
- **THEN** the dialog closes and the pane and its session keep running

#### Scenario: Ended pane asks
- **GIVEN** a pane shows "Session ended"
- **WHEN** the user presses the pane's close button
- **THEN** the Close Dialog is shown

#### Scenario: Session without history cannot be trashed
- **GIVEN** a new session in a pane has no prompt yet and is shown as "(untitled)"
- **WHEN** the user presses the pane's close button
- **THEN** the Close Dialog shows Cancel and Close but not Close and move to Trash

#### Scenario: /exit does not ask
- **WHEN** the user types `/exit` in a pane
- **THEN** the pane closes with no Close Dialog (SRS-FR-083)
- **AND** the session is still listed in the Session History Panel

## REMOVED Requirements

### Requirement: Confirm closing a busy pane (SRS-FR-027)
**Reason**: CR-009 drops the separate confirmation and its "Idle pane closes at once" scenario; the warning moves into the Close Dialog.
**Migration**: replaced by "Warn about a busy pane in the Close Dialog (SRS-FR-027)" under ADDED.
