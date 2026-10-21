# status-board Specification

## Purpose
TBD - created by archiving change add-status-board. Update Purpose after archive.
## Requirements
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

### Requirement: No machine-wide Claude Code configuration change (SRS-NFR-006)
Traces: SRS-NFR-006 ← BRD §8 constraint

The system SHALL NOT change the user's machine-wide Claude Code settings.

#### Scenario: Settings untouched after use
- **GIVEN** the Claude Code settings files under `~/.claude/` before the app is used
- **WHEN** the user opens panes, works in them and closes them
- **THEN** those settings files are byte-for-byte the same as before

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

### Requirement: Maximized pane status badge (SRS-FR-044)
Traces: SRS-FR-044 ← BR-06 ← BO-01

While a pane is maximized and at least one other session open in a pane is `Needs Approval` or `Error`, the system SHALL show in the header of the Maximized Pane a badge with the number of those sessions. The badge has the `Error` colour if at least one of them is `Error`, else the `Needs Approval` colour.

#### Scenario: Another pane asks for approval
- **GIVEN** pane 1 is maximized and pane 3 is `Running`
- **WHEN** pane 3 changes to `Needs Approval` at 14:02:00
- **THEN** the header of pane 1 shows the badge "1 need you" in the `Needs Approval` colour before 14:02:03

#### Scenario: Error wins the colour
- **GIVEN** pane 1 is maximized, pane 2 is `Needs Approval` and pane 3 is `Error`
- **THEN** the header of pane 1 shows the badge "2 need you" in the `Error` colour

#### Scenario: Only running sessions
- **GIVEN** pane 1 is maximized and the other panes are `Running`
- **THEN** the header of pane 1 shows no badge

#### Scenario: The maximized pane itself is not counted
- **GIVEN** pane 1 is maximized and `Needs Approval`, and no other pane needs the user
- **THEN** the header of pane 1 shows no badge

### Requirement: Jump from the maximized badge (SRS-FR-045)
Traces: SRS-FR-045 ← BR-07 ← BO-01

When the user clicks the status badge of the Maximized Pane, the system SHALL restore the layout and move keyboard focus to the pane of the most urgent other session. `Error` comes before `Needs Approval`; within the same state the session that entered it first comes first.

#### Scenario: Error before an older approval
- **GIVEN** pane 1 is maximized, pane 2 is `Needs Approval` since 14:00 and pane 3 is `Error` since 14:05
- **WHEN** the user clicks the badge
- **THEN** the previous layout shows again and pane 3 has keyboard focus

#### Scenario: Oldest approval first
- **GIVEN** pane 1 is maximized, pane 2 is `Needs Approval` since 14:05 and pane 3 is `Needs Approval` since 14:00
- **WHEN** the user clicks the badge
- **THEN** pane 3 has keyboard focus

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

### Requirement: Focused session row mark (SRS-FR-099)
Traces: SRS-FR-099 ← BR-05 ← BO-01

While a pane has the Focus Outline, the system SHALL show the Row Focus Mark on the row of that pane's session in Active Sessions.

#### Scenario: Two idle panes
- **GIVEN** two panes are open and both sessions are `Idle`
- **WHEN** the user clicks into pane 2
- **THEN** the Active Sessions row of the session in pane 2 shows the Row Focus Mark
- **AND** the row of the session in pane 1 does not

#### Scenario: Focused running pane
- **GIVEN** the session in pane 1 is `Running`
- **WHEN** pane 1 has the Focus Outline
- **THEN** the row of that session shows the `Running` Status Highlight
- **AND** the Row Focus Mark around it

#### Scenario: Jump from Active Sessions
- **GIVEN** two panes are open and pane 2 has the Focus Outline
- **WHEN** the user clicks the Active Sessions row of the session in pane 1
- **THEN** the row of the session in pane 1 shows the Row Focus Mark
- **AND** the row of the session in pane 2 does not

#### Scenario: No pane focused
- **GIVEN** no pane has the Focus Outline
- **WHEN** Active Sessions lists sessions
- **THEN** no row shows the Row Focus Mark

