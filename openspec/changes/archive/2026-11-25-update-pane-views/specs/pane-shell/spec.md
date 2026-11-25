## REMOVED Requirements

### Requirement: Resize the pane shell (SRS-FR-059)
**Reason**: CR-016 — the Pane Shell fills the whole pane body in the Shell view, so there is no divider between the session and the Pane Shell. SRS-FR-059 is `Deleted (CR-016)`.
**Migration**: switch between the session terminal and the Pane Shell with the View Switch (SRS-FR-146, SRS-FR-055 to SRS-FR-057); the Pane Shell follows the pane size (SRS-FR-060), which the user changes with the divider between panes (SRS-FR-023) or Phóng to (SRS-FR-041).

## MODIFIED Requirements

### Requirement: Open the pane shell (SRS-FR-055)
When the user chooses Shell in the View Switch of a pane that has no Pane Shell, the system SHALL start a Pane Shell running the operating system's default shell in the workspace folder and show it over the whole pane body.

Traces: SRS-FR-055 ← BR-05 ← BO-01

The default shell is the user's login shell on macOS and PowerShell on Windows. The pane switches to the Shell view once the Pane Shell has started; until then it keeps showing its current view.

#### Scenario: Shell opens in the workspace folder
- **GIVEN** the pane "agent-deck · Scaffold Tauri app" shows Term and has no Pane Shell
- **WHEN** the user chooses Shell in its View Switch
- **THEN** the pane body shows a shell prompt in the `agent-deck` folder over the whole body, with no divider and no session terminal next to it
- **AND** typing `pwd` in it prints the path of the `agent-deck` folder

#### Scenario: Input goes to the shell
- **GIVEN** a pane shows its Pane Shell
- **WHEN** the user types `ls` and Enter
- **THEN** the Pane Shell receives `ls` and the Claude Code session receives nothing

#### Scenario: Default shell of the platform
- **GIVEN** the app runs on macOS
- **WHEN** a Pane Shell opens
- **THEN** it runs the user's login shell
- **AND** on Windows it runs PowerShell

### Requirement: Hide the pane shell (SRS-FR-056)
When the user switches a pane from Shell to another view, the system SHALL hide the Pane Shell and keep its process running.

Traces: SRS-FR-056 ← BR-05 ← BO-01

#### Scenario: Hidden shell keeps serving
- **GIVEN** a pane shows Shell and its Pane Shell runs `npm run dev`
- **WHEN** the user chooses Term in its View Switch
- **THEN** the pane body shows the session terminal and the Pane Shell is not visible
- **AND** the server still answers at `localhost:1420`

### Requirement: Show the pane shell again (SRS-FR-057)
When the user chooses Shell in the View Switch of a pane whose Pane Shell is hidden, the system SHALL show the Pane Shell with its previous output.

Traces: SRS-FR-057 ← BR-05 ← BO-01

#### Scenario: Output comes back
- **GIVEN** a pane's Pane Shell runs `npm run dev` and the user switched the pane to Term
- **WHEN** `npm run dev` prints more lines and the user chooses Shell
- **THEN** the pane body shows the Pane Shell with the lines printed before and while it was hidden
- **AND** no second Pane Shell is started

#### Scenario: Keyboard goes to the shown shell
- **GIVEN** a pane shows Term and has a hidden Pane Shell
- **WHEN** the user chooses Shell
- **THEN** keyboard focus is in the Pane Shell

### Requirement: Hidden shell marker (SRS-FR-058)
While a pane's Pane Shell is hidden and running a command, the system SHALL show the name of that command on the Shell item of the View Switch.

Traces: SRS-FR-058 ← BR-05 ← BO-01

#### Scenario: Command name on the Shell item
- **GIVEN** a pane's Pane Shell runs `npm run dev`
- **WHEN** the user switches the pane to Term
- **THEN** the Shell item of its View Switch reads "Shell · npm run dev"

#### Scenario: Hidden shell at the prompt
- **GIVEN** a pane's Pane Shell waits at its prompt
- **WHEN** the user switches the pane to Term
- **THEN** the Shell item reads "Shell" with no command name

#### Scenario: No command name without a hidden shell
- **GIVEN** a pane with no Pane Shell, and a pane that shows its Pane Shell running `npm run dev`
- **WHEN** the user looks at their View Switches
- **THEN** both Shell items read "Shell"

### Requirement: Reflow the pane shell (SRS-FR-060)
When the Pane Shell changes size, the system SHALL fit the Pane Shell's content to its new size.

Traces: SRS-FR-060 ← BR-05 ← BO-01

This covers changing the pane size (SRS-FR-023) and maximizing and restoring the pane (SRS-FR-041, SRS-FR-042); the session terminal still follows SRS-FR-024.

#### Scenario: Maximize resizes the shell terminal
- **GIVEN** a pane shows its Pane Shell running `htop`
- **WHEN** the user maximizes the pane
- **THEN** the shell process is resized to the larger terminal size and `htop` redraws to fit it

#### Scenario: Pane divider resizes the shell terminal
- **GIVEN** two panes side by side and the left one shows its Pane Shell
- **WHEN** the user drags the divider between the panes 200 px to the right
- **THEN** the shell process of the left pane is resized to its wider terminal size

#### Scenario: Hidden shell after a resize
- **GIVEN** a pane shows Term and has a hidden Pane Shell
- **WHEN** the user maximizes the pane and then chooses Shell
- **THEN** the shell process has the terminal size of the maximized pane body by the time the Pane Shell shows

### Requirement: Shell exits (SRS-FR-061)
When the Pane Shell's process exits, the system SHALL close the Pane Shell.

Traces: SRS-FR-061 ← BR-05 ← BO-01

A pane that showed the Pane Shell returns to the view it showed before Shell, which is Term while Chat and Plan are disabled.

#### Scenario: exit returns to the previous view
- **GIVEN** a pane switched from Term to Shell
- **WHEN** the user types `exit` in the Pane Shell
- **THEN** the pane shows Term and the Shell item reads "Shell" with no command name

#### Scenario: Hidden shell exits
- **GIVEN** a pane shows Term and has a hidden Pane Shell
- **WHEN** the shell process exits, for example because it is killed
- **THEN** the pane keeps showing Term and the Shell item reads "Shell"

#### Scenario: A new shell after exit
- **GIVEN** the Pane Shell of a pane has exited
- **WHEN** the user chooses Shell
- **THEN** a new Pane Shell opens without the old output

### Requirement: Report shell start failure (SRS-FR-065)
If the Pane Shell cannot start, then the system SHALL show the message "Shell could not start" in that pane and keep the session running.

Traces: SRS-FR-065 ← BR-05 ← BO-01

#### Scenario: Default shell cannot run
- **GIVEN** the default shell cannot be started
- **WHEN** the user chooses Shell on a `Running` pane that shows Term
- **THEN** the pane shows "Không khởi động được shell"
- **AND** the pane still shows Term, the session stays `Running` and the Shell item reads "Shell" with no command name

### Requirement: Shell outlives an abnormal exit (SRS-FR-064)
While the session in a pane has exited abnormally, the system SHALL keep that pane's Pane Shell running.

Traces: SRS-FR-064 ← BR-05 ← BO-01

#### Scenario: Crash leaves the shell running
- **GIVEN** a pane shows Term and its hidden Pane Shell runs `npm run dev`
- **WHEN** the Claude Code process of that pane is killed
- **THEN** the Term view shows "Session ended"
- **AND** choosing Shell shows the Pane Shell still running `npm run dev` and accepting input

#### Scenario: /exit ends the shell with the pane
- **GIVEN** a pane whose Pane Shell runs `npm run dev`
- **WHEN** the user types `/exit` in Claude Code
- **THEN** the pane closes and its Pane Shell process has ended (SRS-FR-083)
