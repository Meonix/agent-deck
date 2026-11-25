## MODIFIED Requirements

### Requirement: Stash a pane (SRS-FR-104)
When the user chooses Stash on a pane that is not busy, the system SHALL close that pane and add its session to Stashed Sessions.

Traces: SRS-FR-104 ← BR-03 ← BO-02

#### Scenario: Stash an idle pane
- **GIVEN** the pane of "Fix login bug" in `mokairo` is `Idle` and its shell runs no command
- **WHEN** the user chooses Stash on it
- **THEN** the pane closes without the Close Dialog
- **AND** Stashed Sessions has the row "Fix login bug · mokairo"

#### Scenario: History is kept
- **GIVEN** the user stashed "Fix login bug"
- **WHEN** the user opens the Session Chooser of `mokairo`
- **THEN** "Fix login bug" is still listed

### Requirement: Unstash on open (SRS-FR-109)
When a stashed session opens in a pane, the system SHALL remove that session from Stashed Sessions.

Traces: SRS-FR-109 ← BR-03 ← BO-02

#### Scenario: Opened from the row
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user clicks its row and the pane opens
- **THEN** the row is no longer in Stashed Sessions

#### Scenario: Opened from the Session Chooser
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user clicks the row "Fix login bug" in the Session Chooser of `mokairo`
- **THEN** a pane opens and the row is no longer in Stashed Sessions

### Requirement: Remove from stash (SRS-FR-110)
When the user chooses × on a row in Stashed Sessions, the system SHALL remove that session from Stashed Sessions without changing its history.

Traces: SRS-FR-110 ← BR-03 ← BO-02

The × shows while the row is hovered or has keyboard focus; there is no confirmation and no pane opens.

#### Scenario: Remove a row
- **GIVEN** "Fix login bug · mokairo" and one other row are in the "Để dành (2)" group
- **WHEN** the user chooses × on "Fix login bug"
- **THEN** the row is gone, the group reads "Để dành (1)" and no pane opens
- **AND** "Fix login bug" is still in the Session Chooser of `mokairo`

#### Scenario: × on demand
- **GIVEN** "Fix login bug" is in the "Để dành" group
- **WHEN** the pointer is not over its row and nothing in the row has focus
- **THEN** its × is not visible
- **AND** tabbing from the row to its × shows the ×

### Requirement: Drop stashed sessions without history (SRS-FR-112)
If the history of a stashed session no longer exists, then the system SHALL remove that session from Stashed Sessions.

Traces: SRS-FR-112 ← BR-03 ← BO-02

#### Scenario: Deleted in the app
- **GIVEN** "Fix login bug" is in Stashed Sessions
- **WHEN** the user deletes it from the Session Chooser of `mokairo`
- **THEN** its row is gone from Stashed Sessions

#### Scenario: Deleted outside the app
- **GIVEN** "Fix login bug" is stashed and its history file was moved to the trash outside the app
- **WHEN** the application starts
- **THEN** its row is not in Stashed Sessions
