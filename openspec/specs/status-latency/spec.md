# status-latency Specification

## Purpose
TBD - created by archiving change add-status-latency-report. Update Purpose after archive.

## Requirements

### Requirement: Record Status Highlight timing (SRS-FR-038)
Traces: SRS-FR-038 ← BR-06 ← BO-01

When a session open in a pane changes state, the system SHALL record the time Claude Code reported the change and the time the Status Highlight showed it.

#### Scenario: Permission request recorded
- **GIVEN** a pane is `Running`
- **WHEN** Claude Code reports a permission request at 14:02:00.200 and the Status Highlight changes at 14:02:00.450
- **THEN** one record is kept with the new state `Needs Approval`, reported at 14:02:00.200 and shown at 14:02:00.450 (250 ms)

#### Scenario: Change that removes a highlight is recorded
- **GIVEN** a pane is `Running` and its row shows the `Running` highlight
- **WHEN** Claude Code reports that the turn finished and the highlight goes away
- **THEN** one record is kept with the new state `Idle`

#### Scenario: No record without a state change
- **GIVEN** a pane is `Running`
- **WHEN** a status signal arrives that keeps the session `Running`
- **THEN** no record is kept
