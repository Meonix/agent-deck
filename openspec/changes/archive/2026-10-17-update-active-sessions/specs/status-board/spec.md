## RENAMED Requirements

- FROM: `### Requirement: Jump to pane from a highlighted row (SRS-FR-037)`
- TO: `### Requirement: Jump to pane from Active Sessions (SRS-FR-037)`

## MODIFIED Requirements

### Requirement: Highlight session rows (SRS-FR-032)
Traces: SRS-FR-032 ← BR-06 ← BO-01

While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system SHALL show the Status Highlight of that state on the row of that session in Active Sessions. The Status Highlight is the background of that state and a marker of that state. The state follows RULE-03 to RULE-08 and the transition table in SRS section 5; a pane starts in `Idle` (RULE-05: Claude Code waits for a request).

#### Scenario: Three panes in three states
- **GIVEN** `agent-deck` has pane 1 `Running`, `mokairo` has pane 2 `Needs Approval` and pane 3 `Idle`
- **AND** `agent-deck` is the selected folder
- **THEN** in Active Sessions the row of pane 2 has the `Needs Approval` background and the row of pane 1 the `Running` background
- **AND** the row of pane 3 has no Status Highlight

#### Scenario: Ended session has no highlight
- **GIVEN** the session in a pane has exited normally (`Ended`)
- **THEN** its row in Active Sessions has no Status Highlight

#### Scenario: A failing command does not make the session an error
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code runs `npm test`, the command fails, and Claude Code goes on working
- **THEN** the session stays `Running`
- **AND** its row shows the `Running` highlight, not `Error` (RULE-06)

#### Scenario: Service error stops the turn
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code stops the turn because of an `overloaded` service error
- **THEN** the session is `Error` and its row shows the `Error` highlight

#### Scenario: Session exits abnormally
- **GIVEN** a pane is `Idle`
- **WHEN** its Claude Code process exits with a non-zero code
- **THEN** the session is `Error` and its row shows the `Error` highlight

#### Scenario: Error left by a new prompt
- **GIVEN** a pane is `Error`
- **WHEN** the user sends a new prompt in that pane
- **THEN** the session is `Running` and its row shows the `Running` highlight (RULE-08)

#### Scenario: Error left by closing the pane
- **GIVEN** a pane is `Error`
- **WHEN** the user closes that pane
- **THEN** its row is gone from Active Sessions (RULE-08)

#### Scenario: Question to the user counts as approval
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code asks the user to choose an option
- **THEN** the session is `Needs Approval` (A-06)

#### Scenario: Highlighted row keeps its Live mark
- **GIVEN** the session "Scaffold Tauri app" is open in a pane and `Needs Approval`
- **THEN** its row in Active Sessions shows the `Needs Approval` highlight
- **AND** its row in the Session History Panel still shows `Live`, without a highlight (SRS-FR-012)

### Requirement: Jump to pane from Active Sessions (SRS-FR-037)
Traces: SRS-FR-037 ← BR-07 ← BO-01

When the user clicks a row in Active Sessions, the system SHALL move keyboard focus to the pane of that session.

#### Scenario: Answer an approval from its row
- **GIVEN** the row "Scaffold Tauri app" in Active Sessions shows the `Needs Approval` highlight and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Scaffold Tauri app" is focused
- **AND** pressing `1` sends `1` to that session, choosing "Yes" in its permission prompt

#### Scenario: Row reached with the keyboard
- **GIVEN** a row in Active Sessions has keyboard focus
- **WHEN** the user presses Enter
- **THEN** the pane of that session is focused, as with a click
- **AND** that Enter does not reach the terminal

#### Scenario: Idle row jumps too
- **GIVEN** the row "Refactor API client" in Active Sessions is `Idle` and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Refactor API client" is focused

#### Scenario: Row without highlight does not jump
- **GIVEN** the row of a session in the Session History Panel
- **WHEN** the user clicks it
- **THEN** keyboard focus stays where it was and the row shows its Resume button

## ADDED Requirements

### Requirement: List active sessions (SRS-FR-051)
Traces: SRS-FR-051 ← BR-06 ← BO-01

The system SHALL list in Active Sessions every session open in a pane across all workspaces, with its title and its workspace name.

#### Scenario: Two folders
- **GIVEN** `agent-deck` has the session "Scaffold Tauri app" open in a pane and `mokairo` has "Fix login bug" open in a pane
- **AND** `agent-deck` is the selected folder
- **THEN** Active Sessions has 2 rows: "Scaffold Tauri app" with `agent-deck` and "Fix login bug" with `mokairo`

#### Scenario: Old session not open
- **GIVEN** the session "Init repo" of `agent-deck` is not open in any pane
- **THEN** it is not in Active Sessions

#### Scenario: Session ended in its pane
- **GIVEN** the session in a pane has ended and the pane is still open
- **THEN** its row stays in Active Sessions until the pane is closed

### Requirement: Order active sessions (SRS-FR-052)
Traces: SRS-FR-052 ← BR-06 ← BO-01

The system SHALL order Active Sessions by state urgency, `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, and within one state by the time the session entered that state, earliest first.

#### Scenario: Error first
- **GIVEN** pane 1 is `Running` since 14:00, pane 2 `Error` since 14:05 and pane 3 `Needs Approval` since 14:03
- **THEN** Active Sessions lists pane 2, pane 3, pane 1

#### Scenario: Same state, earliest first
- **GIVEN** pane 1 is `Needs Approval` since 14:03 and pane 2 `Needs Approval` since 14:01
- **THEN** pane 2 is listed above pane 1

#### Scenario: Untracked pane
- **GIVEN** the state of a pane cannot be tracked (SRS-FR-036)
- **THEN** its row is listed with the `Idle` rows and has no Status Highlight

### Requirement: Empty active sessions (SRS-FR-053)
Traces: SRS-FR-053 ← BR-06 ← BO-01

While no session is open in a pane, the system SHALL show the message "No active sessions" in Active Sessions.

#### Scenario: App just opened
- **GIVEN** no pane is open
- **THEN** Active Sessions shows "No active sessions"

### Requirement: Sidebar section tints (SRS-NFR-009)
Traces: SRS-NFR-009 ← BR-06 ← BO-01

The system SHALL give the Workspace List section and the Active Sessions section two different background tints, each with a contrast ratio of at most 1.25:1 against the sidebar background and a text contrast of at least 4.5:1, in both light and dark themes.

#### Scenario: Tokens in both themes
- **GIVEN** the tokens `--section-folders` and `--section-active` in `design/agent-deck/tokens.css`
- **THEN** each one measures at most 1.25:1 against `--card` and gives `--foreground` and `--muted-foreground` at least 4.5:1, in `:root` and in `.dark`

#### Scenario: Sections use the tints
- **THEN** the Folders section has the background `--section-folders` and the Active Sessions section the background `--section-active`
