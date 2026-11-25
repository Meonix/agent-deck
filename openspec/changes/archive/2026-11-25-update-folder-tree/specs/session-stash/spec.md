## MODIFIED Requirements

### Requirement: List stashed sessions (SRS-FR-106)
The system SHALL list every stashed session in the group "Để dành (<n>)" at the end of the Folder Tree, with its title and its workspace name, most recently stashed first.

Traces: SRS-FR-106 ← BR-03 ← BO-02

#### Scenario: Newest first, at the end of the tree
- **GIVEN** the user stashed "Fix login bug" in `mokairo` at 14:00 and "Scaffold Tauri app" in `agent-deck` at 14:10
- **WHEN** the Folder Tree is shown
- **THEN** its last group is "Để dành (2)"
- **AND** its first row is "Scaffold Tauri app · agent-deck" and its second "Fix login bug · mokairo"

#### Scenario: After Folder khác
- **GIVEN** `notes` has no open pane and one session is stashed
- **WHEN** the Folder Tree is shown
- **THEN** "Để dành (1)" comes after "Folder khác (1)" and before "Thêm folder"

#### Scenario: Never stashed
- **GIVEN** a session that was never stashed
- **WHEN** the "Để dành" group lists sessions
- **THEN** that session is not in it

### Requirement: Empty stashed sessions (SRS-FR-107)
While no session is stashed, the system SHALL hide the "Để dành" group.

Traces: SRS-FR-107 ← BR-03 ← BO-02

#### Scenario: Nothing stashed
- **GIVEN** no session was stashed
- **WHEN** the application starts
- **THEN** the Folder Tree has no "Để dành" group and no "Chưa để dành phiên nào" message

#### Scenario: Last row removed
- **GIVEN** the group reads "Để dành (1)"
- **WHEN** the user removes its only row with ×
- **THEN** the "Để dành" group is gone from the Folder Tree

### Requirement: Remove from stash (SRS-FR-110)
When the user chooses × on a row in Stashed Sessions, the system SHALL remove that session from Stashed Sessions without changing its history.

Traces: SRS-FR-110 ← BR-03 ← BO-02

The × shows while the row is hovered or has keyboard focus; there is no confirmation and no pane opens.

#### Scenario: Remove a row
- **GIVEN** "Fix login bug · mokairo" and one other row are in the "Để dành (2)" group
- **WHEN** the user chooses × on "Fix login bug"
- **THEN** the row is gone, the group reads "Để dành (1)" and no pane opens
- **AND** "Fix login bug" is still in the Session History Panel of `mokairo`

#### Scenario: × on demand
- **GIVEN** "Fix login bug" is in the "Để dành" group
- **WHEN** the pointer is not over its row and nothing in the row has focus
- **THEN** its × is not visible
- **AND** tabbing from the row to its × shows the ×
