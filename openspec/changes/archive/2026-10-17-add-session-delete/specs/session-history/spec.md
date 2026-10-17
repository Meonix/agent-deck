## MODIFIED Requirements

### Requirement: Read-only session history (SRS-NFR-005)
Traces: SRS-NFR-005 ← BRD §8 constraint

The system SHALL NOT modify any Claude Code session history on the machine other than moving a session the user deletes to the operating system's trash.

#### Scenario: Listing leaves files untouched
- **GIVEN** the session files of a workspace
- **WHEN** the user selects the workspace and its list is read
- **THEN** every session file has the same content and modification time as before

#### Scenario: Only the deleted session moves
- **GIVEN** a workspace with the sessions "Scaffold Tauri app" and "Init repo"
- **WHEN** the user deletes "Scaffold Tauri app"
- **THEN** only the files of "Scaffold Tauri app" are moved to the trash
- **AND** the files of "Init repo" have the same content and modification time as before

## ADDED Requirements

### Requirement: Delete a session (SRS-FR-047)
Traces: SRS-FR-047 ← BR-08 ← BO-02

When the user confirms deleting a session, the system SHALL move that session's history to the operating system's trash and remove the session from the session list.

#### Scenario: Session goes to the Trash
- **GIVEN** the session "Scaffold Tauri app" in the selected folder
- **WHEN** the user deletes it and confirms
- **THEN** its session file and its session folder are in the Trash
- **AND** its row is gone from the session list

#### Scenario: Restored from the Trash
- **GIVEN** the files of a deleted session were put back from the Trash
- **WHEN** the user selects the folder again
- **THEN** the session is in the list again

#### Scenario: Only a session of that folder
- **GIVEN** a session id that does not belong to the selected folder
- **WHEN** a delete is requested for it
- **THEN** no file is moved

### Requirement: Confirm deleting a session (SRS-FR-048)
Traces: SRS-FR-048 ← BR-08 ← BO-02

When the user chooses Delete on a session row, the system SHALL ask "Move "<title>" to Trash?" before deleting.

#### Scenario: Ask first
- **GIVEN** the row "Scaffold Tauri app" is picked
- **WHEN** the user chooses Delete
- **THEN** a dialog asks "Move "Scaffold Tauri app" to Trash?"

#### Scenario: Cancel keeps the session
- **GIVEN** the delete dialog for "Scaffold Tauri app" is open
- **WHEN** the user chooses Cancel
- **THEN** the session is still in the list and no file is moved

### Requirement: Delete an open session (SRS-FR-049)
Traces: SRS-FR-049 ← BR-08 ← BO-02

If the user confirms deleting a session that is open in a pane, then the system SHALL end that session and close its pane before moving its history to the trash.

#### Scenario: Running session in pane 2
- **GIVEN** "Research PTY crates" is `Running` in pane 2
- **WHEN** the user chooses Delete on its row
- **THEN** the dialog asks "Close "Research PTY crates" and move it to Trash?"
- **WHEN** the user confirms
- **THEN** pane 2 closes and its session ends before its files are moved to the trash

### Requirement: Report delete failure (SRS-FR-050)
Traces: SRS-FR-050 ← BR-08 ← BO-02

If a session's history cannot be moved to the trash, then the system SHALL keep that session in the session list and show the message "Session could not be deleted".

#### Scenario: File cannot be moved
- **GIVEN** the session file of "Scaffold Tauri app" cannot be moved
- **WHEN** the user deletes it and confirms
- **THEN** "Scaffold Tauri app" is still in the list
- **AND** the message "Session could not be deleted" shows
