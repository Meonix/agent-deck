## ADDED Requirements

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
