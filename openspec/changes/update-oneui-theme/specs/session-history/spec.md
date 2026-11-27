## MODIFIED Requirements

### Requirement: List sessions of a workspace (SRS-FR-007)
When the user chooses + on a workspace row, the system SHALL open the Session Chooser listing every Claude Code session that belongs to that workspace per RULE-02.

Traces: SRS-FR-007 ← BR-02 ← BO-02

The Session Chooser is a 440px modal dialog centred over a dimmed, blurred backdrop. It holds the workspace name and ×, the button "Phiên mới", the label "Mở lại phiên cũ" and the session rows; focus stays inside and sessions are re-read on every open.

#### Scenario: Three sessions
- **GIVEN** the workspace `agent-deck` has 3 Claude Code sessions started in `/Users/mionix/Project/personal/agent-deck`
- **WHEN** the user chooses + on the row `agent-deck`
- **THEN** the Session Chooser opens in the middle of the window with the header `agent-deck`, the button "Phiên mới" and 3 session rows
- **AND** the panes keep their size

#### Scenario: + on a workspace inside Folder khác
- **GIVEN** `mokairo` has no open pane and is listed in the open "Folder khác" group
- **WHEN** the user chooses + on the row `mokairo`
- **THEN** the Session Chooser of `mokairo` opens

#### Scenario: Workspace name opens it too
- **GIVEN** the Folder Tree shows the row `agent-deck`
- **WHEN** the user clicks the name `agent-deck`
- **THEN** the Session Chooser of `agent-deck` opens, as with + (additional trigger approved by the PO at GATE 1)
- **AND** the row `agent-deck` is the selected workspace

#### Scenario: Session started in a subfolder
- **GIVEN** a session started in `/Users/mionix/Project/agent-deck/ui`
- **WHEN** the user opens the Session Chooser of the workspace `/Users/mionix/Project/agent-deck`
- **THEN** that session is not in the Session Chooser

#### Scenario: Session created outside the app
- **GIVEN** the user started a new Claude Code session in the folder from a terminal outside agent-deck
- **WHEN** the user opens the Session Chooser of that workspace again
- **THEN** the new session is in the Session Chooser

#### Scenario: Keyboard stays in the chooser
- **GIVEN** the Session Chooser of `agent-deck` is open and a pane is open behind it
- **WHEN** the user presses Tab repeatedly
- **THEN** keyboard focus moves only between the controls of the Session Chooser and never reaches the Sidebar or the pane

#### Scenario: Skeleton while reading
- **GIVEN** the sessions of `agent-deck` are still being read
- **WHEN** the Session Chooser of `agent-deck` opens
- **THEN** it shows skeleton rows and no "Đang tải" text

#### Scenario: No pane open points to +
- **GIVEN** at least one workspace is listed and no pane is open
- **THEN** the pane area reads "Chưa mở phiên nào" and "Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ."
- **AND** it has no "Phiên mới" button

#### Scenario: One UI backdrop
- **WHEN** the Session Chooser is open
- **THEN** the Sidebar and the panes behind it are dimmed and blurred
- **AND** the dialog has 26px corners and sits in the middle of the window
