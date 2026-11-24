# app-theme Specification

## Purpose
Defines the visual signals of the main window that the user relies on to spot sessions needing attention, and the visual guarantees that hold whatever the palette.
## Requirements
### Requirement: Attention panes stand out
The system SHALL draw a 2px Needs Approval border around a pane whose session needs approval, and a 2px Error border around a pane whose session is in Error. Neither pane SHALL be dimmed.

#### Scenario: Needs Approval pane is outlined
- **WHEN** a session in a pane changes to Needs Approval
- **THEN** that pane shows the 2px Needs Approval border at full opacity, with no inner glow

#### Scenario: Error pane keeps full opacity
- **WHEN** a session in a pane that is not focused changes to Error
- **THEN** that pane shows the 2px Error border at full opacity

### Requirement: Unfocused panes recede
The system SHALL dim every pane that is not focused, not maximized, and not in Needs Approval or Error, and SHALL show it at full opacity again as soon as it gains focus.

#### Scenario: Focus moves
- **WHEN** the user focuses another pane
- **THEN** the newly focused pane shows at full opacity and the previously focused pane, if it is Running or Idle, is dimmed

#### Scenario: Maximized pane is never dimmed
- **WHEN** a pane is maximized
- **THEN** it shows at full opacity

### Requirement: Icon-only controls keep their names
Every control that shows only an icon SHALL keep an accessible name and a tooltip naming its action, in Vietnamese.

#### Scenario: Pane header buttons
- **WHEN** a screen reader reads a pane header
- **THEN** it announces "Để dành phiên", "Phóng to ô" or "Thu về ô", and "Đóng ô"

#### Scenario: Sidebar folder buttons
- **GIVEN** the Workspace List contains `alpha`
- **WHEN** a screen reader reads the Folders section
- **THEN** it announces "Thêm folder" for the add button and "Bỏ folder alpha" for the remove button of `alpha`

### Requirement: Terminal colours follow the theme tokens
The system SHALL create each terminal with its font, background, foreground, cursor, selection and 16 ANSI colours taken from the theme tokens active at creation.

#### Scenario: New terminal in dark theme
- **WHEN** a pane opens while the dark theme is active
- **THEN** its terminal uses the dark tokens for background, foreground, cursor, selection and ANSI colours

### Requirement: Fonts work offline
The system SHALL ship the UI and monospace fonts inside the app so text renders in them without a network connection.

#### Scenario: No network
- **WHEN** the app starts with no network connection
- **THEN** UI text and pane-header text render in Inter and terminal text in JetBrains Mono

### Requirement: Readable sidebar labels and hover
Section titles in the Sidebar and the secondary text of a hovered or selected Sidebar row SHALL keep a contrast ratio of at least 4.5:1 against the background they sit on, in both light and dark themes.

#### Scenario: Measured title and hover colours
- **GIVEN** the tokens `--section-label`, `--muted`, `--section-active`, `--card` and `--muted-foreground` in light and dark
- **WHEN** `--section-label` is measured against `--card`, and `--muted-foreground` against the hover background `--muted` and against `--section-active`
- **THEN** every ratio is at least 4.5:1

#### Scenario: Hover is visible on the sidebar
- **WHEN** the pointer rests on a Sidebar row
- **THEN** the row background changes from `--card` to `--muted`, which differs from `--card` by at least 1.05:1 in both themes

