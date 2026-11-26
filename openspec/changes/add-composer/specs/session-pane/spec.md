## MODIFIED Requirements

### Requirement: Focus the new pane (SRS-FR-014)
When a pane opens, the system SHALL move keyboard focus to that pane.

Traces: SRS-FR-014 ← BR-03 ← BO-02

A pane opens in Chat (SRS-FR-147) and keyboard focus goes to its Composer.

#### Scenario: Typing right after opening
- **WHEN** a new pane opens and the user types without clicking
- **THEN** the pane shows Chat and the typed characters appear in its Composer
