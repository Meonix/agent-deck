## MODIFIED Requirements

### Requirement: Pin first prompt as session goal (SRS-FR-091)
Traces: SRS-FR-091 ← BR-09 ← BO-03

When the user sends a prompt in a pane whose session has no stored Session Goal, the system SHALL set that prompt as the Session Goal.

#### Scenario: First prompt of a new pane
- **GIVEN** a new pane whose session has no Session Goal
- **WHEN** the user sends "Sửa lỗi resume mất scrollback"
- **THEN** the Session Goal is "Sửa lỗi resume mất scrollback"

#### Scenario: Later prompt does not change the goal
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback"
- **WHEN** the user sends "chạy test"
- **THEN** the Session Goal is still "Sửa lỗi resume mất scrollback"

#### Scenario: New session after /clear
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback" and the user runs `/clear`
- **WHEN** the user sends "Thêm nút export CSV"
- **THEN** the Session Goal of the new session is "Thêm nút export CSV"

#### Scenario: Skill command as first prompt
- **GIVEN** a new pane whose session has no Session Goal
- **WHEN** the user sends "/dev-bug lỗi X"
- **THEN** the Session Goal is "/dev-bug lỗi X"

#### Scenario: Multi-line first prompt
- **GIVEN** a new pane whose session has no Session Goal
- **WHEN** the user sends a prompt of three lines
- **THEN** the Session Goal is that prompt with its three lines

#### Scenario: Target typed before the first prompt
- **GIVEN** a new pane where the user typed "Sửa resume" in the Target Box and left it
- **WHEN** the user sends "chạy test"
- **THEN** the Session Goal is still "Sửa resume"

#### Scenario: Cleared target stays empty
- **GIVEN** the user cleared the Target Box of a session and left it
- **WHEN** the user sends another prompt
- **THEN** the Target Box stays empty

### Requirement: Keep session goal across launches (SRS-FR-096)
Traces: SRS-FR-096 ← BR-09 ← BO-03

The system SHALL keep the Session Goal of each session between application launches.

#### Scenario: Restart the app
- **GIVEN** the user edited the Session Goal of the session in pane 1
- **WHEN** the user quits and reopens the app
- **THEN** the reopened pane shows the edited goal in its Target Box

#### Scenario: Close and resume
- **GIVEN** a pane whose session has a Session Goal
- **WHEN** the user closes the pane and later resumes that session
- **THEN** the Target Box shows the same goal as before the close

### Requirement: Goal of a resumed session without a stored goal (SRS-FR-097)
Traces: SRS-FR-097 ← BR-09 ← BO-03

When the user resumes a session that has no stored Session Goal, the system SHALL set the first prompt the user sent in that session as its Session Goal.

#### Scenario: Old session
- **GIVEN** a session with no stored Session Goal whose first prompt was "Scaffold Tauri app"
- **WHEN** the user resumes it
- **THEN** the Target Box shows "Scaffold Tauri app"
- **AND** the session's history file is unchanged

#### Scenario: Session with no prompt
- **GIVEN** a session with no stored Session Goal and no prompt in its history
- **WHEN** the user resumes it
- **THEN** the Target Box is empty and shows its placeholder

## ADDED Requirements

### Requirement: Target Box (SRS-FR-092)
Traces: SRS-FR-092 ← BR-09 ← BO-03

The system SHALL show the Target Box below the header of every pane.

#### Scenario: New pane before any prompt
- **GIVEN** a new pane where no prompt has been sent
- **WHEN** the pane is shown
- **THEN** the Target Box is empty and shows a placeholder

#### Scenario: Goal in red
- **GIVEN** the Session Goal is "Sửa lỗi resume"
- **WHEN** the pane is shown
- **THEN** the Target Box shows "Sửa lỗi resume" in red text

#### Scenario: Long goal scrolls
- **GIVEN** the Session Goal has 5 lines
- **WHEN** the pane is shown
- **THEN** the Target Box is 3 lines tall and the rest can be scrolled inside it

#### Scenario: Double-click in the Target Box
- **GIVEN** three panes and pane 2 has a Session Goal
- **WHEN** the user double-clicks in the Target Box of pane 2
- **THEN** no pane is maximized

### Requirement: Edit in the Target Box (SRS-FR-093)
Traces: SRS-FR-093 ← BR-09 ← BO-03

When the Target Box loses focus after the user changed its text, the system SHALL replace the Session Goal with that text.

#### Scenario: Save a new goal
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback"
- **WHEN** the user clicks the Target Box, changes the text to "Sửa resume trên Windows" and clicks outside it
- **THEN** the Target Box shows "Sửa resume trên Windows"
- **AND** after the app is quit and reopened the Target Box of that session shows "Sửa resume trên Windows"

#### Scenario: Enter adds a line
- **GIVEN** the user is editing the Target Box
- **WHEN** the user presses Enter
- **THEN** the text gets a new line and the edit goes on

#### Scenario: Empty text is saved
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback"
- **WHEN** the user clears the Target Box and clicks outside it
- **THEN** the Target Box is empty and shows its placeholder

#### Scenario: Escape cancels
- **GIVEN** the Session Goal is "Sửa lỗi resume" and the user typed "abc" in the Target Box
- **WHEN** the user presses Esc
- **THEN** the Target Box shows "Sửa lỗi resume"
- **AND** the Session Goal is still "Sửa lỗi resume"

## REMOVED Requirements

### Requirement: Goal Line (SRS-FR-092)
**Reason**: CR-010 replaces the one-line Goal Line and its Edit Goal button with the Target Box.
**Migration**: replaced by "Target Box (SRS-FR-092)" under ADDED.

### Requirement: Edit session goal (SRS-FR-093)
**Reason**: CR-010: editing moves into the Target Box, saved when it loses focus, and an empty text is now saved instead of keeping the old goal.
**Migration**: replaced by "Edit in the Target Box (SRS-FR-093)" under ADDED.

### Requirement: Focus Reminder with each prompt (SRS-FR-094)
**Reason**: CR-010: the app no longer adds anything to a prompt; the user aligns with the target by themselves.
**Migration**: none; prompts reach Claude Code unchanged.

### Requirement: Off-goal instruction (SRS-FR-095)
**Reason**: CR-010: the app no longer binds Claude Code to the Session Goal.
**Migration**: none.

### Requirement: Prompt goes through without reminder (SRS-FR-098)
**Reason**: CR-010: with no Focus Reminder every prompt goes through unchanged, so the fallback has nothing to cover.
**Migration**: none.
