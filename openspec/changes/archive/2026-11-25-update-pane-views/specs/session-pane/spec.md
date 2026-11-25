## MODIFIED Requirements

### Requirement: Focus the new pane (SRS-FR-014)
When a pane opens, the system SHALL move keyboard focus to that pane.

Traces: SRS-FR-014 ← BR-03 ← BO-02

While Chat is disabled (see SRS-FR-146), a pane opens in Term and keyboard focus goes to its session terminal. Focus in the Composer of a pane opening in Chat (SRS-FR-147) comes with backlog item 38 (add-chat-view).

#### Scenario: Typing right after opening
- **WHEN** a new pane opens and the user types without clicking
- **THEN** the pane shows Term and the typed characters appear in its session terminal

### Requirement: Behave like a standard terminal (SRS-FR-025)
The system SHALL render colours, cursor movement, scrolling, text selection, copy, paste and mouse input in each pane the same way the operating system's default terminal does for the same Claude Code session.

Traces: SRS-FR-025 ← BR-05 ← BO-01

This applies in the Term view (CR-016). The reference is Terminal on macOS and Windows Terminal on Windows.

#### Scenario: Same session in a pane and in Terminal.app
- **WHEN** the same Claude Code session is shown in the Term view of an agent-deck pane and in Terminal.app
- **THEN** both show the same colours and selection menus, and scrolling and select-to-copy work the same way

### Requirement: Vietnamese input (SRS-FR-026)
The system SHALL accept Vietnamese text typed through an operating system input method in every pane.

Traces: SRS-FR-026 ← BR-05 ← BO-01

This applies in the Term view and, once it exists, in the Composer (CR-016).

#### Scenario: Telex input
- **WHEN** the user types "sửa lỗi đăng nhập" with the macOS Telex input method in a pane showing Term
- **THEN** the pane receives exactly "sửa lỗi đăng nhập", with no repeated or lost characters

#### Scenario: Raw keys leak through
- **WHEN** the pane shows "ddang nhaap" for typed "đăng nhập"
- **THEN** the requirement is not met

### Requirement: Pane header (SRS-FR-030)
The system SHALL show the workspace name, the session title and the View Switch in the header of each pane.

Traces: SRS-FR-030 ← BR-05 ← BO-01

The header reads, left to right: the state dot, "<workspace> · <title>", the state chip, the View Switch "Chat · Term · Shell · Plan", then the buttons Để dành, Phóng to (Thu về on the Maximized Pane) and ×.

#### Scenario: Named session
- **WHEN** a pane runs the session titled "Scaffold Tauri app" in workspace `agent-deck`
- **THEN** the pane header reads "agent-deck · Scaffold Tauri app" with the View Switch "Chat · Term · Shell · Plan"

#### Scenario: New session not yet named
- **WHEN** a pane runs a new session that Claude Code has not titled and that has no prompt yet
- **THEN** the pane header reads "agent-deck · (untitled)" per RULE-01

#### Scenario: Order of the header controls
- **GIVEN** a pane "agent-deck · Fix login bug" that is not maximized
- **WHEN** the user looks at its header
- **THEN** after the title and the state chip it shows the View Switch, then Để dành, Phóng to and × in that order
