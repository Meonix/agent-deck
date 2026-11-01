## ADDED Requirements

### Requirement: Remove control on demand
Traces: SRS-FR-004 ← BR-01 ← BO-02

The system SHALL show a folder row's Remove control only while that row is hovered or the control has keyboard focus, and SHALL keep the control in the keyboard tab order directly after its folder row.

#### Scenario: Hidden until hovered
- **GIVEN** the Workspace List contains `alpha`
- **WHEN** the pointer is not over the `alpha` row and nothing in it has focus
- **THEN** the Remove control of `alpha` is not visible

#### Scenario: Reachable by keyboard
- **GIVEN** the Workspace List contains `alpha` and `beta`
- **WHEN** the user tabs past "+ Add Folder" and the `alpha` row
- **THEN** "Remove alpha" has focus and is visible
