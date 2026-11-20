## ADDED Requirements

### Requirement: Status Summary headline (SRS-FR-132)
Traces: SRS-FR-132 ← BR-06 ← BO-01

While at least one session open in a pane is `Needs Approval` or `Error`, the system SHALL show in the Status Summary the number of those sessions followed by "need you".

#### Scenario: Approval and error sessions are counted together
- **GIVEN** 2 sessions open in panes are `Needs Approval` and 1 is `Error`
- **WHEN** the user looks at the Status Summary
- **THEN** its headline reads "3 need you"

#### Scenario: Unavailable status is not counted
- **GIVEN** 1 session is `Needs Approval` and 1 session shows `Status unavailable`
- **WHEN** the user looks at the Status Summary
- **THEN** its headline reads "1 need you"

### Requirement: Status Summary counts (SRS-FR-133)
Traces: SRS-FR-133 ← BR-06 ← BO-01

While at least one session is open in a pane, the system SHALL show in the Status Summary the number of sessions open in a pane in each of the states `Needs Approval`, `Error` and `Running`.

#### Scenario: Three counts
- **GIVEN** 2 sessions are `Needs Approval`, 1 is `Error` and 5 are `Running`
- **WHEN** the user looks at the Status Summary
- **THEN** it shows "2 need approval", "1 error" and "5 running", each with the mark of its state

#### Scenario: A state with no session has no count
- **GIVEN** 2 sessions are `Needs Approval`, none is `Error`, 1 is `Running`
- **WHEN** the user looks at the Status Summary
- **THEN** it shows "2 need approval" and "1 running" and no error count

### Requirement: All clear (SRS-FR-134)
Traces: SRS-FR-134 ← BR-06 ← BO-01

While at least one session is open in a pane and none of them is `Needs Approval` or `Error`, the system SHALL show "All clear" as the headline of the Status Summary.

#### Scenario: Only running sessions
- **GIVEN** 3 sessions open in panes are `Running`
- **WHEN** the user looks at the Status Summary
- **THEN** its headline reads "All clear" and below it "3 running"

#### Scenario: One error is not all clear
- **GIVEN** 2 sessions are `Running` and 1 is `Error`
- **WHEN** the user looks at the Status Summary
- **THEN** its headline reads "1 need you", not "All clear"

### Requirement: No session open (SRS-FR-135)
Traces: SRS-FR-135 ← BR-06 ← BO-01

While no session is open in a pane, the system SHALL show "Agent Deck" as the headline of the Status Summary and "No sessions running" below it.

#### Scenario: First launch
- **GIVEN** the app starts with no pane open
- **WHEN** the user looks at the Status Summary
- **THEN** it reads "Agent Deck" with "No sessions running" below it

### Requirement: Jump from the Status Summary (SRS-FR-136)
Traces: SRS-FR-136 ← BR-07 ← BO-01

When the user clicks the Go-to button of the Status Summary, the system SHALL move keyboard focus to the pane of the most urgent session.

#### Scenario: Error before Needs Approval
- **GIVEN** pane 2 "Fix login bug" is `Needs Approval` since 14:00 and pane 3 "Write release notes" is `Error` since 14:05
- **WHEN** the user clicks the Go-to button
- **THEN** the button reads "Go to Write release notes"
- **AND** keyboard focus is in pane 3

#### Scenario: Earliest of the same state
- **GIVEN** pane 1 is `Needs Approval` since 14:03 and pane 2 is `Needs Approval` since 14:00, no session is `Error`
- **WHEN** the user clicks the Go-to button
- **THEN** keyboard focus is in pane 2

#### Scenario: No button when all clear
- **GIVEN** every session open in a pane is `Running`
- **WHEN** the user looks at the Status Summary
- **THEN** it has no Go-to button

### Requirement: Collapse while working in a pane (SRS-FR-137)
Traces: SRS-FR-137 ← BR-06 ← BO-01

While keyboard focus is in a pane, the system SHALL show the Status Summary collapsed to one line.

#### Scenario: Click into a pane
- **GIVEN** the window is 1440 px wide and the Status Summary is expanded
- **WHEN** the user clicks into pane 1
- **THEN** the Status Summary shows on one line at most 48 px high, still with its headline, counts and Go-to button

#### Scenario: Focus back in the Sidebar
- **GIVEN** the window is 1440 px wide and keyboard focus is in pane 1
- **WHEN** the user moves keyboard focus to a row of the Workspace List
- **THEN** the Status Summary is expanded again

### Requirement: Collapse in a narrow window (SRS-FR-138)
Traces: SRS-FR-138 ← BR-06 ← BO-01

While the window is narrower than 1100 px, the system SHALL show the Status Summary collapsed to one line.

#### Scenario: Narrow window with focus in the Sidebar
- **GIVEN** the window is 960 px wide
- **WHEN** keyboard focus is in the Workspace List
- **THEN** the Status Summary is on one line

### Requirement: Hide while maximized (SRS-FR-139)
Traces: SRS-FR-139 ← BR-06 ← BO-01

While a pane is maximized, the system SHALL hide the Status Summary.

#### Scenario: Maximize a pane
- **GIVEN** the Status Summary is shown
- **WHEN** the user maximizes pane 1
- **THEN** the Status Summary is not shown and pane 1 covers the window below the title bar

#### Scenario: Restore brings it back
- **GIVEN** pane 1 is maximized
- **WHEN** the user restores pane 1
- **THEN** the Status Summary is shown again

### Requirement: Status Summary update latency (SRS-FR-140)
Traces: SRS-FR-140 ← BR-06 ← BO-01

When a session open in a pane changes state, the system SHALL update the Status Summary within 3 seconds.

#### Scenario: A session starts waiting
- **GIVEN** every session open in a pane is `Running` and the Status Summary reads "All clear"
- **WHEN** the session in pane 3 changes to `Needs Approval` at 14:02:00
- **THEN** the Status Summary reads "1 need you" before 14:02:03
