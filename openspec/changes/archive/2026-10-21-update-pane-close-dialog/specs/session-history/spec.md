## ADDED Requirements

### Requirement: Close and move to Trash (SRS-FR-101)
Traces: SRS-FR-101 ← BR-08 ← BO-02

When the user chooses Close and move to Trash in the Close Dialog, the system SHALL close that pane and then move that session's history to the operating system's trash.

#### Scenario: Idle session trashed on close
- **GIVEN** the session "Fix login bug" is `Idle` in a pane
- **WHEN** the user presses the pane's close button and chooses Close and move to Trash
- **THEN** the pane disappears and its session has ended
- **AND** "Fix login bug" is no longer listed in the Session History Panel and its history is in the trash
- **AND** no "Move … to Trash?" dialog was shown

#### Scenario: Running session trashed on close
- **GIVEN** a pane is `Running` and its Close Dialog shows "Session is still running."
- **WHEN** the user chooses Close and move to Trash
- **THEN** the session ends, the pane closes and the history is moved to the trash

### Requirement: Report delete failure after close (SRS-FR-102)
Traces: SRS-FR-102 ← BR-08 ← BO-02

If the history of a session closed with Close and move to Trash cannot be moved to the trash, then the system SHALL keep that session in the Session History Panel and show the message "Session could not be deleted".

#### Scenario: Locked history file
- **GIVEN** the history of the session in a pane cannot be moved to the trash
- **WHEN** the user chooses Close and move to Trash in its Close Dialog
- **THEN** the pane is closed
- **AND** the session is still listed in the Session History Panel and "Session could not be deleted" is shown
