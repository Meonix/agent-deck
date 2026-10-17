## MODIFIED Requirements

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
