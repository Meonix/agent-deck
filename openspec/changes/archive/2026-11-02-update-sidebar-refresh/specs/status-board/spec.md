## ADDED Requirements

### Requirement: Row Focus Mark contrast
Traces: SRS-FR-099 ← BR-05

The system SHALL draw the Row Focus Mark in a colour with a contrast ratio of at least 3:1 against the Active Sessions tint and against every Status Highlight fill, in both light and dark themes.

#### Scenario: Measured mark colour
- **GIVEN** the `--row-focus` token in light and dark
- **WHEN** its contrast is measured against `--section-active`, `--running-bg`, `--approval-bg` and `--error-bg` of the same theme
- **THEN** every ratio is at least 3:1
