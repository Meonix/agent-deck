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

### Requirement: Maximize pane (SRS-FR-041)
Traces: SRS-FR-041 ← BR-05 ← BO-01

When the user chooses Maximize on a pane, the system SHALL show that pane over the whole application window below the title bar, covering the Workspace List, the session list and the other panes.

#### Scenario: Maximize one of three panes
- **GIVEN** three panes are open and pane 2 is one of them
- **WHEN** the user chooses Maximize on pane 2
- **THEN** only pane 2 is visible below the title bar
- **AND** panes 1 and 3 keep running and keep their size

#### Scenario: Covered controls cannot be reached
- **GIVEN** pane 2 is maximized
- **WHEN** the user presses Tab
- **THEN** keyboard focus never reaches the Workspace List, the session list or another pane

### Requirement: Restore pane (SRS-FR-042)
Traces: SRS-FR-042 ← BR-05 ← BO-01

When the user chooses Restore on the Maximized Pane, the system SHALL show the previous layout with the same pane sizes.

#### Scenario: Sizes come back
- **GIVEN** two panes split 30/70 and the left one is maximized
- **WHEN** the user chooses Restore
- **THEN** the two panes are split 30/70 again and the sidebar is visible

#### Scenario: Closing the maximized pane
- **GIVEN** pane 2 of three is maximized
- **WHEN** the user closes pane 2
- **THEN** panes 1 and 3 are shown in their layout and nothing is maximized

### Requirement: Reflow on maximize (SRS-FR-043)
Traces: SRS-FR-043 ← BR-05 ← BO-01

When a pane is maximized or restored, the system SHALL fit the session's terminal content to the new pane size.

#### Scenario: Maximized terminal grows
- **GIVEN** a pane taking half the window
- **WHEN** the user maximizes it
- **THEN** its session is resized to the larger terminal size

#### Scenario: Restored terminal shrinks back
- **GIVEN** a maximized pane
- **WHEN** the user restores it
- **THEN** its session is resized back to the size of its place in the layout

### Requirement: Restore before a new pane (SRS-FR-046)
Traces: SRS-FR-046 ← BR-05 ← BO-01

If a new pane opens while a pane is maximized, then the system SHALL restore the layout before placing the new pane.

#### Scenario: Split from the maximized pane
- **GIVEN** pane 1 is maximized
- **WHEN** the user chooses Split Right on pane 1
- **THEN** the previous layout shows again with the new pane to the right of pane 1

