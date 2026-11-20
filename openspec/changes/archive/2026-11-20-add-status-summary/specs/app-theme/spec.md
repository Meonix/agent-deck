## MODIFIED Requirements

### Requirement: Fonts work offline
The system SHALL ship the UI and monospace fonts inside the app so text renders in them without a network connection.

#### Scenario: No network
- **WHEN** the app starts with no network connection
- **THEN** UI text and pane-header text render in Inter and terminal text in JetBrains Mono
