## ADDED Requirements

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
