# status-board Specification

## Purpose
TBD - created by archiving change add-status-board. Update Purpose after archive.
## Requirements
### Requirement: Status Board columns (SRS-FR-031)
Traces: SRS-FR-031 ← BR-06 ← BO-01

The system SHALL show a Status Board with the three columns `Running`, `Needs Approval` and `Error`.

#### Scenario: No panes yet
- **GIVEN** the app is open and no pane is open
- **THEN** the Status Board shows the three columns `Running`, `Needs Approval` and `Error`, each empty

### Requirement: Place session cards (SRS-FR-032)
Traces: SRS-FR-032 ← BR-06 ← BO-01

While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system SHALL show a card for that session in the column of that state. The state follows RULE-03 to RULE-08 and the transition table in SRS section 5; a pane starts in `Idle` (RULE-05: Claude Code waits for a request).

#### Scenario: Three panes in three states
- **GIVEN** pane 1 is `Running`, pane 2 is `Needs Approval` and pane 3 is `Idle`
- **THEN** the `Running` column has 1 card, the `Needs Approval` column has 1 card
- **AND** pane 3 has no card

#### Scenario: Ended session has no card
- **GIVEN** the session in a pane has exited normally (`Ended`)
- **THEN** no column has a card for that session

#### Scenario: A failing command does not make the session an error
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code runs `npm test`, the command fails, and Claude Code goes on working
- **THEN** the session stays `Running`
- **AND** the `Error` column has no card for it (RULE-06)

#### Scenario: Service error stops the turn
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code stops the turn because of an `overloaded` service error
- **THEN** the session is `Error` and its card is in the `Error` column

#### Scenario: Session exits abnormally
- **GIVEN** a pane is `Idle`
- **WHEN** its Claude Code process exits with a non-zero code
- **THEN** the session is `Error` and its card is in the `Error` column

#### Scenario: Error left by a new prompt
- **GIVEN** a pane is `Error`
- **WHEN** the user sends a new prompt in that pane
- **THEN** the session is `Running` and its card moves to the `Running` column (RULE-08)

#### Scenario: Error left by closing the pane
- **GIVEN** a pane is `Error`
- **WHEN** the user closes that pane
- **THEN** the card disappears from the board (RULE-08)

#### Scenario: Question to the user counts as approval
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code asks the user to choose an option
- **THEN** the session is `Needs Approval` (A-06)

### Requirement: Card content (SRS-FR-033)
Traces: SRS-FR-033 ← BR-06 ← BO-01

The system SHALL show on each card the workspace name, the session title, the time the session entered its current state, and the reason of that state.

#### Scenario: Card waiting for an edit
- **GIVEN** the session "Scaffold Tauri app" in workspace `agent-deck` asked at 14:02 for permission to edit `src/main.rs`
- **THEN** the `Needs Approval` column shows a card with "Scaffold Tauri app" and "agent-deck · 14:02 · Edit src/main.rs"

#### Scenario: Card for a service error
- **GIVEN** the session "Research PTY crates" in workspace `agent-deck` stopped at 13:40 with the error type `overloaded`
- **THEN** the `Error` column shows a card with "Research PTY crates" and "agent-deck · 13:40 · overloaded"

### Requirement: Status update latency (SRS-FR-034)
Traces: SRS-FR-034 ← BR-06 ← BO-01

When a session open in a pane changes state, the system SHALL update the Status Board within 3 seconds.

#### Scenario: Permission prompt shown
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code shows a permission prompt at 14:02:00
- **THEN** the card is in the `Needs Approval` column before 14:02:03

### Requirement: Ignore inapplicable status signals (SRS-FR-035)
Traces: SRS-FR-035 ← BR-06 ← BO-01

If a status signal does not apply to the current state of a session per the table in SRS section 5, then the system SHALL keep the session in its current state.

#### Scenario: Turn finished after the session ended
- **GIVEN** the session in a pane is `Ended`
- **WHEN** a "turn finished" signal arrives for it
- **THEN** the session stays `Ended` and no card is shown

#### Scenario: Prompt sent while waiting for approval
- **GIVEN** a pane is `Needs Approval`
- **WHEN** a "prompt sent" signal arrives for it
- **THEN** the session stays `Needs Approval`

### Requirement: Report unavailable status (SRS-FR-036)
Traces: SRS-FR-036 ← BR-06 ← BO-01

If the system cannot track the state of a session open in a pane, then the system SHALL show `Status unavailable` in the header of that pane.

#### Scenario: No status signal from Claude Code
- **GIVEN** a pane is open and Claude Code has sent no status signal for it since it started
- **WHEN** 5 seconds have passed since the pane opened
- **THEN** the pane header shows `Status unavailable`
- **AND** the session has no card on the board

#### Scenario: Signals start later
- **GIVEN** a pane header shows `Status unavailable`
- **WHEN** Claude Code sends its first status signal for that session
- **THEN** the header shows the session state instead

### Requirement: No machine-wide Claude Code configuration change (SRS-NFR-006)
Traces: SRS-NFR-006 ← BRD §8 constraint

The system SHALL NOT change the user's machine-wide Claude Code settings.

#### Scenario: Settings untouched after use
- **GIVEN** the Claude Code settings files under `~/.claude/` before the app is used
- **WHEN** the user opens panes, works in them and closes them
- **THEN** those settings files are byte-for-byte the same as before

### Requirement: Jump to pane from card (SRS-FR-037)
Traces: SRS-FR-037 ← BR-07 ← BO-01

When the user clicks a card on the Status Board, the system SHALL move keyboard focus to the pane of that session.

#### Scenario: Answer an approval from its card
- **GIVEN** "agent-deck · Scaffold Tauri app" is in the `Needs Approval` column and another pane has keyboard focus
- **WHEN** the user clicks its card
- **THEN** the pane of "Scaffold Tauri app" is focused
- **AND** pressing `1` sends `1` to that session, choosing "Yes" in its permission prompt

#### Scenario: Card reached with the keyboard
- **GIVEN** a card on the Status Board has keyboard focus
- **WHEN** the user presses Enter
- **THEN** the pane of that card's session is focused, as with a click

