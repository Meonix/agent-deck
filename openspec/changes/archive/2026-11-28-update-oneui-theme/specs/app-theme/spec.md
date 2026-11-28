## MODIFIED Requirements

### Requirement: Readable sidebar labels and hover
Subheaders in the Sidebar and the secondary text of a hovered or selected Sidebar row SHALL keep a contrast ratio of at least 4.5:1 against the background they sit on, in both light and dark themes.

#### Scenario: Measured title and hover colours
- **GIVEN** the tokens `--muted-foreground`, `--muted`, `--accent`, `--oneui-surface` and `--oneui-canvas` in light and dark
- **WHEN** `--muted-foreground` is measured against `--oneui-surface`, against the hover background `--muted` and against `--oneui-canvas`
- **THEN** every ratio is at least 4.5:1

#### Scenario: Hover is visible on the sidebar
- **WHEN** the pointer rests on a Sidebar row
- **THEN** the row background changes from `--oneui-surface` to `--muted`, which differs from `--oneui-surface` by at least 1.05:1 in both themes

## ADDED Requirements

### Requirement: Floating cards on a canvas
The system SHALL draw the window as a canvas on which the Sidebar and each pane are separate cards with rounded corners and a gap between them.

The canvas, card colours, the 24px card radius and the 12px gap come from `design/agent-deck/tokens-oneui.css`; the gap between two panes is where the divider is dragged.

#### Scenario: Two panes side by side
- **GIVEN** the Sidebar is shown and two panes are open side by side
- **WHEN** the user looks at the window
- **THEN** the Sidebar card and the two pane cards each have 24px corners
- **AND** a 12px strip of canvas separates every card from the next and from the window edge

#### Scenario: Dragging in the gap
- **GIVEN** two panes are open side by side
- **WHEN** the user drags in the gap between them 200 px to the right
- **THEN** the left pane card grows by 200 px and the gap stays 12px
