## ADDED Requirements

### Requirement: Select a session (SRS-FR-073)
Traces: SRS-FR-073 ← BR-08 ← BO-02

When the user ticks the checkbox of a row in the Session History Panel, the system SHALL add that session to the Session Selection.

#### Scenario: Tick two rows
- **GIVEN** the Session History Panel lists "Scaffold Tauri app" and "Fix login bug"
- **WHEN** the user ticks both rows
- **THEN** the Session Selection holds those 2 sessions

#### Scenario: Ticking opens nothing
- **GIVEN** no pane is open
- **WHEN** the user ticks a row
- **THEN** no pane opens

#### Scenario: Untick
- **GIVEN** two rows are ticked
- **WHEN** the user unticks one of them
- **THEN** the Session Selection holds only the other one

### Requirement: Delete selected action (SRS-FR-074)
Traces: SRS-FR-074 ← BR-08 ← BO-02

While the Session Selection is not empty, the system SHALL show the actions "Delete selected (<n>)" and "Select all" in the Session History Panel, where <n> is the number of selected sessions.

#### Scenario: Two ticked rows
- **GIVEN** two rows are ticked
- **THEN** the panel shows "Delete selected (2)" and "Select all"

#### Scenario: Nothing ticked
- **GIVEN** the user unticks every row
- **THEN** neither "Delete selected" nor "Select all" is shown

### Requirement: Select all sessions (SRS-FR-075)
Traces: SRS-FR-075 ← BR-08 ← BO-02

When the user chooses Select all, the system SHALL add every session listed in the Session History Panel to the Session Selection.

#### Scenario: Select all from one
- **GIVEN** the folder lists 5 sessions and 1 is ticked
- **WHEN** the user chooses Select all
- **THEN** the panel shows "Delete selected (5)"

### Requirement: Clear the selection (SRS-FR-076)
Traces: SRS-FR-076 ← BR-08 ← BO-02

When the Session History Panel switches to another workspace or closes, the system SHALL empty the Session Selection.

#### Scenario: Switch and come back
- **GIVEN** two sessions of `agent-deck` are ticked
- **WHEN** the user selects `mokairo` and then `agent-deck` again
- **THEN** no row is ticked

#### Scenario: Close and reopen
- **GIVEN** two sessions of `agent-deck` are ticked
- **WHEN** the user closes the Session History Panel and opens it again
- **THEN** no row is ticked

### Requirement: Confirm deleting selected sessions (SRS-FR-077)
Traces: SRS-FR-077 ← BR-08 ← BO-02

When the user chooses Delete selected, the system SHALL ask "Move <n> sessions to Trash?" before deleting.

#### Scenario: Nothing open
- **GIVEN** 3 sessions are selected and none is open in a pane
- **WHEN** the user chooses Delete selected
- **THEN** the dialog asks "Move 3 sessions to Trash?"

#### Scenario: One open
- **GIVEN** 3 sessions are selected and 1 of them is open in a pane
- **WHEN** the user chooses Delete selected
- **THEN** the dialog asks "Close 1 open sessions and move 3 sessions to Trash?"

#### Scenario: Cancel
- **GIVEN** the dialog for 3 selected sessions is shown
- **WHEN** the user chooses Cancel
- **THEN** no session is moved to the trash
- **AND** the 3 rows stay ticked

### Requirement: Delete selected sessions (SRS-FR-078)
Traces: SRS-FR-078 ← BR-08 ← BO-02

When the user confirms deleting the selected sessions, the system SHALL delete each selected session as in SRS-FR-047 and SRS-FR-049.

#### Scenario: Three sessions, one running
- **GIVEN** 3 sessions are selected and 1 of them is `Running` in pane 2
- **WHEN** the user confirms
- **THEN** pane 2 closes, all 3 sessions are moved to the trash and their rows disappear
- **AND** the Session Selection is empty

### Requirement: Report partial delete failure (SRS-FR-079)
Traces: SRS-FR-079 ← BR-08 ← BO-02

If some selected sessions cannot be moved to the trash, then the system SHALL keep those sessions in the Session History Panel and in the Session Selection and show the message "<k> of <n> sessions deleted".

#### Scenario: One of three locked
- **GIVEN** 3 sessions are selected and the file of 1 of them cannot be moved
- **WHEN** the user confirms
- **THEN** 2 rows disappear, the remaining row stays ticked
- **AND** the message "2 of 3 sessions deleted" is shown
