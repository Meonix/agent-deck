## MODIFIED Requirements

### Requirement: Resume a session (SRS-FR-013)
When the user chooses a session row in the Session Chooser, the system SHALL close the Session Chooser and open a new pane that continues that session in its workspace folder.

Traces: SRS-FR-013 ← BR-03 ← BO-02

There is no separate Resume button: a click on the row, or Enter on it, resumes. The checkbox and the trash icon of the row do not resume.

#### Scenario: Resume "Scaffold Tauri app"
- **GIVEN** the Session Chooser of `agent-deck` lists the session "Scaffold Tauri app", which is not open in any pane
- **WHEN** the user clicks that row
- **THEN** the Session Chooser closes
- **AND** a new pane opens running that session in `/Users/mionix/Project/personal/agent-deck` with its earlier conversation shown and keyboard focus in it
- **AND** typing "tiếp tục" in the pane gets a Claude Code reply in the context of that conversation

#### Scenario: Three actions from launch
- **GIVEN** the app has just started and `agent-deck` is in the Folder Tree
- **WHEN** the user chooses + on `agent-deck` and then the row "Scaffold Tauri app"
- **THEN** the pane of "Scaffold Tauri app" is open and focused after 2 actions (BO-02)

#### Scenario: The resumed session keeps its identity
- **GIVEN** the user resumed the session "Scaffold Tauri app"
- **WHEN** the user opens the Session Chooser of `agent-deck` again
- **THEN** its row carries the chip "Đang mở"
- **AND** no second row for it appears in the Session Chooser
- **AND** it appears once as a Session Row under `agent-deck` in the Folder Tree

### Requirement: Focus an already open session (SRS-FR-015)
If the user resumes a session that is already open in a pane, then the system SHALL focus the existing pane without opening a second pane.

Traces: SRS-FR-015 ← BR-03 ← BO-02

#### Scenario: Resume a session open in pane 2
- **GIVEN** "Scaffold Tauri app" is open in pane 2 of 3 panes
- **WHEN** the user clicks its "Đang mở" row in the Session Chooser
- **THEN** the Session Chooser closes and pane 2 has keyboard focus
- **AND** there are still 3 panes

### Requirement: Reject resuming in a missing workspace (SRS-FR-016)
If the user resumes a session of a `Missing` workspace, then the system SHALL reject the request and show the message "Folder not found".

Traces: SRS-FR-016 ← BR-03 ← BO-02

#### Scenario: Folder renamed after the list was shown
- **GIVEN** the Session Chooser of `mokairo` lists its sessions
- **AND** the folder `mokairo` has since been renamed, so the workspace is `Missing`
- **WHEN** the user clicks one of its session rows
- **THEN** no pane opens
- **AND** the message "Không tìm thấy folder" is shown
