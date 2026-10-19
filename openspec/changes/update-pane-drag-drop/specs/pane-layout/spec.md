## REMOVED Requirements

### Requirement: Split down on request (SRS-FR-022)
**Reason**: CR-005 — the Split Down button is removed; a pane is placed below another one by dragging it.
**Migration**: drag the pane header onto the bottom Drop Zone of the other pane (SRS-FR-080, SRS-FR-081).

## MODIFIED Requirements

### Requirement: Restore before a new pane (SRS-FR-046)
Traces: SRS-FR-046 ← BR-05 ← BO-01

If a new pane opens while a pane is maximized, then the system SHALL restore the layout before placing the new pane.

#### Scenario: Split from the maximized pane
- **GIVEN** pane 1 is maximized
- **WHEN** the user chooses New Session
- **THEN** the previous layout shows again with the new pane to the right of pane 1

## ADDED Requirements

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
