# workspace-list Specification

## Purpose
TBD - created by archiving change add-workspace-list. Update Purpose after archive.
## Requirements
### Requirement: Add workspace (SRS-FR-001)
Traces: SRS-FR-001 ← BR-01 ← BO-02

When the user selects a folder in the folder picker, the system SHALL add that folder to the Workspace List.

#### Scenario: Folder chosen in the picker is added
- **WHEN** the user opens the folder picker and chooses `/Users/mionix/Project/mokairo`
- **THEN** the Workspace List contains a new entry named `mokairo` for that path

#### Scenario: Picker cancelled
- **WHEN** the user opens the folder picker and presses Cancel
- **THEN** the Workspace List is unchanged

### Requirement: Persist workspace list (SRS-FR-002)
Traces: SRS-FR-002 ← BR-01 ← BO-02

The system SHALL keep the Workspace List across application restarts.

#### Scenario: List survives a restart in the same order
- **GIVEN** the Workspace List contains `mokairo` then `agent-deck`
- **WHEN** the user quits the application and opens it again
- **THEN** the Workspace List contains `mokairo` then `agent-deck`, in that order

### Requirement: Reject duplicate workspace (SRS-FR-003)
Traces: SRS-FR-003 ← BR-01 ← BO-02

If the user adds a folder that is already in the Workspace List, then the system SHALL select the existing entry without adding a second entry.

#### Scenario: Adding the same folder twice
- **GIVEN** the Workspace List already contains `/Users/mionix/Project/mokairo`
- **WHEN** the user adds `/Users/mionix/Project/mokairo` again
- **THEN** the Workspace List still has exactly one entry for that path
- **AND** that entry is the selected workspace

### Requirement: Remove workspace (SRS-FR-004)
Traces: SRS-FR-004 ← BR-01 ← BO-02

When the user removes a workspace, the system SHALL delete that workspace from the Workspace List without deleting any Claude Code session history of its folder.

#### Scenario: Removing a workspace keeps the folder and its history
- **GIVEN** the Workspace List contains `mokairo` and the folder `mokairo` has Claude Code session history on disk
- **WHEN** the user removes `mokairo`
- **THEN** `mokairo` is no longer in the Workspace List
- **AND** the folder and every Claude Code session history file of it are unchanged on disk

### Requirement: Mark missing workspace (SRS-FR-005)
Traces: SRS-FR-005 ← BR-01 ← BO-02

If the folder of a workspace no longer exists, then the system SHALL mark that workspace as `Missing` in the Workspace List.

#### Scenario: Folder renamed outside the app
- **GIVEN** the Workspace List contains `mokairo`
- **WHEN** the folder `mokairo` is renamed to `mokairo-old` outside the app and the app is opened
- **THEN** the entry `mokairo` shows the label `Missing`

### Requirement: Reject removing a workspace with open panes (SRS-FR-006)
Traces: SRS-FR-006 ← BR-01 ← BO-02

If the user removes a workspace that has an open pane, then the system SHALL reject the removal and show the message "Close the open sessions of this folder first".

#### Scenario: Workspace still has open panes
- **GIVEN** the workspace `mokairo` has 2 open panes
- **WHEN** the user chooses Remove on `mokairo`
- **THEN** `mokairo` stays in the Workspace List
- **AND** the message "Close the open sessions of this folder first" is shown

