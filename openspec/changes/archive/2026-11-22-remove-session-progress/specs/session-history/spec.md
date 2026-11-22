## MODIFIED Requirements

### Requirement: Data stays on the machine (SRS-NFR-007)
The system SHALL NOT send session content or session history to any network destination.

Traces: SRS-NFR-007 ← BRD §8 constraint

#### Scenario: Listing opens no connection
- **WHEN** the user selects a workspace and its session list is read
- **THEN** the app opens no network connection for it

#### Scenario: Working in a pane sends nothing
- **GIVEN** a pane running a Claude Code session
- **WHEN** the user works in it for 30 minutes
- **THEN** the app sends none of that session's content anywhere, itself or through a Claude Code run it starts
