## MODIFIED Requirements

### Requirement: Start a new session (SRS-FR-018)
When the user chooses Phiên mới in the Session Chooser, the system SHALL close the Session Chooser and open a new pane that runs a new Claude Code session in that workspace folder.

Traces: SRS-FR-018 ← BR-04 ← BO-02

"Phiên mới" is the primary button at the top of the Session Chooser and holds keyboard focus when the chooser opens. The empty pane area has no "Phiên mới" button.

#### Scenario: New session in agent-deck
- **GIVEN** the workspace `agent-deck` is at `/Users/mionix/Project/personal/agent-deck`
- **WHEN** the user chooses + on the row `agent-deck` and then "Phiên mới"
- **THEN** the Session Chooser closes
- **AND** a new pane opens running Claude Code with working folder `/Users/mionix/Project/personal/agent-deck` and keyboard focus in it

#### Scenario: Enter right after opening
- **GIVEN** the user just chose + on the row `agent-deck`
- **WHEN** the user presses Enter
- **THEN** a new session starts in `agent-deck` as with a click on "Phiên mới"

### Requirement: Reject a new session in a missing workspace (SRS-FR-020)
If the user starts a new session in a `Missing` workspace, then the system SHALL reject the request and show the message "Folder not found".

Traces: SRS-FR-020 ← BR-04 ← BO-02

#### Scenario: Missing workspace
- **GIVEN** the workspace `mokairo` is `Missing`
- **WHEN** the user chooses + on the row `mokairo` and then "Phiên mới"
- **THEN** no pane opens
- **AND** the message "Không tìm thấy folder" is shown

### Requirement: Close pane ends its session (SRS-FR-029)
When the user closes a pane, the system SHALL end the Claude Code session running in that pane.

Traces: SRS-FR-029 ← BR-05 ← BO-01

#### Scenario: Closing an idle pane
- **GIVEN** a pane whose Claude Code session is idle
- **WHEN** the user presses the pane's close button and chooses Close
- **THEN** the pane disappears
- **AND** the Claude Code process of that pane and its child processes have ended

#### Scenario: Close keeps the history
- **GIVEN** the session "Fix login bug" is open in a pane
- **WHEN** the user presses the pane's close button and chooses Close
- **THEN** "Fix login bug" is still listed in the Session Chooser of its workspace, without the chip "Đang mở"

### Requirement: Close Dialog on pane close (SRS-FR-100)
When the user chooses × on a pane header, the system SHALL show the Close Dialog for that pane before closing it.

Traces: SRS-FR-100 ← BR-05 ← BO-01

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
- **AND** the session is still listed in the Session Chooser of its workspace
