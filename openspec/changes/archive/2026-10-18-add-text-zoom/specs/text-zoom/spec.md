## ADDED Requirements

### Requirement: Increase text size (SRS-FR-068)
Traces: SRS-FR-068 ← BR-05 ← BO-01

When the user presses the Zoom shortcut to enlarge, the system SHALL increase the Text Size by 10 percentage points, up to 200%.

#### Scenario: Enlarge twice
- **GIVEN** the Text Size is 100%
- **WHEN** the user presses the Zoom shortcut to enlarge twice
- **THEN** the Text Size is 120% for the whole window

#### Scenario: Upper limit
- **GIVEN** the Text Size is 200%
- **WHEN** the user presses the Zoom shortcut to enlarge
- **THEN** the Text Size stays 200%

#### Scenario: Shortcut while a pane has focus
- **GIVEN** a pane has keyboard focus
- **WHEN** the user presses the Zoom shortcut to enlarge
- **THEN** the Text Size grows by 10 percentage points
- **AND** the pane does not receive the key

#### Scenario: Ctrl on macOS goes to the terminal
- **GIVEN** the app runs on macOS and a pane has keyboard focus
- **WHEN** the user presses Ctrl −
- **THEN** the Text Size does not change
- **AND** the pane receives the key

### Requirement: Decrease text size (SRS-FR-069)
Traces: SRS-FR-069 ← BR-05 ← BO-01

When the user presses the Zoom shortcut to shrink, the system SHALL decrease the Text Size by 10 percentage points, down to 50%.

#### Scenario: Shrink once
- **GIVEN** the Text Size is 100%
- **WHEN** the user presses the Zoom shortcut to shrink
- **THEN** the Text Size is 90%

#### Scenario: Lower limit
- **GIVEN** the Text Size is 50%
- **WHEN** the user presses the Zoom shortcut to shrink
- **THEN** the Text Size stays 50%

### Requirement: Reset text size (SRS-FR-070)
Traces: SRS-FR-070 ← BR-05 ← BO-01

When the user presses the Zoom shortcut to reset, the system SHALL set the Text Size to 100%.

#### Scenario: Reset from 150%
- **GIVEN** the Text Size is 150%
- **WHEN** the user presses the Zoom shortcut to reset
- **THEN** the Text Size is 100%

### Requirement: Persist text size (SRS-FR-071)
Traces: SRS-FR-071 ← BR-05 ← BO-01

The system SHALL keep the Text Size between application launches.

#### Scenario: Size survives a restart
- **GIVEN** the user set the Text Size to 130%
- **WHEN** the user quits and opens the app again
- **THEN** the Text Size is 130%

### Requirement: Reflow on text size change (SRS-FR-072)
Traces: SRS-FR-072 ← BR-05 ← BO-01

When the Text Size changes, the system SHALL fit the content of every session terminal and Pane Shell to its pane at the new Text Size.

#### Scenario: Two panes refit
- **GIVEN** two panes are open, one of them with a visible Pane Shell
- **WHEN** the user presses the Zoom shortcut to enlarge
- **THEN** both sessions and the Pane Shell are resized to the terminal size that fits their pane at the new Text Size
