# Spec Delta

## Purpose

Defines the visual signals of the main window that the user relies on to spot sessions needing attention, and the visual guarantees that hold whatever the palette.

## ADDED Requirements

### Requirement: Attention panes stand out
The system SHALL draw a 2px Needs Approval border with an inner glow around a pane whose session needs approval, and a 2px Error border around a pane whose session is in Error. Neither pane SHALL be dimmed.

#### Scenario: Needs Approval pane glows
- **WHEN** a session in a pane changes to Needs Approval
- **THEN** that pane shows the 2px Needs Approval border and the inner glow, at full opacity

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
Every control that shows only an icon SHALL keep an accessible name and a tooltip naming its action, the same names the controls had before the icons changed.

#### Scenario: Pane header buttons
- **WHEN** a screen reader reads a pane header
- **THEN** it announces "Track progress", "Stash session", "Maximize pane" or "Restore pane", and "Close pane"

### Requirement: Terminal colours follow the theme tokens
The system SHALL create each terminal with its font, background, foreground, cursor, selection and 16 ANSI colours taken from the theme tokens active at creation.

#### Scenario: New terminal in dark theme
- **WHEN** a pane opens while the dark theme is active
- **THEN** its terminal uses the dark tokens for background, foreground, cursor, selection and ANSI colours

### Requirement: Fonts work offline
The system SHALL ship the UI and monospace fonts inside the app so text renders in them without a network connection.

#### Scenario: No network
- **WHEN** the app starts with no network connection
- **THEN** UI text renders in Inter and terminal and pane-header text in JetBrains Mono
