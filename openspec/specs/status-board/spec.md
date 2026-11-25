# status-board Specification

## Purpose
TBD - created by archiving change add-status-board. Update Purpose after archive.
## Requirements
### Requirement: Status update latency (SRS-FR-034)
When a session open in a pane changes state, the system SHALL update every Status Highlight of that session within 3 seconds.

Traces: SRS-FR-034 ← BR-06 ← BO-01

#### Scenario: Permission prompt shown
- **GIVEN** a pane of the selected folder is `Running`
- **WHEN** Claude Code shows a permission prompt at 14:02:00
- **THEN** its session row and its folder row show the `Needs Approval` highlight before 14:02:03

### Requirement: Ignore inapplicable status signals (SRS-FR-035)
If a status signal does not apply to the current state of a session per the table in SRS section 5, then the system SHALL keep the session in its current state.

Traces: SRS-FR-035 ← BR-06 ← BO-01

#### Scenario: Turn finished after the session ended
- **GIVEN** the session in a pane is `Ended`
- **WHEN** a "turn finished" signal arrives for it
- **THEN** the session stays `Ended` and its row has no Status Highlight

#### Scenario: Prompt sent while waiting for approval
- **GIVEN** a pane is `Needs Approval`
- **WHEN** a "prompt sent" signal arrives for it
- **THEN** the session stays `Needs Approval`

### Requirement: Report unavailable status (SRS-FR-036)
If the system cannot track the state of a session open in a pane, then the system SHALL show `Status unavailable` in the header of that pane.

Traces: SRS-FR-036 ← BR-06 ← BO-01

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
The system SHALL NOT change the user's machine-wide Claude Code settings.

Traces: SRS-NFR-006 ← BRD §8 constraint

#### Scenario: Settings untouched after use
- **GIVEN** the Claude Code settings files under `~/.claude/` before the app is used
- **WHEN** the user opens panes, works in them and closes them
- **THEN** those settings files are byte-for-byte the same as before

### Requirement: Highlight session rows (SRS-FR-032)
While a session is open in a pane, the system SHALL show on its Session Row the status dot and status word of its state and, when the state is `Needs Approval` or `Error`, tint the whole row with that state's colour.

Traces: SRS-FR-032 ← BR-06 ← BO-01

The state follows RULE-03 to RULE-08 and the transition table in SRS section 5; a pane starts in `Idle` (RULE-05: Claude Code waits for a request).

#### Scenario: Five states on five rows
- **GIVEN** five panes are open, one session in each of `Running`, `Needs Approval`, `Idle`, `Error` and `Ended`
- **WHEN** the Folder Tree shows their Session Rows
- **THEN** the `Running` row has a blue dot and "Đang chạy" on the sidebar background
- **AND** the `Needs Approval` row has a yellow ringed dot, "Cần duyệt" and the light yellow row tint
- **AND** the `Idle` row has a green dot and "Xong lượt" without a tint
- **AND** the `Error` row has a red dot, "Lỗi" and the light red row tint
- **AND** the `Ended` row has a hollow dot and "Đã kết thúc" without a tint

#### Scenario: Running is blue, not green
- **GIVEN** a pane is `Running`
- **WHEN** its Session Row is shown
- **THEN** the row shows the `--busy` dot and no `--running-bg` background
- **AND** green (`--running`) is left to the `Idle` ("Xong lượt") dot

#### Scenario: A failing command does not make the session an error
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code runs `npm test`, the command fails, and Claude Code goes on working
- **THEN** the session stays `Running`
- **AND** its Session Row still shows "Đang chạy" without the red tint (RULE-06)

#### Scenario: Service error stops the turn
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code stops the turn because of an `overloaded` service error
- **THEN** the session is `Error` and its Session Row shows "Lỗi" with the red tint

#### Scenario: Session exits abnormally
- **GIVEN** a pane is `Idle`
- **WHEN** its Claude Code process exits with a non-zero code
- **THEN** the session is `Error` and its Session Row shows "Lỗi" with the red tint

#### Scenario: Error left by a new prompt
- **GIVEN** a pane is `Error`
- **WHEN** the user sends a new prompt in that pane
- **THEN** the session is `Running` and its Session Row shows "Đang chạy" without a tint (RULE-08)

#### Scenario: Error left by closing the pane
- **GIVEN** a pane is `Error`
- **WHEN** the user closes that pane
- **THEN** its Session Row is gone from the Folder Tree (RULE-08)

#### Scenario: Question to the user counts as approval
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code asks the user to choose an option
- **THEN** the session is `Needs Approval` and its Session Row shows "Cần duyệt" with the yellow tint (A-06)

#### Scenario: Highlighted row keeps its Live mark
- **GIVEN** the session "Scaffold Tauri app" is open in a pane
- **WHEN** it changes to `Needs Approval`
- **THEN** its Session Row in the Folder Tree shows "Cần duyệt" with the yellow tint
- **AND** its row in the Session History Panel still shows `Live`, without a highlight (SRS-FR-012)

### Requirement: Status detail line (SRS-FR-033)
While a Session Row shows the Status Highlight of `Needs Approval` or `Error`, the system SHALL show below the session title the time the session entered that state and the reason of that state.

Traces: SRS-FR-033 ← BR-06 ← BO-01

#### Scenario: Row waiting for an edit
- **GIVEN** the session "Scaffold Tauri app" is open in a pane
- **WHEN** it asks at 14:02 for permission to edit `src/main.rs`
- **THEN** its Session Row shows "Cần duyệt" and the line "14:02 · Edit src/main.rs"

#### Scenario: Row for a service error
- **GIVEN** the session "Research PTY crates" is open in a pane
- **WHEN** it stops at 13:40 with the error type `overloaded`
- **THEN** its Session Row shows "Lỗi" and the line "13:40 · overloaded"

#### Scenario: Running row has no detail line
- **GIVEN** a session is open in a pane
- **WHEN** it is `Running`
- **THEN** its Session Row shows "Đang chạy" and no "<time> · <reason>" line

#### Scenario: No reason given
- **GIVEN** a session is open in a pane
- **WHEN** it enters `Error` at 13:40 without a reason
- **THEN** its detail line is "13:40"

### Requirement: Workspace status (SRS-FR-040)
The system SHALL show on each workspace row the number of its sessions in `Needs Approval` or `Error`, in the colour of the most urgent of them, or else the number of its open sessions in grey.

Traces: SRS-FR-040 ← BR-06 ← BO-01

The order of urgency is `Error`, then `Needs Approval`. The workspace row itself is not tinted.

#### Scenario: Error and approval counted together in red
- **GIVEN** `mokairo` has 1 session `Error`, 1 `Needs Approval` and 2 `Running` open in panes
- **WHEN** the Folder Tree shows the row `mokairo`
- **THEN** the row shows the count "2" in the `Error` colour

#### Scenario: Only approvals, in yellow
- **GIVEN** `agent-deck` is selected and `mokairo` has 1 pane `Running`
- **WHEN** a second pane of `mokairo` changes to `Needs Approval`
- **THEN** the row `mokairo` shows the count "1" in the `Needs Approval` colour

#### Scenario: Nothing needs the user, grey count of open sessions
- **GIVEN** `agent-deck` has 2 sessions open in panes, both `Idle`
- **WHEN** the Folder Tree shows the row `agent-deck`
- **THEN** the row shows the count "2" in grey

#### Scenario: Running sessions only
- **GIVEN** `agent-deck` has 1 session `Running` and 1 `Idle` open in panes
- **WHEN** the Folder Tree shows the row `agent-deck`
- **THEN** the row shows the count "2" in grey

### Requirement: Maximized pane status badge (SRS-FR-044)
While a pane is maximized and at least one other session open in a pane is `Needs Approval` or `Error`, the system SHALL show in the header of the Maximized Pane a badge with the number of those sessions. The badge has the `Error` colour if at least one of them is `Error`, else the `Needs Approval` colour.

Traces: SRS-FR-044 ← BR-06 ← BO-01

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
When the user clicks the status badge of the Maximized Pane, the system SHALL restore the layout and move keyboard focus to the pane of the most urgent other session. `Error` comes before `Needs Approval`; within the same state the session that entered it first comes first.

Traces: SRS-FR-045 ← BR-07 ← BO-01

#### Scenario: Error before an older approval
- **GIVEN** pane 1 is maximized, pane 2 is `Needs Approval` since 14:00 and pane 3 is `Error` since 14:05
- **WHEN** the user clicks the badge
- **THEN** the previous layout shows again and pane 3 has keyboard focus

#### Scenario: Oldest approval first
- **GIVEN** pane 1 is maximized, pane 2 is `Needs Approval` since 14:05 and pane 3 is `Needs Approval` since 14:00
- **WHEN** the user clicks the badge
- **THEN** pane 3 has keyboard focus

### Requirement: Focused session row mark (SRS-FR-099)
While a pane has the Focus Outline, the system SHALL show the Row Focus Mark on the row of that pane's session in the Folder Tree.

Traces: SRS-FR-099 ← BR-05 ← BO-01

The Row Focus Mark is a 3px iris bar on the left edge of the Session Row. Only one row has it at a time; it shows in every state, `Idle` and `Ended` included, and the row's Status Highlight stays.

#### Scenario: Two idle panes
- **GIVEN** two panes are open and both sessions are `Idle`
- **WHEN** the user clicks into pane 2
- **THEN** the Session Row of the session in pane 2 shows the iris bar on its left edge
- **AND** the Session Row of the session in pane 1 does not

#### Scenario: Focused pane that needs approval
- **GIVEN** the session in pane 1 is `Needs Approval`
- **WHEN** pane 1 has the Focus Outline
- **THEN** the Session Row of that session keeps the light yellow tint and "Cần duyệt"
- **AND** shows the iris bar on its left edge

#### Scenario: Jump from the Folder Tree
- **GIVEN** two panes are open and pane 2 has the Focus Outline
- **WHEN** the user clicks the Session Row of the session in pane 1
- **THEN** the Session Row of the session in pane 1 shows the Row Focus Mark
- **AND** the Session Row of the session in pane 2 does not

#### Scenario: No pane focused
- **GIVEN** no pane has the Focus Outline
- **WHEN** the Folder Tree lists Session Rows
- **THEN** no row shows the Row Focus Mark

### Requirement: Row Focus Mark contrast
The system SHALL draw the Row Focus Mark in a colour with a contrast ratio of at least 3:1 against the Sidebar background, the selected-row background and every Session Row tint, in both light and dark themes.

Traces: SRS-FR-099 ← BR-05 ← BO-01

#### Scenario: Measured mark colour
- **GIVEN** the `--row-focus` token in light and dark
- **WHEN** its contrast is measured against `--card`, `--section-active`, `--approval-bg` and `--error-bg` of the same theme
- **THEN** every ratio is at least 3:1

### Requirement: Status word contrast (SRS-NFR-014)
The system SHALL show every status word and status-tinted row with a text contrast of at least 4.5:1 in both light and dark themes.

Traces: SRS-NFR-014 ← BR-06 ← BO-01

#### Scenario: Measured status colours
- **GIVEN** the tokens of `design/agent-deck/tokens.css` in `:root` and in `.dark`
- **WHEN** `--busy-foreground` and `--ready-foreground` are measured against `--card` and `--section-active`, and `--approval-foreground`, `--error-foreground` and `--running-foreground` against `--approval-bg`, `--error-bg` and `--running-bg`
- **THEN** every ratio is at least 4.5:1

### Requirement: Jump to pane from the Folder Tree (SRS-FR-037)
When the user clicks a Session Row in the Folder Tree, the system SHALL move keyboard focus to the pane of that session.

Traces: SRS-FR-037 ← BR-07 ← BO-01

#### Scenario: Answer an approval from its row
- **GIVEN** the Session Row "Scaffold Tauri app" shows "Cần duyệt" and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Scaffold Tauri app" is focused
- **AND** pressing `1` sends `1` to that session, choosing "Yes" in its permission prompt

#### Scenario: Row reached with the keyboard
- **GIVEN** a Session Row has keyboard focus
- **WHEN** the user presses Enter
- **THEN** the pane of that session is focused, as with a click
- **AND** that Enter does not reach the terminal

#### Scenario: Idle row jumps too
- **GIVEN** the Session Row "Refactor API client" is `Idle`, without a tint, and another pane has keyboard focus
- **WHEN** the user clicks that row
- **THEN** the pane of "Refactor API client" is focused

#### Scenario: History row does not jump
- **GIVEN** the row of a session in the Session History Panel
- **WHEN** the user clicks it
- **THEN** keyboard focus stays where it was and the row shows its Resume button

### Requirement: List open sessions in the Folder Tree (SRS-FR-051)
The system SHALL list every session open in a pane as a Session Row under the row of its workspace in the Folder Tree.

Traces: SRS-FR-051 ← BR-06 ← BO-01

#### Scenario: Two folders
- **GIVEN** `agent-deck` has the session "Scaffold Tauri app" open in a pane and `mokairo` has "Fix login bug" open in a pane
- **WHEN** the Folder Tree is shown
- **THEN** the Session Row "Scaffold Tauri app" is under the row `agent-deck`
- **AND** the Session Row "Fix login bug" is under the row `mokairo`
- **AND** no Session Row repeats its workspace name

#### Scenario: Old session not open
- **GIVEN** the session "Init repo" of `agent-deck` is not open in any pane
- **WHEN** the Folder Tree is shown
- **THEN** there is no Session Row "Init repo"

#### Scenario: Session ended in its pane
- **GIVEN** the session in a pane has ended and the pane is still open
- **WHEN** the Folder Tree is shown
- **THEN** its Session Row stays under its workspace, showing "Đã kết thúc", until the pane is closed

### Requirement: Order the Folder Tree (SRS-FR-052)
The system SHALL order the Folder Tree with workspaces that have a session in `Needs Approval` or `Error` first, then the other workspaces with an open session in Workspace List order, and order the Session Rows of a workspace by state urgency `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, then by the time the session entered that state, earliest first.

Traces: SRS-FR-052 ← BR-06 ← BO-01

#### Scenario: Workspace that needs the user goes first
- **GIVEN** the Workspace List is `agent-deck` then `mokairo`
- **AND** `agent-deck` has only pane 1 `Running` since 14:00
- **AND** `mokairo` has pane 2 `Error` since 14:05 and pane 3 `Needs Approval` since 14:03
- **WHEN** the Folder Tree is shown
- **THEN** `mokairo` is first with pane 2 then pane 3 under it
- **AND** `agent-deck` follows with pane 1

#### Scenario: Same state, earliest first
- **GIVEN** pane 1 and pane 2 belong to `agent-deck`
- **WHEN** pane 1 is `Needs Approval` since 14:03 and pane 2 `Needs Approval` since 14:01
- **THEN** the Session Row of pane 2 is above the Session Row of pane 1

#### Scenario: Workspace List order when nothing needs the user
- **GIVEN** the Workspace List is `agent-deck` then `mokairo`, and both have only `Running` or `Idle` sessions
- **WHEN** the Folder Tree is shown
- **THEN** `agent-deck` comes before `mokairo`

#### Scenario: Untracked pane
- **GIVEN** the state of a pane cannot be tracked (SRS-FR-036)
- **WHEN** the Folder Tree is shown
- **THEN** its Session Row is ordered with the `Idle` rows and has no status tint

### Requirement: Collapse a workspace (SRS-FR-142)
When the user chooses the chevron of a workspace row, the system SHALL hide or show the Session Rows under it.

Traces: SRS-FR-142 ← BR-06 ← BO-01

#### Scenario: Fold and unfold
- **GIVEN** `agent-deck` has 2 Session Rows
- **WHEN** the user chooses the chevron of `agent-deck`
- **THEN** the 2 Session Rows are hidden and the row `agent-deck` still shows the count "2"
- **AND** choosing the chevron again shows the 2 Session Rows again

#### Scenario: Folding does not close panes
- **GIVEN** `agent-deck` has 2 panes open
- **WHEN** the user folds `agent-deck`
- **THEN** both panes stay open and keep running

#### Scenario: Folded workspace still shows who needs the user
- **GIVEN** `mokairo` is folded and has 2 `Running` sessions
- **WHEN** one of them changes to `Needs Approval`
- **THEN** the row `mokairo` shows the count "1" in the `Needs Approval` colour (SRS-FR-040)

#### Scenario: Unfolded again at launch
- **GIVEN** the user folded `agent-deck` and quit the application with its panes open
- **WHEN** the application starts and reopens those panes
- **THEN** the Session Rows of `agent-deck` are shown

