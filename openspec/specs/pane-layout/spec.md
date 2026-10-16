# pane-layout Specification

## Purpose
TBD - created by archiving change add-pane-split-layout. Update Purpose after archive.
## Requirements
### Requirement: Split down on request (SRS-FR-022)
Traces: SRS-FR-022 ← BR-05 ← BO-01

Where the user chooses `Split Down` when opening a pane, the system SHALL place the new pane below the focused pane.

#### Scenario: Split Down from the pane header
- **GIVEN** the pane "k3s · Fix login" is open and focused
- **WHEN** the user chooses `Split Down` (⇣) in that pane's header
- **THEN** a new pane running a new session in `k3s` opens below "k3s · Fix login"
- **AND** the two panes share the height the first pane had, and the new pane has keyboard focus

#### Scenario: Split Down in a column of panes
- **GIVEN** panes A and B are side by side and B is focused
- **WHEN** the user chooses `Split Down` in B's header
- **THEN** B and the new pane are stacked in the right half, and A keeps the left half

### Requirement: Resize panes (SRS-FR-023)
Traces: SRS-FR-023 ← BR-05 ← BO-01

When the user drags the divider between two panes, the system SHALL resize both panes to follow the divider.

#### Scenario: Drag the divider 200 px to the right
- **GIVEN** two panes side by side, each 600 px wide
- **WHEN** the user drags the divider between them 200 px to the right
- **THEN** the left pane is 800 px wide and the right pane 400 px wide
- **AND** both sessions are redrawn to fit their new width

#### Scenario: Drag the divider between stacked panes
- **GIVEN** two panes one above the other
- **WHEN** the user drags the divider between them up
- **THEN** the upper pane gets shorter and the lower pane taller by the same amount

### Requirement: Concurrent panes (SRS-NFR-001)
Traces: SRS-NFR-001 ← BR-05 ← BO-01

The system SHALL support at least 4 panes open at the same time while meeting SRS-NFR-002.

#### Scenario: Four busy panes
- **GIVEN** 4 panes are open and all 4 sessions are `Running`, writing output
- **WHEN** the user types in the focused pane
- **THEN** each keystroke is echoed within 100 ms at the 95th percentile

