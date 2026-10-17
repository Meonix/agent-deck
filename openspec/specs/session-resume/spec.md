# session-resume Specification

## Purpose
TBD - created by archiving change add-session-resume. Update Purpose after archive.
## Requirements
### Requirement: Resume a session (SRS-FR-013)
Traces: SRS-FR-013 ← BR-03 ← BO-02

When the user resumes a session from the Session History Panel, the system SHALL open a new pane that continues that session in its workspace folder.

#### Scenario: Resume "Scaffold Tauri app"
- **GIVEN** the Session History Panel of `agent-deck` lists the session "Scaffold Tauri app", which is not open in any pane
- **WHEN** the user selects that session and chooses "Resume"
- **THEN** a new pane opens running that session in `/Users/mionix/Project/personal/agent-deck` with its earlier conversation shown
- **AND** typing "tiếp tục" in the pane gets a Claude Code reply in the context of that conversation

#### Scenario: The resumed session keeps its identity
- **GIVEN** the user resumed the session "Scaffold Tauri app"
- **THEN** its row in the Session History Panel is marked `Live`
- **AND** no second row for it appears in the Session History Panel
- **AND** it appears once in Active Sessions

### Requirement: Focus an already open session (SRS-FR-015)
Traces: SRS-FR-015 ← BR-03 ← BO-02

If the user resumes a session that is already open in a pane, then the system SHALL focus the existing pane without opening a second pane.

#### Scenario: Resume a session open in pane 2
- **GIVEN** "Scaffold Tauri app" is open in pane 2 of 3 panes
- **WHEN** the user selects that session and chooses "Resume"
- **THEN** pane 2 has keyboard focus
- **AND** there are still 3 panes

### Requirement: Reject resuming in a missing workspace (SRS-FR-016)
Traces: SRS-FR-016 ← BR-03 ← BO-02

If the user resumes a session of a `Missing` workspace, then the system SHALL reject the request and show the message "Folder not found".

#### Scenario: Folder renamed after the list was shown
- **GIVEN** the session list of `mokairo` is on screen
- **AND** the folder `mokairo` has since been renamed, so the workspace is `Missing`
- **WHEN** the user chooses "Resume" on one of its sessions
- **THEN** no pane opens
- **AND** the message "Folder not found" is shown

