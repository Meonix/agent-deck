## MODIFIED Requirements

### Requirement: Data stays on the machine (SRS-NFR-007)
Traces: SRS-NFR-007 ← BRD §8 constraint

The system SHALL NOT send session content or session history to any network destination except through Claude Code for a session whose Progress Tracking is on.

#### Scenario: Listing opens no connection
- **WHEN** the user selects a workspace and its session list is read
- **THEN** the app opens no network connection for it

#### Scenario: Untracked session sends nothing
- **GIVEN** a pane whose session has Progress Tracking off
- **WHEN** the user works in it for 30 minutes
- **THEN** the app sends none of that session's content anywhere, itself or through a Claude Code run it starts

#### Scenario: Tracked session goes only through Claude Code
- **GIVEN** a pane whose session has Progress Tracking on
- **WHEN** Claude Code finishes a turn and the app updates its Checkpoint List
- **THEN** the session content leaves the machine only inside the Claude Code run the app starts
- **AND** the app itself opens no network connection
