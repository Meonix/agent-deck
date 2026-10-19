# pane-layout Specification

## Purpose
TBD - created by archiving change add-pane-split-layout. Update Purpose after archive.
## Requirements
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

When the user chooses Maximize on a pane, the system SHALL show that pane over the whole application window below the title bar, covering the Workspace List, Active Sessions, the Session History Panel and the other panes.

#### Scenario: Maximize one of three panes
- **GIVEN** three panes are open and pane 2 is one of them
- **WHEN** the user chooses Maximize on pane 2
- **THEN** only pane 2 is visible below the title bar
- **AND** panes 1 and 3 keep running and keep their size

#### Scenario: Covered controls cannot be reached
- **GIVEN** the Session History Panel is open and pane 2 is maximized
- **WHEN** the user presses Tab
- **THEN** keyboard focus never reaches the Workspace List, Active Sessions, the Session History Panel or another pane

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
- **WHEN** the user chooses New Session
- **THEN** the previous layout shows again with the new pane to the right of pane 1

### Requirement: Maximize on header double-click (SRS-FR-066)
Traces: SRS-FR-066 ← BR-05 ← BO-01

When the user double-clicks the header of a pane that is not maximized, the system SHALL maximize that pane as in SRS-FR-041.

#### Scenario: Double-click the header of one of three panes
- **GIVEN** three panes are open and none is maximized
- **WHEN** the user double-clicks the header of pane 2
- **THEN** only pane 2 is visible below the title bar, as after choosing Maximize on pane 2

#### Scenario: Double-click inside the terminal
- **GIVEN** a pane that is not maximized
- **WHEN** the user double-clicks a word inside its terminal
- **THEN** the pane is not maximized

#### Scenario: Double-click a header button
- **GIVEN** a pane that is not maximized
- **WHEN** the user double-clicks its Shell button
- **THEN** the pane is not maximized

### Requirement: Restore on header double-click (SRS-FR-067)
Traces: SRS-FR-067 ← BR-05 ← BO-01

When the user double-clicks the header of the Maximized Pane, the system SHALL restore the previous layout as in SRS-FR-042.

#### Scenario: Double-click twice gives the layout back
- **GIVEN** two panes split 30/70 and none is maximized
- **WHEN** the user double-clicks the header of the left pane
- **AND** double-clicks the same header again
- **THEN** the two panes are split 30/70 again and nothing is maximized

### Requirement: Show drop zones (SRS-FR-080)
Traces: SRS-FR-080 ← BR-05 ← BO-01

While the user drags the header of a pane over another pane, the system SHALL show the Drop Zones of that other pane.

#### Scenario: Drag pane 1 over pane 2
- **GIVEN** panes 1 and 2 side by side
- **WHEN** the user drags the header of pane 1 over the lower part of pane 2
- **THEN** pane 2 shows its Drop Zones with the bottom zone lit

#### Scenario: Only one pane
- **GIVEN** one pane
- **WHEN** the user drags its header
- **THEN** no Drop Zone is shown

#### Scenario: Press on a header button
- **WHEN** the user presses Close, Shell or Maximize on a header and moves the pointer
- **THEN** no drag starts

### Requirement: Move a pane by drop (SRS-FR-081)
Traces: SRS-FR-081 ← BR-05 ← BO-01

When the user drops a pane on a Drop Zone of another pane, the system SHALL move the dropped pane to that side of the other pane, splitting the other pane in half.

#### Scenario: Drop pane 1 below pane 2
- **GIVEN** panes 1 and 2 side by side and pane 1 is `Running`
- **WHEN** the user drops pane 1 on the bottom Drop Zone of pane 2
- **THEN** pane 2 is on top and pane 1 below, each half the height of the pane area
- **AND** pane 1 is still `Running` with its terminal content kept

#### Scenario: Old place goes to the others
- **GIVEN** pane 1 on the left, panes 2 and 3 stacked on the right
- **WHEN** the user drops pane 3 on the left Drop Zone of pane 1
- **THEN** pane 2 takes the whole right half

### Requirement: Cancel a drag (SRS-FR-082)
Traces: SRS-FR-082 ← BR-05 ← BO-01

If the user releases a dragged pane outside any Drop Zone or presses Esc while dragging, then the system SHALL keep the layout unchanged.

#### Scenario: Drop on itself
- **WHEN** the user drags pane 1 and releases it over pane 1
- **THEN** the layout is unchanged

#### Scenario: Esc while dragging
- **GIVEN** the user drags pane 1 over pane 2
- **WHEN** the user presses Esc
- **THEN** the Drop Zones disappear and the layout is unchanged

### Requirement: Focused pane outline (SRS-FR-087)
Traces: SRS-FR-087 ← BR-05 ← BO-01

While a pane has keyboard focus, the system SHALL show the Focus Outline around that pane.

#### Scenario: Click into one of three panes
- **GIVEN** three panes are open
- **WHEN** the user clicks into pane 2
- **THEN** pane 2 shows the Focus Outline
- **AND** pane 1 and pane 3 do not

#### Scenario: Focused pane waiting for approval
- **GIVEN** pane 2 is in the state `Needs Approval`
- **WHEN** pane 2 has keyboard focus
- **THEN** pane 2 shows its 2px `Needs Approval` border
- **AND** the Focus Outline outside that border

#### Scenario: Jump from Active Sessions
- **GIVEN** two panes are open and pane 2 has keyboard focus
- **WHEN** the user clicks the Active Sessions row of the session in pane 1
- **THEN** pane 1 shows the Focus Outline
- **AND** pane 2 does not

#### Scenario: Maximized pane
- **GIVEN** pane 1 has keyboard focus
- **WHEN** the user maximizes pane 1
- **THEN** pane 1 still shows the Focus Outline

