## REMOVED Requirements

### Requirement: Status Board columns (SRS-FR-031)
**Reason**: CR-001 removes the Status Board; the column took 280 px from the panes. SRS-FR-031 is `Deleted (CR-001)`.
**Migration**: Status shows as a Status Highlight on session rows (SRS-FR-032) and folder rows (SRS-FR-040) in the left column.

### Requirement: Place session cards (SRS-FR-032)
**Reason**: CR-001 replaces the Status Board card with a Status Highlight on the session row; the scenarios change with it.
**Migration**: See the ADDED requirement carrying SRS-FR-032.

### Requirement: Card content (SRS-FR-033)
**Reason**: CR-001 replaces the Status Board card with a Status Highlight on the session row; the scenarios change with it.
**Migration**: See the ADDED requirement carrying SRS-FR-033.

### Requirement: Jump to pane from card (SRS-FR-037)
**Reason**: CR-001 replaces the Status Board card with a Status Highlight on the session row; the scenarios change with it.
**Migration**: See the ADDED requirement carrying SRS-FR-037.

## MODIFIED Requirements

### Requirement: Status update latency (SRS-FR-034)
Traces: SRS-FR-034 ← BR-06 ← BO-01

When a session open in a pane changes state, the system SHALL update every Status Highlight of that session within 3 seconds.

#### Scenario: Permission prompt shown
- **GIVEN** a pane of the selected folder is `Running`
- **WHEN** Claude Code shows a permission prompt at 14:02:00
- **THEN** its session row and its folder row show the `Needs Approval` highlight before 14:02:03

### Requirement: Ignore inapplicable status signals (SRS-FR-035)
Traces: SRS-FR-035 ← BR-06 ← BO-01

If a status signal does not apply to the current state of a session per the table in SRS section 5, then the system SHALL keep the session in its current state.

#### Scenario: Turn finished after the session ended
- **GIVEN** the session in a pane is `Ended`
- **WHEN** a "turn finished" signal arrives for it
- **THEN** the session stays `Ended` and its row has no Status Highlight

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
- **AND** neither its session row nor its folder row has a Status Highlight

#### Scenario: Signals start later
- **GIVEN** a pane header shows `Status unavailable`
- **WHEN** Claude Code sends its first status signal for that session
- **THEN** the header shows the session state instead

## ADDED Requirements

### Requirement: Highlight session rows (SRS-FR-032)
Traces: SRS-FR-032 ← BR-06 ← BO-01

While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system SHALL show the Status Highlight of that state on the row of that session in the session list. The Status Highlight is the background of that state and a chip with the state name. The state follows RULE-03 to RULE-08 and the transition table in SRS section 5; a pane starts in `Idle` (RULE-05: Claude Code waits for a request).

#### Scenario: Three panes in three states
- **GIVEN** the selected folder has pane 1 `Running`, pane 2 `Needs Approval` and pane 3 `Idle`
- **THEN** the row of pane 1 has the `Running` background and chip, the row of pane 2 has the `Needs Approval` background and chip
- **AND** the row of pane 3 has no Status Highlight

#### Scenario: Ended session has no highlight
- **GIVEN** the session in a pane has exited normally (`Ended`)
- **THEN** its row has no Status Highlight

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
- **THEN** its row has no Status Highlight (RULE-08)

#### Scenario: Question to the user counts as approval
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code asks the user to choose an option
- **THEN** the session is `Needs Approval` (A-06)

#### Scenario: Highlighted row keeps its Live mark
- **GIVEN** the session "Scaffold Tauri app" is open in a pane and `Needs Approval`
- **THEN** its row still shows `Live` next to its last activity (SRS-FR-012)

### Requirement: Status detail line (SRS-FR-033)
Traces: SRS-FR-033 ← BR-06 ← BO-01

While a session row shows the Status Highlight of `Needs Approval` or `Error`, the system SHALL show below the session title the time the session entered that state and the reason of that state.

#### Scenario: Row waiting for an edit
- **GIVEN** the session "Scaffold Tauri app" in the selected folder asked at 14:02 for permission to edit `src/main.rs`
- **THEN** its row shows the chip "Needs Approval" and the line "14:02 · Edit src/main.rs"

#### Scenario: Row for a service error
- **GIVEN** the session "Research PTY crates" in the selected folder stopped at 13:40 with the error type `overloaded`
- **THEN** its row shows the chip "Error" and the line "13:40 · overloaded"

#### Scenario: Running row has no detail line
- **GIVEN** a session in the selected folder is `Running`
- **THEN** its row shows the chip "Running" and no "<time> · <reason>" line

#### Scenario: No reason given
- **GIVEN** a session in the selected folder entered `Error` at 13:40 without a reason
- **THEN** its detail line is "13:40"

### Requirement: Jump to pane from a highlighted row (SRS-FR-037)
Traces: SRS-FR-037 ← BR-07 ← BO-01

When the user clicks a session row that shows a Status Highlight, the system SHALL move keyboard focus to the pane of that session.

#### Scenario: Answer an approval from its row
- **GIVEN** the row "Scaffold Tauri app" shows the `Needs Approval` highlight and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Scaffold Tauri app" is focused
- **AND** pressing `1` sends `1` to that session, choosing "Yes" in its permission prompt

#### Scenario: Row reached with the keyboard
- **GIVEN** a highlighted session row has keyboard focus
- **WHEN** the user presses Enter
- **THEN** the pane of that session is focused, as with a click

#### Scenario: Row without highlight does not jump
- **GIVEN** the row of a session that is not open in a pane
- **WHEN** the user clicks it
- **THEN** keyboard focus stays where it was and the row shows its Resume button

### Requirement: Workspace status (SRS-FR-040)
Traces: SRS-FR-040 ← BR-06 ← BO-01

While at least one session of a workspace open in a pane is `Running`, `Needs Approval` or `Error`, the system SHALL show on that workspace's row the Status Highlight of its most urgent state and the number of its sessions in that state. The order of urgency is `Error`, then `Needs Approval`, then `Running`.

#### Scenario: Error beats Running
- **GIVEN** the folder `mokairo` has 1 session `Error` and 2 sessions `Running` open in panes
- **THEN** the row `mokairo` shows the `Error` background and the badge "1"

#### Scenario: Folder that is not selected
- **GIVEN** `agent-deck` is selected and a pane of `mokairo` changes to `Needs Approval`
- **THEN** the row `mokairo` shows the `Needs Approval` background and the badge "1"

#### Scenario: Idle folder is not highlighted
- **GIVEN** every session of a folder open in a pane is `Idle`
- **THEN** that folder row has no Status Highlight and no badge
