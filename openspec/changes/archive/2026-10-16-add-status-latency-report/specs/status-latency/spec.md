## ADDED Requirements

### Requirement: Record status change timing (SRS-FR-038)
Traces: SRS-FR-038 ← BR-06 ← BO-01

When a session open in a pane changes state, the system SHALL record the time Claude Code reported the change and the time the Status Board showed it.

#### Scenario: Permission request recorded
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code reports a permission request at 14:02:00.200 and the card appears on the Status Board at 14:02:00.450
- **THEN** one record is kept with the new state `Needs Approval`, reported at 14:02:00.200 and shown at 14:02:00.450 (250 ms)

#### Scenario: Change that removes a card is recorded
- **GIVEN** a pane is `Running` and its card is on the Status Board
- **WHEN** Claude Code reports that the turn finished and the card disappears
- **THEN** one record is kept with the new state `Idle`

#### Scenario: No record without a state change
- **GIVEN** a pane is `Running`
- **WHEN** a status signal arrives that keeps the session `Running`
- **THEN** no record is kept

### Requirement: Status latency report (SRS-FR-039)
Traces: SRS-FR-039 ← BR-06 ← BO-01

When the user opens the Status Latency report, the system SHALL show the percentage of state changes in the last 14 days that appeared on the Status Board within 3 seconds.

#### Scenario: Report with data
- **GIVEN** the last 14 days hold 400 state change records, 398 of them shown within 3 seconds of being reported
- **WHEN** the user opens the Status Latency report
- **THEN** it shows "99.5%" and "398 of 400 state changes appeared within 3 s"

#### Scenario: Exactly 3 seconds counts
- **GIVEN** one record reported at 14:02:00.000 and shown at 14:02:03.000
- **WHEN** the user opens the Status Latency report
- **THEN** that record counts as within 3 seconds

#### Scenario: Older records are left out
- **GIVEN** one record shown 15 days ago and two records shown today, all within 3 seconds
- **WHEN** the user opens the Status Latency report
- **THEN** it shows "2 of 2 state changes appeared within 3 s"

#### Scenario: No data yet
- **GIVEN** no state change has been recorded in the last 14 days
- **WHEN** the user opens the Status Latency report
- **THEN** it shows "No data yet" and no percentage
