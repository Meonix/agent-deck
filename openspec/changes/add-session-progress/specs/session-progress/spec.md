## ADDED Requirements

### Requirement: Tracking Prompt (SRS-FR-113)
Traces: SRS-FR-113 ← BR-10 ← BO-04

When a pane starts a new session, the system SHALL show the Tracking Prompt below the Target Box of that pane.

#### Scenario: New Session shows the prompt
- **WHEN** the user starts a New Session
- **THEN** the pane shows "Track progress for this session?" with the buttons Track and No below the Target Box
- **AND** the user can type a prompt in the pane right away

#### Scenario: Resume shows no prompt
- **WHEN** the user resumes an existing session
- **THEN** the pane shows no Tracking Prompt

### Requirement: Turn tracking on from the prompt (SRS-FR-114)
Traces: SRS-FR-114 ← BR-10 ← BO-04

When the user chooses Track in the Tracking Prompt, the system SHALL turn Progress Tracking on for that session and hide the Tracking Prompt.

#### Scenario: Track
- **GIVEN** a new pane showing the Tracking Prompt
- **WHEN** the user chooses Track
- **THEN** the Tracking Prompt is gone and Progress Tracking is on for that session

### Requirement: Decline tracking (SRS-FR-115)
Traces: SRS-FR-115 ← BR-10 ← BO-04

When the user chooses No in the Tracking Prompt, the system SHALL hide the Tracking Prompt and keep Progress Tracking off for that session.

#### Scenario: No means no summaries
- **GIVEN** a new pane showing the Tracking Prompt
- **WHEN** the user chooses No and Claude Code then finishes 5 turns
- **THEN** the pane shows no Progress Strip
- **AND** no summary is run for that session

### Requirement: Tracking button (SRS-FR-116)
Traces: SRS-FR-116 ← BR-10 ← BO-04

The system SHALL show a Tracking button in the header of every pane immediately to the left of the Stash button.

#### Scenario: Header button order
- **WHEN** a pane is shown
- **THEN** its header buttons end in the order Tracking · Stash · Maximize · ×

#### Scenario: Button shows the choice
- **GIVEN** Progress Tracking is on for the session in a pane
- **THEN** the Tracking button of that pane is shown pressed

### Requirement: Track an ongoing session (SRS-FR-117)
Traces: SRS-FR-117 ← BR-10 ← BO-04

When the user turns Progress Tracking on for a session that already has turns, the system SHALL build its Checkpoint List from the whole session history.

#### Scenario: Turn on after 12 turns
- **GIVEN** a session of 12 turns whose user chose No
- **WHEN** the user chooses the Tracking button
- **THEN** the Checkpoint List is built from all 12 turns and the Progress Strip shows it

#### Scenario: Turn on again continues
- **GIVEN** a session whose Progress Tracking was turned off with 3 Checkpoints
- **WHEN** the user turns it on again
- **THEN** the 3 Checkpoints are kept and only the history after them is summarised

### Requirement: Progress Strip (SRS-FR-118)
Traces: SRS-FR-118 ← BR-10 ← BO-04

While Progress Tracking is on for a session whose Checkpoint List is not empty, the system SHALL show the Progress Strip below the Target Box of its pane.

#### Scenario: Strip header counts
- **GIVEN** Progress Tracking is on and the Checkpoint List has 3 `Done` and 1 `In progress`
- **THEN** the Progress Strip header reads "Progress · 3/4"

#### Scenario: No strip before the first update
- **GIVEN** Progress Tracking was just turned on for a new session
- **WHEN** no turn has finished yet
- **THEN** the pane shows no Progress Strip

### Requirement: Checkpoint row (SRS-FR-119)
Traces: SRS-FR-119 ← BR-10 ← BO-04

The system SHALL show each Checkpoint in the Progress Strip with its state mark, its summary, its result line when it has one, and its start time.

#### Scenario: Done row
- **GIVEN** a `Done` Checkpoint "Viết spec add-session-stash" with result "11 yêu cầu, đã duyệt" started at 14:20
- **THEN** its row shows a green check, "Viết spec add-session-stash", "11 yêu cầu, đã duyệt" and "14:20"

#### Scenario: Row is read-only
- **WHEN** the user clicks a Checkpoint row
- **THEN** nothing in the row can be edited

### Requirement: Progress Strip height (SRS-FR-120)
Traces: SRS-FR-120 ← BR-10 ← BO-04

While the Progress Strip is expanded, the system SHALL show at most 4 Checkpoint rows and let the rest scroll inside the strip.

#### Scenario: Ten Checkpoints
- **GIVEN** a Checkpoint List of 10
- **THEN** the expanded Progress Strip is 4 rows tall and the other rows scroll inside it

### Requirement: Scroll to the work in progress (SRS-FR-121)
Traces: SRS-FR-121 ← BR-10 ← BO-04

When the Checkpoint List of a session changes, the system SHALL scroll its Progress Strip to the latest Checkpoint in progress.

#### Scenario: Last row in progress
- **GIVEN** an expanded Progress Strip
- **WHEN** the Checkpoint List changes to 10 Checkpoints with the 10th `In progress`
- **THEN** the 10th row is scrolled into view

### Requirement: Collapse the Progress Strip (SRS-FR-122)
Traces: SRS-FR-122 ← BR-10 ← BO-04

When the user collapses the Progress Strip, the system SHALL show it as one line with the number of Done Checkpoints, the total, and the summary of the latest Checkpoint in progress.

#### Scenario: Collapsed line
- **GIVEN** 3 `Done` and 1 `In progress` "Dựng section Stashed Sessions ở cột trái"
- **WHEN** the user collapses the Progress Strip
- **THEN** it shows the single line "Progress · 3/4 · Dựng section Stashed Sessions ở cột trái"

### Requirement: Expand the Progress Strip (SRS-FR-123)
Traces: SRS-FR-123 ← BR-10 ← BO-04

When the user expands a collapsed Progress Strip, the system SHALL show its Checkpoint rows again.

#### Scenario: Expand
- **GIVEN** a collapsed Progress Strip of 4 Checkpoints
- **WHEN** the user expands it
- **THEN** the 4 Checkpoint rows are shown

### Requirement: Update after each turn (SRS-FR-124)
Traces: SRS-FR-124 ← BR-10 ← BO-04

When Claude Code finishes a turn in a session whose Progress Tracking is on, the system SHALL update its Checkpoint List within 30 seconds.

#### Scenario: Turn finished
- **GIVEN** Progress Tracking is on
- **WHEN** Claude Code finishes a turn at 15:00:00
- **THEN** the Progress Strip shows the updated Checkpoint List before 15:00:30

#### Scenario: No update during a turn
- **GIVEN** Progress Tracking is on and a turn has been running for 20 minutes
- **THEN** the Checkpoint List has not changed since the turn started

#### Scenario: Nothing new
- **GIVEN** Progress Tracking is on and the history has nothing new since the last update
- **WHEN** a turn finishes
- **THEN** no summary is run

### Requirement: Turn tracking off (SRS-FR-125)
Traces: SRS-FR-125 ← BR-10 ← BO-04

When the user turns Progress Tracking off for a session, the system SHALL hide its Progress Strip and stop updating its Checkpoint List.

#### Scenario: Off
- **GIVEN** Progress Tracking is on with 3 Checkpoints
- **WHEN** the user chooses the Tracking button and Claude Code then finishes 3 turns
- **THEN** the pane shows no Progress Strip and no summary is run
- **AND** the 3 Checkpoints are kept for a later turn on

### Requirement: New Checkpoint only for new major work (SRS-FR-126)
Traces: SRS-FR-126 ← BR-10 ← BO-04

When the system updates a Checkpoint List, the system SHALL add a new Checkpoint only for work that RULE-10 counts as a new Checkpoint.

#### Scenario: Small steps stay in one Checkpoint
- **GIVEN** the Checkpoint "Thêm nút Stash" is `In progress`
- **WHEN** a turn reads 3 files, runs the tests and fixes a typo for that button
- **THEN** the Checkpoint List still has one Checkpoint for that work

#### Scenario: New major work
- **GIVEN** the Checkpoint "Thêm nút Stash" is `In progress`
- **WHEN** a turn starts "Viết migration lưu stash"
- **THEN** a new Checkpoint is added for it

### Requirement: Done only on evidence (SRS-FR-127)
Traces: SRS-FR-127 ← BR-10 ← BO-04

The system SHALL mark a Checkpoint `Done` only when the session history shows that its work finished per RULE-11.

#### Scenario: Moving on with failing tests
- **GIVEN** the Checkpoint "Thêm nút Stash" is `In progress`
- **WHEN** a turn moves to other work while the tests of the button still fail
- **THEN** "Thêm nút Stash" stays `In progress`

#### Scenario: Done stays done
- **GIVEN** a `Done` Checkpoint
- **WHEN** a later update proposes it `In progress`
- **THEN** it stays `Done`

### Requirement: Report update failure (SRS-FR-128)
Traces: SRS-FR-128 ← BR-10 ← BO-04

If an update of a Checkpoint List fails, then the system SHALL keep the current Checkpoint List and show "Couldn't update" in the header of its Progress Strip.

#### Scenario: Offline
- **GIVEN** a Checkpoint List of 4
- **WHEN** the update after a turn fails because the network is down
- **THEN** the 4 Checkpoints are unchanged and the Progress Strip header shows "Couldn't update"

#### Scenario: Next update succeeds
- **GIVEN** the Progress Strip shows "Couldn't update"
- **WHEN** the next update succeeds
- **THEN** "Couldn't update" is gone

### Requirement: Keep progress across launches (SRS-FR-129)
Traces: SRS-FR-129 ← BR-10 ← BO-04

The system SHALL keep the Progress Record of each session between application launches.

#### Scenario: Relaunch
- **GIVEN** a tracked session with 4 Checkpoints and a collapsed Progress Strip
- **WHEN** the user quits and reopens the app
- **THEN** the reopened pane shows the same 4 Checkpoints, collapsed

#### Scenario: History moved to the Trash
- **GIVEN** a tracked session
- **WHEN** the user deletes that session
- **THEN** its Progress Record is gone

### Requirement: Resume a session without a Progress Record (SRS-FR-130)
Traces: SRS-FR-130 ← BR-10 ← BO-04

When the user resumes a session that has no Progress Record, the system SHALL keep Progress Tracking off for that session.

#### Scenario: Session from before CR-012
- **GIVEN** a session that has no Progress Record
- **WHEN** the user resumes it
- **THEN** the pane shows no Tracking Prompt and no Progress Strip
- **AND** the Tracking button is not pressed

### Requirement: Tracking after /clear (SRS-FR-131)
Traces: SRS-FR-131 ← BR-10 ← BO-04

When Claude Code starts a new session in a pane after `/clear`, the system SHALL apply the Progress Tracking choice of the previous session in that pane to the new session.

#### Scenario: Clear a tracked session
- **GIVEN** Progress Tracking is on for the session in a pane
- **WHEN** the user runs `/clear`
- **THEN** Progress Tracking is on for the new session, with an empty Checkpoint List
- **AND** the Progress Strip is hidden until the first turn of the new session finishes

### Requirement: Pane session untouched (SRS-NFR-011)
Traces: SRS-NFR-011 ← BR-10 ← BO-04

The system SHALL NOT add any instruction, tool or text to the Claude Code session running in a pane for Progress Tracking.

#### Scenario: Same launch either way
- **WHEN** a pane is opened with Progress Tracking on and another with it off
- **THEN** both Claude Code processes get the same arguments apart from the session id and the hook address

### Requirement: No history from summaries (SRS-NFR-012)
Traces: SRS-NFR-012 ← BR-10 ← BO-04

The system SHALL NOT create any Claude Code session history when it updates a Checkpoint List.

#### Scenario: Twenty updates
- **WHEN** the app updates Checkpoint Lists 20 times
- **THEN** the Session History Panel shows no new session
- **AND** Claude Code's session history folder has no new file

### Requirement: Summary model and login (SRS-NFR-013)
Traces: SRS-NFR-013 ← BRD §8 constraint

The system SHALL update Checkpoint Lists with the Claude Haiku model through the user's existing Claude Code login.

#### Scenario: No API key
- **GIVEN** `ANTHROPIC_API_KEY` is not set
- **WHEN** a turn of a tracked session finishes
- **THEN** the Checkpoint List is updated

#### Scenario: User customisations stay out
- **WHEN** the app runs a summary
- **THEN** that run loads none of the user's CLAUDE.md, hooks or MCP servers
