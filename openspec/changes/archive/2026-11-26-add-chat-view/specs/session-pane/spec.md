## MODIFIED Requirements

### Requirement: Focus the new pane (SRS-FR-014)
When a pane opens, the system SHALL move keyboard focus to that pane.

Traces: SRS-FR-014 ← BR-03 ← BO-02

A pane opens in Term and keyboard focus goes to its session terminal. Opening in Chat with focus in the Composer (SRS-FR-147) comes with backlog item 39 (add-composer), moved there by CR-019.

#### Scenario: Typing right after opening
- **WHEN** a new pane opens and the user types without clicking
- **THEN** the pane shows Term and the typed characters appear in its session terminal
