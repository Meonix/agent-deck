## Purpose

The Approval Strip, the Question Card and plan approval of a pane: Claude Code's permission requests, multiple-choice questions and plan-mode exits answered with buttons, while Term keeps working for the same dialogs.

## ADDED Requirements

### Requirement: Approval Strip (SRS-FR-163)
While a session is `Needs Approval` for a tool permission, the system SHALL show in the Approval Strip of its pane the tool name, its command or file, and the buttons Cho phép and Từ chối.

Traces: SRS-FR-163 ← BR-13 ← BO-05

The strip sits above the Composer in Chat and follows `design.html` › `strip()`. It shows only while Claude Code's permission dialog is on the session's screen (design.md › Reading the dialog).

#### Scenario: Bash command
- **GIVEN** Claude Code asks permission to run `npm install`
- **WHEN** the pane shows Chat
- **THEN** the Approval Strip reads "Bash · npm install" with the buttons Cho phép and Từ chối

#### Scenario: File edit
- **GIVEN** Claude Code asks permission to edit `src/main.rs` in the workspace
- **WHEN** the pane shows Chat
- **THEN** the Approval Strip reads "Edit · src/main.rs"

#### Scenario: No strip without a request
- **GIVEN** a session that is `Idle` or `Running` with no dialog on its screen
- **WHEN** the pane shows Chat
- **THEN** no Approval Strip is shown

### Requirement: Answer a permission (SRS-FR-164)
When the user chooses Cho phép or Từ chối in the Approval Strip, the system SHALL answer that permission request with that choice.

Traces: SRS-FR-164 ← BR-13 ← BO-05

Cho phép answers Yes and Từ chối answers No, as the user would in Claude Code's dialog.

#### Scenario: Allow
- **GIVEN** the Approval Strip "Bash · npm install"
- **WHEN** the user chooses Cho phép
- **THEN** Claude Code runs `npm install`
- **AND** the session turns `Running` and the Approval Strip disappears

#### Scenario: Deny
- **GIVEN** the Approval Strip "Bash · touch b.txt"
- **WHEN** the user chooses Từ chối
- **THEN** Claude Code does not run the command and `b.txt` is not created
- **AND** the Approval Strip disappears

### Requirement: Stale answer (SRS-FR-165)
If the request shown has already been answered or replaced when the user chooses, then the system SHALL discard the choice and show "Yêu cầu đã thay đổi".

Traces: SRS-FR-165 ← BR-13 ← BO-05

#### Scenario: Answered in Term first
- **GIVEN** the Approval Strip "Bash · npm install" is still shown after the user answered "Yes" in Term
- **WHEN** the user chooses Cho phép
- **THEN** nothing is sent to the session
- **AND** the pane shows "Yêu cầu đã thay đổi"

#### Scenario: Replaced by another request
- **GIVEN** the Approval Strip "Bash · npm install" was drawn, and Claude Code has since replaced it with a request to edit `src/main.rs`
- **WHEN** the user chooses Cho phép on the old strip
- **THEN** nothing is sent to the session and the pane shows "Yêu cầu đã thay đổi"

#### Scenario: Question answered in Term first
- **GIVEN** a Question Card is still shown after its question was answered in Term
- **WHEN** the user chooses an option and Gửi
- **THEN** nothing is sent to the session and the pane shows "Yêu cầu đã thay đổi"

### Requirement: Question Card (SRS-FR-166)
While a session asks the user to choose among options, the system SHALL show a Question Card with the question, each option, a "Khác…" field and the button Gửi.

Traces: SRS-FR-166 ← BR-13 ← BO-05

The card follows `design.html` › `#question` (QCARD). It covers one question with single choice. Several questions, or several answers at once, are answered in Term (design.md › Non-Goals).

#### Scenario: Choose an option
- **GIVEN** Claude Code asks "Dùng thư viện nào để kiểm dữ liệu?" with the options `zod` and `yup`
- **WHEN** the pane shows Chat
- **THEN** the Question Card shows the question, the options `zod` and `yup`, a "Khác…" field and the button Gửi
- **AND** choosing `zod` and then Gửi makes Claude Code receive `zod`

#### Scenario: Answer in Khác
- **GIVEN** the Question Card for "Dùng thư viện nào để kiểm dữ liệu?"
- **WHEN** the user types "valibot" in "Khác…" and chooses Gửi
- **THEN** Claude Code receives "valibot"

#### Scenario: Nothing chosen
- **GIVEN** the Question Card with no option chosen and "Khác…" empty
- **WHEN** the user looks at Gửi
- **THEN** Gửi is disabled and nothing can be sent

### Requirement: Plan approval (SRS-FR-167)
While a session asks to leave plan mode, the system SHALL show its plan with the buttons Duyệt kế hoạch and Tiếp tục lên kế hoạch, the latter with a feedback field.

Traces: SRS-FR-167 ← BR-13 ← BO-05

The card follows `design.html` › `#question` (PCARD). Duyệt kế hoạch chooses Claude Code's "Yes, manually approve edits", so later edits still ask for permission.

#### Scenario: Keep planning with feedback
- **GIVEN** Claude Code finished a 5-step plan and asks to leave plan mode
- **WHEN** the user types "thêm bước viết test" and chooses Tiếp tục lên kế hoạch
- **THEN** Claude Code receives that feedback and stays in plan mode

#### Scenario: Approve the plan
- **GIVEN** the plan card is shown
- **WHEN** the user chooses Duyệt kế hoạch
- **THEN** Claude Code leaves plan mode and starts on the plan, still asking permission before edits

#### Scenario: Feedback is required to keep planning
- **GIVEN** the plan card with an empty feedback field
- **WHEN** the user looks at Tiếp tục lên kế hoạch
- **THEN** it is disabled until feedback is typed

### Requirement: Answer in Term still works (SRS-FR-168)
While a request is shown in the Approval Strip or a Question Card, the system SHALL let the user answer it in Term instead, and remove the strip or card once answered.

Traces: SRS-FR-168 ← BR-13 ← BO-05

#### Scenario: Answer the strip in Term
- **GIVEN** the Approval Strip is shown
- **WHEN** the user chooses Term and presses `1`
- **THEN** the request is answered and the Approval Strip disappears

#### Scenario: Answer the card in Term
- **GIVEN** a Question Card is shown
- **WHEN** the user answers the question in Term
- **THEN** the Question Card disappears
