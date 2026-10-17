## ADDED Requirements

### Requirement: Jump to pane from card (SRS-FR-037)
Traces: SRS-FR-037 ← BR-07 ← BO-01

When the user clicks a card on the Status Board, the system SHALL move keyboard focus to the pane of that session.

#### Scenario: Answer an approval from its card
- **GIVEN** "agent-deck · Scaffold Tauri app" is in the `Needs Approval` column and another pane has keyboard focus
- **WHEN** the user clicks its card
- **THEN** the pane of "Scaffold Tauri app" is focused
- **AND** pressing `1` sends `1` to that session, choosing "Yes" in its permission prompt

#### Scenario: Card reached with the keyboard
- **GIVEN** a card on the Status Board has keyboard focus
- **WHEN** the user presses Enter
- **THEN** the pane of that card's session is focused, as with a click
