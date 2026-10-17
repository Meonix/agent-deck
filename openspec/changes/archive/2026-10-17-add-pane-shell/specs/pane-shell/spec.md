## ADDED Requirements

### Requirement: Open the pane shell (SRS-FR-055)
Traces: SRS-FR-055 ← BR-05 ← BO-01

When the user chooses Shell on a pane that has no Pane Shell, the system SHALL open a Pane Shell below the session in that pane, running the operating system's default shell in the workspace folder.

#### Scenario: Shell opens in the workspace folder
- **GIVEN** the pane "agent-deck · Scaffold Tauri app" has no Pane Shell
- **WHEN** the user chooses Shell on that pane
- **THEN** a Pane Shell appears below the session, 30% of the pane high
- **AND** typing `pwd` in it prints the path of the `agent-deck` folder

#### Scenario: Default shell of the platform
- **GIVEN** the app runs on macOS
- **WHEN** a Pane Shell opens
- **THEN** it runs the user's login shell
- **AND** on Windows it runs PowerShell

### Requirement: Hide the pane shell (SRS-FR-056)
Traces: SRS-FR-056 ← BR-05 ← BO-01

When the user chooses Shell on a pane whose Pane Shell is visible, the system SHALL hide the Pane Shell and keep its process running.

#### Scenario: Hidden shell keeps serving
- **GIVEN** the Pane Shell runs `npm run dev`
- **WHEN** the user chooses Shell
- **THEN** the Pane Shell is no longer visible and the session takes the whole pane
- **AND** the server still answers at `localhost:1420`

### Requirement: Show the pane shell again (SRS-FR-057)
Traces: SRS-FR-057 ← BR-05 ← BO-01

When the user chooses Shell on a pane whose Pane Shell is hidden, the system SHALL show the Pane Shell with its previous output and height.

#### Scenario: Output and height come back
- **GIVEN** the Pane Shell was hidden at 40% of the pane while `npm run dev` kept printing
- **WHEN** the user chooses Shell
- **THEN** the Pane Shell shows again at 40% of the pane
- **AND** it shows the lines `npm run dev` printed while it was hidden

### Requirement: Hidden shell marker (SRS-FR-058)
Traces: SRS-FR-058 ← BR-05 ← BO-01

While a pane's Pane Shell is hidden, the system SHALL show a running marker on that pane's Shell button.

#### Scenario: Marker with the running command
- **GIVEN** the Pane Shell runs `npm run dev`
- **WHEN** the user hides it
- **THEN** the Shell button shows a marker and the text `npm run dev`

#### Scenario: Marker at the prompt
- **GIVEN** the Pane Shell waits at its prompt
- **WHEN** the user hides it
- **THEN** the Shell button shows a marker and the text "Shell"

#### Scenario: No marker without a hidden shell
- **GIVEN** a pane with no Pane Shell, and a pane whose Pane Shell is visible
- **WHEN** the user looks at their Shell buttons
- **THEN** neither shows a marker

### Requirement: Resize the pane shell (SRS-FR-059)
Traces: SRS-FR-059 ← BR-05 ← BO-01

When the user drags the divider between the session and the Pane Shell, the system SHALL resize both to follow the divider.

#### Scenario: Drag the divider up
- **GIVEN** a pane with a visible Pane Shell
- **WHEN** the user drags the divider up by 100 px
- **THEN** the Pane Shell is 100 px taller and the session area 100 px shorter

### Requirement: Reflow the pane shell (SRS-FR-060)
Traces: SRS-FR-060 ← BR-05 ← BO-01

When the Pane Shell changes size, the system SHALL fit the Pane Shell's content to its new size.

#### Scenario: Divider drag resizes the shell terminal
- **GIVEN** a visible Pane Shell
- **WHEN** the user drags the divider
- **THEN** the shell process is resized to the new terminal size of the Pane Shell

#### Scenario: Maximize resizes the shell terminal
- **GIVEN** a pane with a visible Pane Shell running `htop`
- **WHEN** the user maximizes the pane
- **THEN** the shell process is resized to the larger terminal size

### Requirement: Shell exits (SRS-FR-061)
Traces: SRS-FR-061 ← BR-05 ← BO-01

When the Pane Shell's process exits, the system SHALL close the Pane Shell.

#### Scenario: exit closes the shell area
- **GIVEN** a visible Pane Shell
- **WHEN** the user types `exit` in it
- **THEN** the Pane Shell closes, the session takes the whole pane and the Shell button has no marker

#### Scenario: A new shell after exit
- **GIVEN** the Pane Shell of a pane has exited
- **WHEN** the user chooses Shell
- **THEN** a new Pane Shell opens without the old output

### Requirement: Close pane ends its shell (SRS-FR-062)
Traces: SRS-FR-062 ← BR-05 ← BO-01

When the user closes a pane, the system SHALL end the Pane Shell process of that pane.

#### Scenario: Hidden shell ends with its pane
- **GIVEN** a hidden Pane Shell runs `npm run dev`
- **WHEN** the user closes the pane and confirms
- **THEN** the shell process and `npm run dev` end, and `localhost:1420` stops answering

#### Scenario: Deleting an open session ends its shell
- **GIVEN** the session of a pane with a Pane Shell is deleted (SRS-FR-049)
- **WHEN** the pane closes
- **THEN** the shell process of that pane ends

### Requirement: Confirm closing a pane with a busy shell (SRS-FR-063)
Traces: SRS-FR-063 ← BR-05 ← BO-01

If the user closes a pane whose Pane Shell is running a command, then the system SHALL ask for confirmation before closing that pane.

#### Scenario: Busy hidden shell asks first
- **GIVEN** the session is `Idle` and the hidden Pane Shell runs `npm run dev`
- **WHEN** the user closes the pane
- **THEN** the dialog "A command is still running in the shell. Close anyway?" appears
- **AND** choosing Cancel keeps the pane and the shell running

#### Scenario: Shell at its prompt does not ask
- **GIVEN** the session is `Idle` and the Pane Shell waits at its prompt
- **WHEN** the user closes the pane
- **THEN** the pane closes without a dialog

#### Scenario: Busy session and busy shell ask once
- **GIVEN** the session is `Running` and the Pane Shell runs `npm run dev`
- **WHEN** the user closes the pane
- **THEN** exactly one confirmation dialog appears

### Requirement: Shell outlives the session (SRS-FR-064)
Traces: SRS-FR-064 ← BR-05 ← BO-01

While the session in a pane has ended, the system SHALL keep that pane's Pane Shell running.

#### Scenario: /exit leaves the shell running
- **GIVEN** a pane whose Pane Shell runs `npm run dev`
- **WHEN** the user types `/exit` in Claude Code
- **THEN** the pane shows "Session ended"
- **AND** the Pane Shell still runs and accepts input

### Requirement: Report shell start failure (SRS-FR-065)
Traces: SRS-FR-065 ← BR-05 ← BO-01

If the Pane Shell cannot start, then the system SHALL show the message "Shell could not start" in that pane and keep the session running.

#### Scenario: Default shell cannot run
- **GIVEN** the default shell cannot be started
- **WHEN** the user chooses Shell on a `Running` pane
- **THEN** the pane shows "Shell could not start"
- **AND** the session stays `Running` and the Shell button has no marker
