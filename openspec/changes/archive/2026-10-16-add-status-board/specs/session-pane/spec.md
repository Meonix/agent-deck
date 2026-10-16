## ADDED Requirements

### Requirement: Confirm closing a busy pane (SRS-FR-027)
Traces: SRS-FR-027 ← BR-05 ← BO-01

If the user closes a pane whose session is `Running` or `Needs Approval`, then the system SHALL ask for confirmation before closing that pane.

#### Scenario: Cancel keeps the pane
- **GIVEN** a pane is `Running`
- **WHEN** the user presses the pane's close button
- **THEN** the dialog "Session is still running. Close anyway?" is shown
- **AND** choosing Cancel keeps the pane and its session running

#### Scenario: Confirm closes the pane
- **GIVEN** a pane is `Needs Approval` and the dialog "Session is still running. Close anyway?" is shown
- **WHEN** the user chooses Close
- **THEN** the pane closes and its session ends

#### Scenario: Idle pane closes at once
- **GIVEN** a pane is `Idle`
- **WHEN** the user presses the pane's close button
- **THEN** the pane closes without a dialog
