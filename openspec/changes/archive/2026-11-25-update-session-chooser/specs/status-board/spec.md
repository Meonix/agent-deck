## MODIFIED Requirements

### Requirement: Highlight session rows (SRS-FR-032)
While a session is open in a pane, the system SHALL show on its Session Row the status dot and status word of its state and, when the state is `Needs Approval` or `Error`, tint the whole row with that state's colour.

Traces: SRS-FR-032 ← BR-06 ← BO-01

The state follows RULE-03 to RULE-08 and the transition table in SRS section 5; a pane starts in `Idle` (RULE-05: Claude Code waits for a request).

#### Scenario: Five states on five rows
- **GIVEN** five panes are open, one session in each of `Running`, `Needs Approval`, `Idle`, `Error` and `Ended`
- **WHEN** the Folder Tree shows their Session Rows
- **THEN** the `Running` row has a blue dot and "Đang chạy" on the sidebar background
- **AND** the `Needs Approval` row has a yellow ringed dot, "Cần duyệt" and the light yellow row tint
- **AND** the `Idle` row has a green dot and "Xong lượt" without a tint
- **AND** the `Error` row has a red dot, "Lỗi" and the light red row tint
- **AND** the `Ended` row has a hollow dot and "Đã kết thúc" without a tint

#### Scenario: Running is blue, not green
- **GIVEN** a pane is `Running`
- **WHEN** its Session Row is shown
- **THEN** the row shows the `--busy` dot and no `--running-bg` background
- **AND** green (`--running`) is left to the `Idle` ("Xong lượt") dot

#### Scenario: A failing command does not make the session an error
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code runs `npm test`, the command fails, and Claude Code goes on working
- **THEN** the session stays `Running`
- **AND** its Session Row still shows "Đang chạy" without the red tint (RULE-06)

#### Scenario: Service error stops the turn
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code stops the turn because of an `overloaded` service error
- **THEN** the session is `Error` and its Session Row shows "Lỗi" with the red tint

#### Scenario: Session exits abnormally
- **GIVEN** a pane is `Idle`
- **WHEN** its Claude Code process exits with a non-zero code
- **THEN** the session is `Error` and its Session Row shows "Lỗi" with the red tint

#### Scenario: Error left by a new prompt
- **GIVEN** a pane is `Error`
- **WHEN** the user sends a new prompt in that pane
- **THEN** the session is `Running` and its Session Row shows "Đang chạy" without a tint (RULE-08)

#### Scenario: Error left by closing the pane
- **GIVEN** a pane is `Error`
- **WHEN** the user closes that pane
- **THEN** its Session Row is gone from the Folder Tree (RULE-08)

#### Scenario: Question to the user counts as approval
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code asks the user to choose an option
- **THEN** the session is `Needs Approval` and its Session Row shows "Cần duyệt" with the yellow tint (A-06)

#### Scenario: Highlighted row keeps its Live mark
- **GIVEN** the session "Scaffold Tauri app" is open in a pane
- **WHEN** it changes to `Needs Approval`
- **THEN** its Session Row in the Folder Tree shows "Cần duyệt" with the yellow tint
- **AND** its row in the Session Chooser still shows "Đang mở", without a highlight (SRS-FR-012)

### Requirement: Jump to pane from the Folder Tree (SRS-FR-037)
When the user clicks a Session Row in the Folder Tree, the system SHALL move keyboard focus to the pane of that session.

Traces: SRS-FR-037 ← BR-07 ← BO-01

#### Scenario: Answer an approval from its row
- **GIVEN** the Session Row "Scaffold Tauri app" shows "Cần duyệt" and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Scaffold Tauri app" is focused
- **AND** pressing `1` sends `1` to that session, choosing "Yes" in its permission prompt

#### Scenario: Row reached with the keyboard
- **GIVEN** a Session Row has keyboard focus
- **WHEN** the user presses Enter
- **THEN** the pane of that session is focused, as with a click
- **AND** that Enter does not reach the terminal

#### Scenario: Idle row jumps too
- **GIVEN** the Session Row "Refactor API client" is `Idle`, without a tint, and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Refactor API client" is focused

#### Scenario: Chooser row of an open session
- **GIVEN** "Refactor API client" is open in a pane and another pane has keyboard focus
- **WHEN** the user clicks its "Đang mở" row in the Session Chooser
- **THEN** the Session Chooser closes and the pane of "Refactor API client" is focused, without a second pane (SRS-FR-015)
