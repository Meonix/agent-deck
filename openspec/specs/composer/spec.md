# composer Specification

## Purpose

The Composer of a pane: the input under the Chat view that sends prompts to the session only while Claude Code is waiting for one, stops a running turn, and recalls earlier prompts.

## Requirements

### Requirement: Send a prompt (SRS-FR-154)
When the user sends a prompt from the Composer while the session is Input Ready, the system SHALL deliver that prompt to the session as if it were typed and submitted in Term.

Traces: SRS-FR-154 ← BR-12 ← BO-05

Input Ready follows RULE-12 (design.md › Input Ready). Enter sends; Shift+Enter adds a line.

#### Scenario: Send from Idle
- **GIVEN** a pane whose session is `Idle` and shows Claude Code's empty input box
- **WHEN** the user types "chạy lại test" in the Composer and presses Enter
- **THEN** the session receives "chạy lại test" as a submitted prompt, exactly as if typed in Term
- **AND** the session turns `Running` and the Composer is empty

#### Scenario: Multi-line Vietnamese prompt
- **GIVEN** the session is Input Ready
- **WHEN** the user types "sửa lỗi đăng nhập", presses Shift+Enter, types "rồi chạy test" and presses Enter
- **THEN** the session receives one prompt of two lines, "sửa lỗi đăng nhập" and "rồi chạy test"

#### Scenario: Empty prompt is not sent
- **GIVEN** the session is Input Ready and the Composer holds only spaces
- **WHEN** the user presses Enter
- **THEN** nothing reaches the session

### Requirement: Lock the Composer (SRS-FR-155)
While the session of a pane is not Input Ready, the system SHALL disable sending from the Composer and show why.

Traces: SRS-FR-155 ← BR-12 ← BO-05

The user can still type in the Composer and in Term while it is locked.

#### Scenario: Waiting for approval
- **GIVEN** Claude Code shows its permission dialog in a pane
- **WHEN** the user looks at the Composer
- **THEN** the send button is disabled and the Composer reads "Claude Code đang chờ duyệt"

#### Scenario: Screen not recognised
- **GIVEN** the session's screen does not match Claude Code's known input box layout
- **WHEN** the user looks at the Composer
- **THEN** the send button is disabled and the Composer reads "Không nhận ra màn hình Claude Code — gõ ở Term"

#### Scenario: Text typed in Term
- **GIVEN** the user typed "hello" in Claude Code's input box in Term without submitting
- **WHEN** the user looks at the Composer
- **THEN** sending is disabled with "Không nhận ra màn hình Claude Code — gõ ở Term"

#### Scenario: Enter while locked
- **GIVEN** the Composer is locked and holds "chạy lại test"
- **WHEN** the user presses Enter
- **THEN** nothing reaches the session and the Composer still holds "chạy lại test"

#### Scenario: Session ended
- **GIVEN** the session of a pane has ended
- **WHEN** the user looks at the Composer
- **THEN** sending is disabled and the Composer reads "Phiên đã kết thúc"

### Requirement: Never answer a dialog (SRS-FR-156)
If a Claude Code dialog is showing when a prompt is about to be delivered, then the system SHALL keep the prompt in the Composer and not deliver it.

Traces: SRS-FR-156 ← BR-12 ← BO-05

#### Scenario: Dialog appears just before delivery
- **GIVEN** the Composer shows the session as Input Ready and holds "1 thêm test"
- **AND** Claude Code shows its permission dialog before the screen check runs again
- **WHEN** the user presses Enter
- **THEN** no key reaches the session, the dialog is still waiting, and the Composer still holds "1 thêm test"

### Requirement: Stop a turn (SRS-FR-157)
While the session is `Running`, the system SHALL show a Stop button in the Composer that interrupts the current turn as Esc does in Term.

Traces: SRS-FR-157 ← BR-12 ← BO-05

#### Scenario: Stop a long command
- **GIVEN** the session is `Running` a long `npm test`
- **WHEN** the user presses Stop in the Composer
- **THEN** the session receives Esc and Claude Code interrupts the turn

#### Scenario: No Stop when Idle
- **GIVEN** the session is `Idle`
- **WHEN** the user looks at the Composer
- **THEN** it shows the send button and no Stop button

### Requirement: Prompt history (SRS-FR-158)
When the user presses ↑ in an empty Composer, the system SHALL fill it with the previous prompt sent from that pane.

Traces: SRS-FR-158 ← BR-12 ← BO-05

#### Scenario: Recall the last prompt
- **GIVEN** "chạy lại test" was sent from pane 1 and pane 1's Composer is empty
- **WHEN** the user presses ↑ in pane 1's Composer
- **THEN** pane 1's Composer holds "chạy lại test"

#### Scenario: Other panes keep their own history
- **GIVEN** "chạy lại test" was sent from pane 2 only
- **WHEN** the user presses ↑ in pane 1's empty Composer
- **THEN** pane 1's Composer does not hold "chạy lại test"

#### Scenario: Older prompts
- **GIVEN** pane 1 sent "một" and then "hai"
- **WHEN** the user presses ↑ twice in its empty Composer
- **THEN** the Composer holds "một"

### Requirement: Command suggestions (SRS-FR-159)
When the user types "/" at the start of the Composer, the system SHALL suggest the built-in commands, the user's and the workspace's commands and skills, and the commands of enabled plugins, filtered by the text typed after "/".

Traces: SRS-FR-159 ← BR-12 ← BO-05

A command matches when its name, or the part of it after ":", starts with the typed text, ignoring case. The menu closes once the text holds a space or a line break after the command.

#### Scenario: Built-in command and user skill
- **GIVEN** a pane of `agent-deck` and a user skill `commit` in `~/.claude/skills`
- **WHEN** the user types "/com" in the empty Composer
- **THEN** a command menu shows `/compact` and `/commit`
- **AND** `/commit` is marked "skill"

#### Scenario: "/" not at the start
- **GIVEN** an empty Composer
- **WHEN** the user types "sửa a/b"
- **THEN** no menu is shown

#### Scenario: Plugin command
- **GIVEN** the plugin `superpowers` is enabled and holds the skill `brainstorming`
- **WHEN** the user types "/brain"
- **THEN** the menu shows `/superpowers:brainstorming` marked "plugin"

#### Scenario: Disabled plugin
- **GIVEN** the plugin `superpowers` is installed but not enabled
- **WHEN** the user types "/brain"
- **THEN** the menu does not show `/superpowers:brainstorming`

#### Scenario: Workspace command
- **GIVEN** the workspace has `.claude/commands/opsx/apply.md`
- **WHEN** the user types "/opsx"
- **THEN** the menu shows `/opsx:apply` marked "lệnh"

#### Scenario: Choose a command
- **GIVEN** the command menu is open on "/comm" with `/commit` highlighted
- **WHEN** the user presses Enter
- **THEN** the Composer reads "/commit " and the menu closes
- **AND** nothing reaches the session

### Requirement: File suggestions (SRS-FR-160)
When the user types "@" in the Composer, the system SHALL suggest up to 8 files and folders of the session's workspace folder, excluding hidden and git-ignored files, filtered by the text typed after "@".

Traces: SRS-FR-160 ← BR-12 ← BO-05

"@" opens the menu at the start of the Composer or after a space or a line break. A path is hidden when any of its parts starts with ".". In a folder without git the folder is walked and only hidden files are left out.

#### Scenario: File by name
- **GIVEN** a pane of `agent-deck`
- **WHEN** the user types "@App"
- **THEN** a file menu of at most 8 rows shows `src/App.tsx`

#### Scenario: Ignored and hidden files
- **GIVEN** a pane of `agent-deck`, where git ignores `node_modules` and `.env` is a hidden file
- **WHEN** the user types "@node_modules" or "@.env"
- **THEN** no row shows `node_modules` or `.env`

#### Scenario: Folder without git
- **GIVEN** a workspace folder that is not a git repository and holds `notes.md`, `docs/` and `.cache/`
- **WHEN** the user types "@"
- **THEN** the menu shows `notes.md` and `docs/` and no row under `.cache`

#### Scenario: Choose a file in a sentence
- **GIVEN** the Composer reads "Xem lại @src/comp" and the file menu highlights `src/components/PaneGrid.tsx`
- **WHEN** the user presses Tab
- **THEN** the Composer reads "Xem lại @src/components/PaneGrid.tsx " and the menu closes

#### Scenario: Choose a folder
- **GIVEN** the file menu highlights the folder `src/components/`
- **WHEN** the user presses Enter
- **THEN** the Composer reads "@src/components/" and the menu stays open on the files under it

#### Scenario: Close the menu
- **GIVEN** a menu is open
- **WHEN** the user presses Esc
- **THEN** the menu closes, the text is unchanged and nothing reaches the session
- **AND** ↑ and ↓ move the highlight only while a menu is open
