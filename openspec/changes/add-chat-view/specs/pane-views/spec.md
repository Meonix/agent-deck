## MODIFIED Requirements

### Requirement: View Switch (SRS-FR-146)
When the user chooses Chat, Term, Shell or Plan in the View Switch of a pane, the system SHALL show that view in the pane body.

Traces: SRS-FR-146 ← BR-05 ← BO-01

The View Switch is a segmented pill in the pane header with the items "Chat", "Term", "Shell" and "Plan" in that order; the item of the view shown is filled. Each pane has its own view. The items are buttons with their names as accessible names, grouped under one accessible group name, with exactly one item marked as pressed. Choosing an item moves keyboard focus into the terminal of the view shown. Choosing Chat shows the Chat view (see `chat-view`). Until backlog item 43 (add-plan-view) lands, "Plan" is shown but disabled (`aria-disabled`) and cannot be chosen. Panes open in Term until backlog item 39 (add-composer) adds SRS-FR-147. The view is not kept between application launches (SRS section 3, Pane).

#### Scenario: Choose Term
- **GIVEN** the pane "agent-deck · Fix login bug" shows Shell
- **WHEN** the user chooses Term in its View Switch
- **THEN** the pane body shows the terminal of its Claude Code session
- **AND** the Term item is filled and keyboard focus is in the session terminal

#### Scenario: Each pane has its own view
- **GIVEN** panes 1 and 2 both show Term
- **WHEN** the user switches pane 1 to Shell
- **THEN** pane 2 still shows Term

#### Scenario: Chat and Plan are present but disabled
- **GIVEN** a pane is open
- **WHEN** the user looks at its View Switch
- **THEN** it shows "Chat", "Term", "Shell" and "Plan" in that order
- **AND** only "Plan" is marked disabled (Chat has been enabled by add-chat-view), and clicking "Plan" or pressing Enter on it leaves the pane in its current view

#### Scenario: Choose Chat
- **GIVEN** the pane "agent-deck · Fix login bug" shows Term
- **WHEN** the user chooses Chat in its View Switch
- **THEN** the pane body shows the Chat view of its session
- **AND** the Chat item is filled and the session terminal is hidden but still running

#### Scenario: Keyboard
- **GIVEN** keyboard focus is on the Shell item of a pane showing Term
- **WHEN** the user presses Enter
- **THEN** the pane shows Shell and keyboard focus is in the Pane Shell

#### Scenario: View is not kept between launches
- **GIVEN** pane 1 shows Shell when the user quits the application
- **WHEN** the application starts and reopens pane 1 (SRS-FR-085)
- **THEN** pane 1 shows Term and has no Pane Shell
