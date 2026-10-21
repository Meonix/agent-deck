## ADDED Requirements

### Requirement: Pin first prompt as session goal (SRS-FR-091)
Traces: SRS-FR-091 ← BR-09 ← BO-03

When the user sends a prompt in a pane whose session has no Session Goal, the system SHALL set that prompt as the Session Goal.

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

### Requirement: Goal Line (SRS-FR-092)
Traces: SRS-FR-092 ← BR-09 ← BO-03

While the session in a pane has a Session Goal, the system SHALL show the Goal Line below the pane header.

#### Scenario: Long goal is cut
- **GIVEN** the Session Goal is 120 characters long
- **WHEN** the pane is shown
- **THEN** the Goal Line shows the first 79 characters followed by "…" and the Edit Goal button
- **AND** hovering the Goal Line shows the whole goal

#### Scenario: No goal yet
- **GIVEN** a new pane where no prompt has been sent
- **WHEN** the pane is shown
- **THEN** the pane has no Goal Line

#### Scenario: Double-click on the Goal Line
- **GIVEN** three panes and pane 2 has a Goal Line
- **WHEN** the user double-clicks the Goal Line of pane 2
- **THEN** no pane is maximized

### Requirement: Edit session goal (SRS-FR-093)
Traces: SRS-FR-093 ← BR-09 ← BO-03

When the user confirms a new text in Edit Goal, the system SHALL replace the Session Goal with that text.

#### Scenario: Save a new goal
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback"
- **WHEN** the user clicks Edit Goal, types "Sửa resume mất scrollback trên Windows" and presses Enter
- **THEN** the Goal Line shows "Sửa resume mất scrollback trên Windows"
- **AND** the Focus Reminder of the next prompt carries the new goal

#### Scenario: Empty text keeps the old goal
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback"
- **WHEN** the user clicks Edit Goal, clears the text and presses Enter
- **THEN** the Session Goal is still "Sửa lỗi resume mất scrollback"

#### Scenario: Escape cancels
- **GIVEN** the user is editing the goal and has typed "abc"
- **WHEN** the user presses Esc
- **THEN** the Goal Line shows the old goal

### Requirement: Focus Reminder with each prompt (SRS-FR-094)
Traces: SRS-FR-094 ← BR-09 ← BO-03

When the user sends a prompt in a pane whose session has a Session Goal, the system SHALL give Claude Code the Focus Reminder with that prompt.

#### Scenario: Off-goal prompt carries the reminder
- **GIVEN** the Session Goal is "Sửa lỗi resume mất scrollback"
- **WHEN** the user sends "thêm nút export CSV"
- **THEN** Claude Code receives that prompt with a Focus Reminder that contains "Sửa lỗi resume mất scrollback"

#### Scenario: Goal longer than 500 characters
- **GIVEN** the Session Goal is 800 characters long
- **WHEN** the user sends a prompt
- **THEN** the Focus Reminder carries only the first 500 characters of the goal

### Requirement: Off-goal instruction (SRS-FR-095)
Traces: SRS-FR-095 ← BR-09 ← BO-03

The system SHALL word the Focus Reminder so that Claude Code, for an Off-goal prompt, does not carry it out, says it is a different task and suggests a new session, unless the user tells it to go ahead.

#### Scenario: Off-goal prompt is pointed out
- **GIVEN** the Session Goal is "Sửa lỗi resume"
- **WHEN** the user sends "thêm nút export CSV"
- **THEN** Claude Code answers that this is a different task and suggests a new session

#### Scenario: User insists
- **GIVEN** Claude Code has just pointed out an off-goal prompt
- **WHEN** the user sends "cứ làm"
- **THEN** Claude Code carries out the request

#### Scenario: In-scope prompt
- **GIVEN** the Session Goal is "Sửa lỗi resume"
- **WHEN** the user sends "commit giúp"
- **THEN** Claude Code commits without pointing anything out

### Requirement: Keep session goal across launches (SRS-FR-096)
Traces: SRS-FR-096 ← BR-09 ← BO-03

The system SHALL keep the Session Goal of each session between application launches.

#### Scenario: Restart the app
- **GIVEN** the user edited the Session Goal of the session in pane 1
- **WHEN** the user quits and reopens the app
- **THEN** the reopened pane shows the edited goal on its Goal Line

#### Scenario: Close and resume
- **GIVEN** a pane whose session has a Session Goal
- **WHEN** the user closes the pane and later resumes that session
- **THEN** the Goal Line shows the same goal as before the close

### Requirement: Goal of a resumed session without a stored goal (SRS-FR-097)
Traces: SRS-FR-097 ← BR-09 ← BO-03

When the user resumes a session that has no stored Session Goal, the system SHALL set the first prompt the user sent in that session as its Session Goal.

#### Scenario: Old session
- **GIVEN** a session with no stored Session Goal whose first prompt was "Scaffold Tauri app"
- **WHEN** the user resumes it
- **THEN** the Goal Line shows "Scaffold Tauri app"
- **AND** the session's history file is unchanged

#### Scenario: Session with no prompt
- **GIVEN** a session with no stored Session Goal and no prompt in its history
- **WHEN** the user resumes it
- **THEN** the pane has no Goal Line

### Requirement: Prompt goes through without reminder (SRS-FR-098)
Traces: SRS-FR-098 ← BR-09 ← BO-03

If the system cannot give Claude Code the Focus Reminder for a prompt, then the system SHALL let that prompt reach Claude Code unchanged.

#### Scenario: Reminder cannot be built
- **GIVEN** a pane whose hook request for a prompt cannot be answered with a Focus Reminder
- **WHEN** the user sends that prompt
- **THEN** Claude Code receives and works on the prompt as before this feature
- **AND** the pane shows no error
