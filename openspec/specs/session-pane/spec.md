# session-pane Specification

## Purpose
TBD - created by archiving change add-session-pane. Update Purpose after archive.
## Requirements
### Requirement: Start a new session (SRS-FR-018)
Traces: SRS-FR-018 ← BR-04 ← BO-02

When the user starts a new session in the selected workspace, the system SHALL open a new pane that runs a new Claude Code session in that workspace folder.

#### Scenario: New Session in agent-deck
- **GIVEN** the workspace `agent-deck` at `/Users/mionix/Project/personal/agent-deck` is selected
- **WHEN** the user presses "New Session"
- **THEN** a new pane opens running Claude Code with working folder `/Users/mionix/Project/personal/agent-deck`

### Requirement: Reject a new session in a missing workspace (SRS-FR-020)
Traces: SRS-FR-020 ← BR-04 ← BO-02

If the user starts a new session in a `Missing` workspace, then the system SHALL reject the request and show the message "Folder not found".

#### Scenario: Missing workspace
- **GIVEN** the workspace `mokairo` is `Missing`
- **WHEN** the user presses "New Session" with `mokairo` selected
- **THEN** no pane opens
- **AND** the message "Folder not found" is shown

### Requirement: Focus the new pane (SRS-FR-014)
Traces: SRS-FR-014 ← BR-03 ← BO-02

When a pane opens, the system SHALL move keyboard focus to that pane.

#### Scenario: Typing right after opening
- **WHEN** a new pane opens and the user types without clicking
- **THEN** the typed characters appear in the new pane

### Requirement: Report Claude Code start failure (SRS-FR-017)
Traces: SRS-FR-017 ← BR-03 ← BO-02

If Claude Code cannot be started for a pane, then the system SHALL show the message "Claude Code could not be started" in that pane.

#### Scenario: Claude Code not installed
- **GIVEN** Claude Code cannot be found on the machine
- **WHEN** the user starts a new session
- **THEN** the pane opens and shows "Claude Code could not be started"

### Requirement: Split right by default (SRS-FR-021)
Traces: SRS-FR-021 ← BR-05 ← BO-01

When a new pane opens, the system SHALL split the focused pane and place the new pane to its right.

#### Scenario: Second pane
- **GIVEN** one pane is open and focused
- **WHEN** the user starts another session
- **THEN** two panes are shown side by side and the new pane is on the right

### Requirement: Reflow on resize (SRS-FR-024)
Traces: SRS-FR-024 ← BR-05 ← BO-01

When a pane changes size, the system SHALL fit the session's terminal content to the new pane size.

#### Scenario: Pane narrowed to half
- **WHEN** a pane becomes half as wide (for example because a second pane opened next to it)
- **THEN** the Claude Code input box is redrawn to fit the pane width

### Requirement: Behave like a standard terminal (SRS-FR-025)
Traces: SRS-FR-025 ← BR-05 ← BO-01

The system SHALL render colours, cursor movement, scrolling, text selection, copy, paste and mouse input in each pane the same way the operating system's default terminal does for the same Claude Code session.

#### Scenario: Same session in a pane and in Terminal.app
- **WHEN** the same Claude Code session is shown in an agent-deck pane and in Terminal.app
- **THEN** both show the same colours and selection menus, and scrolling and select-to-copy work the same way

### Requirement: Vietnamese input (SRS-FR-026)
Traces: SRS-FR-026 ← BR-05 ← BO-01

The system SHALL accept Vietnamese text typed through an operating system input method in every pane.

#### Scenario: Telex input
- **WHEN** the user types "sửa lỗi đăng nhập" with the macOS Telex input method in a pane
- **THEN** the pane receives exactly "sửa lỗi đăng nhập", with no repeated or lost characters

#### Scenario: Raw keys leak through
- **WHEN** the pane shows "ddang nhaap" for typed "đăng nhập"
- **THEN** the requirement is not met

### Requirement: Show session ended (SRS-FR-028)
Traces: SRS-FR-028 ← BR-05 ← BO-01

When the session in a pane exits abnormally, the system SHALL show the message "Session ended" in that pane.

#### Scenario: Claude Code is killed
- **WHEN** the Claude Code process of a pane exits with a non-zero code or from a signal
- **THEN** the pane shows "Session ended"
- **AND** the earlier pane content can still be scrolled and read

#### Scenario: User exits Claude Code
- **WHEN** the user types `/exit` in a pane
- **THEN** the pane closes (SRS-FR-083) and no "Session ended" is shown

### Requirement: Close pane ends its session (SRS-FR-029)
Traces: SRS-FR-029 ← BR-05 ← BO-01

When the user closes a pane, the system SHALL end the Claude Code session running in that pane.

#### Scenario: Closing an idle pane
- **WHEN** the user closes a pane whose Claude Code session is idle
- **THEN** the pane disappears
- **AND** the Claude Code process of that pane and its child processes have ended

### Requirement: Pane header (SRS-FR-030)
Traces: SRS-FR-030 ← BR-05 ← BO-01

The system SHALL show the workspace name and the session title in the header of each pane.

#### Scenario: Named session
- **WHEN** a pane runs the session titled "Scaffold Tauri app" in workspace `agent-deck`
- **THEN** the pane header reads "agent-deck · Scaffold Tauri app"

#### Scenario: New session not yet named
- **WHEN** a pane runs a new session that Claude Code has not titled and that has no prompt yet
- **THEN** the pane header reads "agent-deck · (untitled)" per RULE-01

### Requirement: Input latency (SRS-NFR-002)
Traces: SRS-NFR-002 ← BR-05 ← BO-01

The system SHALL echo a keystroke in the focused pane within 100 ms at the 95th percentile.

#### Scenario: 200 keystrokes measured
- **WHEN** 200 keystrokes are typed into the focused pane and the time from key to echo is measured
- **THEN** at most 10 of them take longer than 100 ms

### Requirement: Confirm closing a busy pane (SRS-FR-027)
Traces: SRS-FR-027 ← BR-05 ← BO-01

If the user closes a pane whose session is `Running` or `Needs Approval`, then the system SHALL ask for confirmation before closing that pane.

#### Scenario: Cancel keeps the pane
- **GIVEN** a pane is `Running`
- **WHEN** the user presses the pane's close button
- **THEN** the dialog "Session is still running. Close anyway?" is shown
- **AND** choosing Cancel keeps the pane and its session running

#### Scenario: Confirm closes the pane
- **GIVEN** a pane is `Needs Approval` and the dialog "Session is still running. Close anyway?" is shown
- **WHEN** the user chooses Close
- **THEN** the pane closes and its session ends

#### Scenario: Idle pane closes at once
- **GIVEN** a pane is `Idle`
- **WHEN** the user presses the pane's close button
- **THEN** the pane closes without a dialog

### Requirement: Close pane on normal exit (SRS-FR-083)
Traces: SRS-FR-083 ← BR-05 ← BO-01

When the session in a pane exits normally, the system SHALL close that pane and give its space to the remaining panes.

#### Scenario: /exit in the middle pane
- **GIVEN** three panes side by side
- **WHEN** the user types `/exit` in pane 2
- **THEN** pane 2 disappears without a confirmation
- **AND** pane 1 and pane 3 share the freed space
- **AND** the row of that session leaves Active Sessions

#### Scenario: /exit in the only pane
- **GIVEN** one pane
- **WHEN** the user types `/exit` in it
- **THEN** the pane area is empty as before any session was opened

#### Scenario: /exit in the maximized pane
- **GIVEN** pane 1 is maximized over panes 1 and 2
- **WHEN** the user types `/exit` in pane 1
- **THEN** pane 1 closes and pane 2 is shown in the layout

