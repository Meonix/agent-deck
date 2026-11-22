## MODIFIED Requirements

### Requirement: Icon-only controls keep their names
Every control that shows only an icon SHALL keep an accessible name and a tooltip naming its action, the same names the controls had before the icons changed.

#### Scenario: Pane header buttons
- **WHEN** a screen reader reads a pane header
- **THEN** it announces "Stash session", "Maximize pane" or "Restore pane", and "Close pane"

#### Scenario: Sidebar folder buttons
- **GIVEN** the Workspace List contains `alpha`
- **WHEN** a screen reader reads the Folders section
- **THEN** it announces "+ Add Folder" for the add button and "Remove alpha" for the remove button of `alpha`
