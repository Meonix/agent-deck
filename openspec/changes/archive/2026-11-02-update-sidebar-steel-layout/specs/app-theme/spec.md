## ADDED Requirements

### Requirement: Readable sidebar labels and hover
Section titles in the Sidebar and the secondary text of a hovered Sidebar row SHALL keep a contrast ratio of at least 4.5:1 against the background they sit on, in both light and dark themes.

#### Scenario: Measured title and hover colours
- **GIVEN** the tokens `--section-label`, `--section-hover`, `--section-folders`, `--section-active`, `--section-stash` and `--muted-foreground` in light and dark
- **WHEN** `--section-label` is measured against each section tint and `--muted-foreground` against `--section-hover`
- **THEN** every ratio is at least 4.5:1
