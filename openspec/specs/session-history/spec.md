# session-history Specification

## Purpose
TBD - created by archiving change add-session-history. Update Purpose after archive.
## Requirements
### Requirement: List sessions of a workspace (SRS-FR-007)
Traces: SRS-FR-007 ← BR-02 ← BO-02

When the user selects a workspace, the system SHALL list every Claude Code session that belongs to that workspace per RULE-02.

#### Scenario: Three sessions
- **GIVEN** the workspace `agent-deck` has 3 Claude Code sessions started in `/Users/mionix/Project/personal/agent-deck`
- **WHEN** the user selects `agent-deck`
- **THEN** the session list shows 3 rows

#### Scenario: Session started in a subfolder
- **GIVEN** a session started in `/Users/mionix/Project/agent-deck/ui`
- **WHEN** the user selects the workspace `/Users/mionix/Project/agent-deck`
- **THEN** that session is not in the list

#### Scenario: Session created outside the app
- **GIVEN** the user started a new Claude Code session in the folder from a terminal outside agent-deck
- **WHEN** the user selects the workspace again
- **THEN** the new session is in the list

### Requirement: Show session title and last activity (SRS-FR-008)
Traces: SRS-FR-008 ← BR-02 ← BO-02

The system SHALL show the title per RULE-01 and the last activity time of each session in the session list.

#### Scenario: Titled session active 2 minutes ago
- **GIVEN** a session whose Claude Code title is "Scaffold Tauri app" and whose last activity was 2 minutes ago
- **THEN** its row shows "Scaffold Tauri app" and "2 min ago"

### Requirement: Order session list (SRS-FR-009)
Traces: SRS-FR-009 ← BR-02 ← BO-02

The system SHALL order the session list by last activity time, newest first.

#### Scenario: Newer above older
- **GIVEN** session A was last active yesterday and session B 2 minutes ago
- **THEN** B is listed above A

### Requirement: Empty session list (SRS-FR-010)
Traces: SRS-FR-010 ← BR-02 ← BO-02

If the selected workspace has no session, then the system SHALL show the message "No sessions yet" in the session list.

#### Scenario: Brand-new folder
- **GIVEN** a workspace where Claude Code has never run
- **WHEN** the user selects it
- **THEN** the session list shows "No sessions yet"

### Requirement: Report unreadable sessions (SRS-FR-011)
Traces: SRS-FR-011 ← BR-02 ← BO-02

If one or more sessions of the selected workspace cannot be read, then the system SHALL show the notice "<N> sessions could not be read" in the session list.

#### Scenario: Two broken sessions out of ten
- **GIVEN** a workspace with 10 sessions, 2 of which cannot be read
- **WHEN** the user selects it
- **THEN** the list shows 8 sessions and the notice "2 sessions could not be read"

### Requirement: Mark live sessions (SRS-FR-012)
Traces: SRS-FR-012 ← BR-02 ← BO-02

While a session is open in a pane, the system SHALL mark that session as `Live` in the session list.

#### Scenario: Session open in a pane
- **GIVEN** the session "Scaffold Tauri app" is open in a pane
- **THEN** its row in the session list carries the label `Live`

#### Scenario: Pane closed
- **GIVEN** the session "Scaffold Tauri app" is open in a pane and marked `Live`
- **WHEN** the user closes that pane
- **THEN** its row no longer carries the label `Live`

### Requirement: Add the new session to the session list (SRS-FR-019)
Traces: SRS-FR-019 ← BR-04 ← BO-02

When a new session starts in a pane, the system SHALL add that session to the session list of its workspace.

#### Scenario: New Session in agent-deck
- **GIVEN** the workspace `agent-deck` is selected
- **WHEN** the user starts a new session
- **THEN** the session list of `agent-deck` has one more row, at the top, labelled `Live`

### Requirement: Session list load time (SRS-NFR-003)
Traces: SRS-NFR-003 ← BR-02 ← BO-02

When the user selects a workspace with up to 200 sessions, the system SHALL show its session list within 3 seconds.

#### Scenario: 200 sessions
- **GIVEN** a workspace with 200 sessions
- **WHEN** the user selects it
- **THEN** the full list is shown less than 3 seconds later

### Requirement: Read-only session history (SRS-NFR-005)
Traces: SRS-NFR-005 ← BRD §8 constraint

The system SHALL NOT modify any Claude Code session history on the machine.

#### Scenario: Listing leaves files untouched
- **GIVEN** the session files of a workspace
- **WHEN** the user selects the workspace and its list is read
- **THEN** every session file has the same content and modification time as before

### Requirement: Data stays on the machine (SRS-NFR-007)
Traces: SRS-NFR-007 ← BRD §8 constraint

The system SHALL NOT send session content or session history to any network destination.

#### Scenario: Listing opens no connection
- **WHEN** the user selects a workspace and its session list is read
- **THEN** the app opens no network connection for it

