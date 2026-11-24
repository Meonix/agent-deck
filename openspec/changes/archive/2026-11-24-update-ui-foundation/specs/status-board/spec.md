## ADDED Requirements

### Requirement: Status word contrast (SRS-NFR-014)
The system SHALL show every status word and status-tinted row with a text contrast of at least 4.5:1 in both light and dark themes.

Traces: SRS-NFR-014 ← BR-06 ← BO-01

#### Scenario: Measured status colours
- **GIVEN** the tokens of `design/agent-deck/tokens.css` in `:root` and in `.dark`
- **WHEN** `--busy-foreground` and `--ready-foreground` are measured against `--card` and `--section-active`, and `--approval-foreground`, `--error-foreground` and `--running-foreground` against `--approval-bg`, `--error-bg` and `--running-bg`
- **THEN** every ratio is at least 4.5:1

## MODIFIED Requirements

### Requirement: Highlight session rows (SRS-FR-032)
While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system SHALL show the Status Highlight of that state on the row of that session in Active Sessions. The Status Highlight is a marker of that state; for `Needs Approval` and `Error` it also tints the whole row with that state's background, while a `Running` row keeps the sidebar background. The state follows RULE-03 to RULE-08 and the transition table in SRS section 5; a pane starts in `Idle` (RULE-05: Claude Code waits for a request).

Traces: SRS-FR-032 ← BR-06 ← BO-01

#### Scenario: Three panes in three states
- **GIVEN** `agent-deck` has pane 1 `Running`, `mokairo` has pane 2 `Needs Approval` and pane 3 `Idle`
- **AND** `agent-deck` is the selected folder
- **THEN** in Active Sessions the row of pane 2 has the `Needs Approval` background and the row of pane 1 the blue `Running` marker without a background
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

#### Scenario: Running is blue, not green
- **GIVEN** a pane is `Running`
- **THEN** its row shows the `--busy` dot and no `--running-bg` background
- **AND** green (`--running`) is left to the `Idle` ("Xong lượt") marker

## REMOVED Requirements

### Requirement: Sidebar section tints (SRS-NFR-009)
**Reason**: CR-016 deletes SRS-NFR-009; the sidebar follows agent-deck-remote, one flat `--card` background separated by labels, not tinted blocks.
**Migration**: None. The Folders and Active Sessions sections sit on `--card`; selection uses `--section-active` and the Row Focus Mark.
