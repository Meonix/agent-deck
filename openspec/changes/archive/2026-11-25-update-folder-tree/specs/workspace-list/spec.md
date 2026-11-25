## RENAMED Requirements

- FROM: `### Requirement: Add Folder at the sidebar foot`
- TO: `### Requirement: Add Folder after the Folder Tree`

## MODIFIED Requirements

### Requirement: Remove workspace (SRS-FR-004)
When the user chooses Bỏ folder in the Folder Menu of a workspace, the system SHALL delete that workspace from the Workspace List without deleting any Claude Code session history of its folder.

Traces: SRS-FR-004 ← BR-01 ← BO-02

#### Scenario: Removing a workspace keeps the folder and its history
- **GIVEN** the Workspace List contains `mokairo` and the folder `mokairo` has Claude Code session history on disk
- **WHEN** the user chooses Bỏ folder in the Folder Menu of `mokairo`
- **THEN** `mokairo` is no longer in the Folder Tree
- **AND** the folder and every Claude Code session history file of it are unchanged on disk

#### Scenario: Adding the folder again finds its sessions
- **GIVEN** `mokairo` has 12 sessions and the user removed it with Bỏ folder
- **WHEN** the user adds `mokairo` again with "Thêm folder" and selects it
- **THEN** its 12 sessions are listed again

### Requirement: Add Folder after the Folder Tree
The system SHALL show "Thêm folder" as a row right after the last group of the Folder Tree, and SHALL put it after every row of the Folder Tree in the keyboard tab order.

Traces: SRS-FR-001 ← BR-01 ← BO-02

#### Scenario: After the stash group
- **GIVEN** `agent-deck` has an open session, `mokairo` has none, and one session is stashed
- **WHEN** the Folder Tree is shown
- **THEN** the rows read `agent-deck` with its Session Row, "Folder khác (1)", "Để dành (1)" with its row, then "Thêm folder"

#### Scenario: Scrolls with the tree
- **GIVEN** the Folder Tree is taller than the Sidebar
- **WHEN** the user scrolls the Sidebar to the top
- **THEN** "Thêm folder" is scrolled out of view with the end of the tree
- **AND** scrolling to the bottom shows it right after the last group

#### Scenario: Last in tab order
- **GIVEN** the Workspace List contains `alpha` and there are no open or stashed sessions
- **WHEN** the user tabs past the "Folder khác (1)" group
- **THEN** "Thêm folder" has focus

## REMOVED Requirements

### Requirement: Remove control on demand
**Reason**: CR-016 moves removal into the Folder Menu (SRS-FR-004 now says "chooses Bỏ folder in the Folder Menu"); the folder row no longer has a hover × of its own.
**Migration**: Open ⋯ on the workspace row and choose Bỏ folder (Folder Menu (SRS-FR-143)); the menu is reachable by keyboard. Removing a workspace with open panes is still refused by SRS-FR-006.

## ADDED Requirements

### Requirement: Other Folders (SRS-FR-141)
While a workspace has no session open in a pane, the system SHALL list it in the group "Folder khác (<n>)" at the end of the Folder Tree, collapsed by default unless no workspace has a session open in a pane.

Traces: SRS-FR-141 ← BR-01 ← BO-02

#### Scenario: Idle workspaces folded away
- **GIVEN** the Workspace List contains `agent-deck`, `mokairo` and `notes`, and only `agent-deck` has a pane open
- **WHEN** the Folder Tree is shown
- **THEN** it has the row `agent-deck` with its Session Row, then the collapsed group "Folder khác (2)"
- **AND** opening that group shows `mokairo` and `notes`

#### Scenario: Opening a session takes the workspace out of the group
- **GIVEN** the Folder Tree shows "Folder khác (2)" holding `mokairo` and `notes`
- **WHEN** the user opens a session of `mokairo` in a pane
- **THEN** `mokairo` is a workspace row of its own with its Session Row
- **AND** the group reads "Folder khác (1)"

#### Scenario: Nothing open, the group starts open (CR-017)
- **GIVEN** the Workspace List contains three workspaces and no pane is open
- **WHEN** the Folder Tree is shown
- **THEN** "Folder khác (3)" is expanded and shows all three workspaces

#### Scenario: The user's fold is kept while nothing is open
- **GIVEN** no pane is open and the user collapsed "Folder khác (3)"
- **WHEN** the Folder Tree re-renders without any pane opening
- **THEN** the group stays collapsed

#### Scenario: Closing the last pane opens the group again
- **GIVEN** `agent-deck` has the only open pane and "Folder khác (2)" is collapsed
- **WHEN** that pane closes
- **THEN** "Folder khác (3)" is expanded

#### Scenario: Above the stash group
- **GIVEN** `notes` has no open pane and one session is stashed
- **WHEN** the Folder Tree is shown
- **THEN** "Folder khác (1)" comes before "Để dành (1)"

### Requirement: Folder Menu (SRS-FR-143)
When the user chooses ⋯ on a workspace row, the system SHALL show the Folder Menu with Xem file, Bỏ folder and Chép đường dẫn.

Traces: SRS-FR-143 ← BR-01 ← BO-02

#### Scenario: Menu of a workspace with open sessions
- **GIVEN** `mokairo` has a pane open
- **WHEN** the user chooses ⋯ on the row `mokairo`
- **THEN** the Folder Menu shows the three items Xem file, Bỏ folder and Chép đường dẫn

#### Scenario: Menu of a workspace in Folder khác
- **GIVEN** the group "Folder khác (1)" is open and holds `notes`
- **WHEN** the user chooses ⋯ on the row `notes`
- **THEN** the Folder Menu shows Xem file, Bỏ folder and Chép đường dẫn for `notes`

#### Scenario: Xem file waits for the Files View
- **GIVEN** the Files View (SRS-FR-174, backlog item 44) is not built yet
- **WHEN** the user opens the Folder Menu of `mokairo`
- **THEN** Xem file is shown disabled and choosing it does nothing

#### Scenario: Bỏ folder on a workspace with open panes
- **GIVEN** `mokairo` has 2 open panes
- **WHEN** the user chooses Bỏ folder in its Folder Menu
- **THEN** `mokairo` stays in the Folder Tree
- **AND** the message "Đóng các phiên đang mở của folder này trước" is shown (SRS-FR-006)

#### Scenario: Closed with Esc
- **GIVEN** the Folder Menu of `mokairo` is open
- **WHEN** the user presses Esc
- **THEN** the menu closes, nothing is removed or copied, and focus returns to the ⋯ of `mokairo`

### Requirement: Copy workspace path (SRS-FR-144)
When the user chooses Chép đường dẫn in the Folder Menu, the system SHALL copy the absolute path of that workspace folder to the clipboard.

Traces: SRS-FR-144 ← BR-01 ← BO-02

#### Scenario: Paste the copied path
- **GIVEN** the workspace `mokairo` is the folder `/Users/mionix/Project/mokairo`
- **WHEN** the user chooses Chép đường dẫn in its Folder Menu and pastes into a terminal
- **THEN** the pasted text is `/Users/mionix/Project/mokairo`

#### Scenario: Copying does not change the tree
- **GIVEN** `mokairo` is in the Folder Tree
- **WHEN** the user chooses Chép đường dẫn in its Folder Menu
- **THEN** the menu closes and `mokairo` and its Session Rows are unchanged
