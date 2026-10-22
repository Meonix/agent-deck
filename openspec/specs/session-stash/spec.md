# session-stash Specification

## Purpose
TBD - created by archiving change add-session-stash. Update Purpose after archive.
## Requirements
### Requirement: Stash button (SRS-FR-103)
Traces: SRS-FR-103 ← BR-03 ← BO-02

The system SHALL show a Stash button in the header of every pane immediately to the left of the Maximize button.

#### Scenario: Button order
- **GIVEN** a pane "agent-deck · Fix login bug" is open
- **WHEN** the user looks at its header
- **THEN** the buttons read Stash, Maximize, × in that order

#### Scenario: New session without history
- **GIVEN** a pane opened with New Session and no prompt sent yet
- **WHEN** the user clicks its Stash button
- **THEN** the button is disabled and nothing happens

### Requirement: Stash a pane (SRS-FR-104)
Traces: SRS-FR-104 ← BR-03 ← BO-02

When the user chooses Stash on a pane that is not busy, the system SHALL close that pane and add its session to Stashed Sessions.

#### Scenario: Stash an idle pane
- **GIVEN** the pane of "Fix login bug" in `mokairo` is `Idle` and its shell runs no command
- **WHEN** the user chooses Stash on it
- **THEN** the pane closes without the Close Dialog
- **AND** Stashed Sessions has the row "Fix login bug · mokairo"

#### Scenario: History is kept
- **GIVEN** the user stashed "Fix login bug"
- **WHEN** the user opens the Session History Panel of `mokairo`
- **THEN** "Fix login bug" is still listed

### Requirement: Confirm stashing a busy pane (SRS-FR-105)
Traces: SRS-FR-105 ← BR-03 ← BO-02

If the user chooses Stash on a pane whose session is `Running` or `Needs Approval` or whose Pane Shell is running a command, then the system SHALL show the Stash Dialog for that pane before stashing it.

#### Scenario: Stash a running pane
- **GIVEN** the session "Fix login bug" is `Running`
- **WHEN** the user chooses Stash on its pane
- **THEN** the Stash Dialog "Stash "Fix login bug"?" shows the line "Session is still running."
- **AND** choosing Stash closes the pane and adds the session to Stashed Sessions

#### Scenario: Cancel
- **GIVEN** the Stash Dialog is shown for a `Running` pane
- **WHEN** the user chooses Cancel
- **THEN** the pane stays open and Stashed Sessions is unchanged

### Requirement: List stashed sessions (SRS-FR-106)
Traces: SRS-FR-106 ← BR-03 ← BO-02

The system SHALL list in Stashed Sessions every stashed session across all workspaces, with its title and its workspace name, most recently stashed first.

#### Scenario: Newest first
- **GIVEN** the user stashed "Fix login bug" in `mokairo` at 14:00 and "Scaffold Tauri app" in `agent-deck` at 14:10
- **WHEN** Stashed Sessions lists them
- **THEN** the first row is "Scaffold Tauri app · agent-deck" and the second "Fix login bug · mokairo"

#### Scenario: Never stashed
- **GIVEN** a session that was never stashed
- **WHEN** Stashed Sessions lists sessions
- **THEN** that session is not in it

### Requirement: Empty stashed sessions (SRS-FR-107)
Traces: SRS-FR-107 ← BR-03 ← BO-02

While no session is stashed, the system SHALL show the message "No stashed sessions" in Stashed Sessions.

#### Scenario: Nothing stashed
- **GIVEN** no session was stashed
- **WHEN** the application starts
- **THEN** Stashed Sessions shows "No stashed sessions"

### Requirement: Reopen a stashed session (SRS-FR-108)
Traces: SRS-FR-108 ← BR-03 ← BO-02

When the user chooses a row in Stashed Sessions, the system SHALL resume that session in a new pane.

#### Scenario: Reopen
- **GIVEN** "Fix login bug · mokairo" is in Stashed Sessions
- **WHEN** the user clicks that row
- **THEN** a new pane resumes "Fix login bug" in `mokairo`

#### Scenario: Missing workspace
- **GIVEN** `mokairo` is `Missing` and "Fix login bug · mokairo" is in Stashed Sessions
- **WHEN** the user clicks that row
- **THEN** no pane opens, the message "Folder not found" shows
- **AND** the row stays in Stashed Sessions

### Requirement: Unstash on open (SRS-FR-109)
Traces: SRS-FR-109 ← BR-03 ← BO-02

When a stashed session opens in a pane, the system SHALL remove that session from Stashed Sessions.

#### Scenario: Opened from the row
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user clicks its row and the pane opens
- **THEN** the row is no longer in Stashed Sessions

#### Scenario: Opened from history
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user resumes it from the Session History Panel
- **THEN** the row is no longer in Stashed Sessions

### Requirement: Remove from stash (SRS-FR-110)
Traces: SRS-FR-110 ← BR-03 ← BO-02

When the user chooses × on a row in Stashed Sessions, the system SHALL remove that session from Stashed Sessions without changing its history.

#### Scenario: Remove a row
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user chooses × on its row
- **THEN** the row is gone, no pane opens
- **AND** "Fix login bug" is still in the Session History Panel

### Requirement: Keep stash across launches (SRS-FR-111)
Traces: SRS-FR-111 ← BR-03 ← BO-02

The system SHALL keep Stashed Sessions and their order between application launches.

#### Scenario: Relaunch
- **GIVEN** two sessions are stashed
- **WHEN** the user quits and starts the application again
- **THEN** Stashed Sessions shows the same two rows in the same order

### Requirement: Drop stashed sessions without history (SRS-FR-112)
Traces: SRS-FR-112 ← BR-03 ← BO-02

If the history of a stashed session no longer exists, then the system SHALL remove that session from Stashed Sessions.

#### Scenario: Deleted in the app
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user deletes it from the Session History Panel
- **THEN** its row is gone from Stashed Sessions

#### Scenario: Deleted outside the app
- **GIVEN** "Fix login bug" is stashed and its history file was moved to the trash outside the app
- **WHEN** the application starts
- **THEN** its row is not in Stashed Sessions

### Requirement: Stashed Sessions tint (SRS-NFR-010)
Traces: SRS-NFR-010 ← BR-03 ← BO-02

The system SHALL give the Stashed Sessions section a background tint different from the Workspace List and Active Sessions tints, with a contrast ratio of at most 1.25:1 against the sidebar background and a text contrast of at least 4.5:1, in both light and dark themes.

#### Scenario: Measured tint
- **GIVEN** the `--section-stash` token in light and dark
- **WHEN** its contrast is measured against `--card`, and `--foreground` and `--muted-foreground` against it
- **THEN** the background ratio is at most 1.25:1 and both text ratios are at least 4.5:1
- **AND** the colour differs from `--section-folders` and `--section-active`

