## ADDED Requirements

### Requirement: Add Folder at the sidebar foot
Traces: SRS-FR-001 ← BR-01 ← BO-02

The system SHALL place the "+ Add Folder" control in a bar at the bottom of the Sidebar that stays visible while the Sidebar lists scroll, and SHALL put it after every list row in the keyboard tab order.

#### Scenario: Visible while the lists scroll
- **GIVEN** the Sidebar lists are taller than the window
- **WHEN** the user scrolls the lists to the top or to the bottom
- **THEN** "+ Add Folder" stays visible at the bottom of the Sidebar

#### Scenario: Last in tab order
- **GIVEN** the Workspace List contains `alpha` and there are no active or stashed sessions
- **WHEN** the user tabs past the `alpha` row and its Remove control
- **THEN** "+ Add Folder" has focus

## MODIFIED Requirements

### Requirement: Remove control on demand
Traces: SRS-FR-004 ← BR-01 ← BO-02

The system SHALL show a folder row's Remove control only while that row is hovered or the control has keyboard focus, and SHALL keep the control in the keyboard tab order directly after its folder row.

#### Scenario: Hidden until hovered
- **GIVEN** the Workspace List contains `alpha`
- **WHEN** the pointer is not over the `alpha` row and nothing in it has focus
- **THEN** the Remove control of `alpha` is not visible

#### Scenario: Reachable by keyboard
- **GIVEN** the Workspace List contains `alpha` and `beta`
- **WHEN** the user tabs to the `alpha` row and presses Tab once more
- **THEN** "Remove alpha" has focus and is visible
