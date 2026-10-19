# pane-restore Specification

## Purpose
TBD - created by archiving change add-pane-restore. Update Purpose after archive.
## Requirements
### Requirement: Remember open panes (SRS-FR-084)
Traces: SRS-FR-084 ← BR-03 ← BO-02

The system SHALL keep the session of every open pane and the pane layout between application launches.

#### Scenario: Ended pane is not remembered
- **GIVEN** three panes, and pane 3 shows "Session ended"
- **WHEN** the user quits the application
- **THEN** panes 1 and 2 are remembered with their positions and ratios, and pane 3 is not

#### Scenario: New session without a prompt is not remembered
- **GIVEN** a pane with a new session to which the user has sent no prompt
- **WHEN** the user quits the application and starts it again
- **THEN** that pane is not reopened and is not counted as a failure

### Requirement: Reopen panes at launch (SRS-FR-085)
Traces: SRS-FR-085 ← BR-03 ← BO-02

When the application starts, the system SHALL resume each remembered session in a pane at its remembered position and size.

#### Scenario: Two panes at 30/70
- **GIVEN** the user quit with panes 1 and 2 side by side at 30/70
- **WHEN** the application starts
- **THEN** both sessions are resumed in two panes side by side at 30/70 with no user action
- **AND** no pane is maximized and no Pane Shell is open

### Requirement: Report panes not reopened (SRS-FR-086)
Traces: SRS-FR-086 ← BR-03 ← BO-02

If a remembered session cannot be resumed at launch, then the system SHALL leave out its pane, give its space to the other panes and show the message "<k> sessions could not be reopened".

#### Scenario: Folder of one pane is missing
- **GIVEN** three panes were remembered and the folder of pane 2 is now `Missing`
- **WHEN** the application starts
- **THEN** panes 1 and 3 are reopened and share the space of pane 2
- **AND** the message "1 sessions could not be reopened" is shown

#### Scenario: Session deleted outside the app
- **GIVEN** the session of pane 1 was moved to the Trash outside agent-deck
- **WHEN** the application starts
- **THEN** pane 1 is not reopened and "1 sessions could not be reopened" is shown

