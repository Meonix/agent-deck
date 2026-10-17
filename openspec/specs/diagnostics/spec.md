# diagnostics Specification

## Purpose
TBD - created by archiving change add-diagnostic-log. Update Purpose after archive.
## Requirements
### Requirement: Diagnostic log file
The system SHALL write diagnostic events to a local log file in the app log folder, keeping at most 3 files of 5 MB each.

#### Scenario: Rotation
- **GIVEN** the log file has reached 5 MB
- **WHEN** another event is written
- **THEN** the file is renamed to `agent-deck.log.1` (older ones shift up, the fourth is deleted) and the event starts a new `agent-deck.log`

#### Scenario: Line format
- **WHEN** an event is written
- **THEN** it is one line: UTC time, level (`INFO`, `WARN`, `ERROR`), source, message

### Requirement: Record errors and crashes
The system SHALL record backend panics, backend errors and uncaught UI errors in the diagnostic log.

#### Scenario: Panic
- **WHEN** a backend thread panics
- **THEN** an `ERROR` line with the panic message and its source location is in the log before the process ends

#### Scenario: Uncaught UI error
- **WHEN** a UI script throws an uncaught error or a promise rejects unhandled
- **THEN** an `ERROR` line with the message is in the log

#### Scenario: Error storm
- **WHEN** the UI reports more than 20 errors within one minute
- **THEN** only the first 20 are written, followed by one `WARN` line saying how many were dropped

### Requirement: Health samples
The system SHALL write a health line every 60 seconds with the memory and CPU use of the app and of each pane's Claude Code process.

#### Scenario: Two panes open
- **GIVEN** two panes are running sessions
- **WHEN** a minute passes
- **THEN** an `INFO` health line lists the app's memory and CPU, the pane count, and memory and CPU per pane process

### Requirement: Warn on suspected leaks and loops
The system SHALL write a `WARN` line when app memory grows across 10 samples in a row, when app CPU stays above 90 % for 30 seconds, when a pane's process is still alive 5 seconds after its pane closed, or when the UI's terminals or title timers do not match the open panes.

#### Scenario: Busy loop
- **GIVEN** the app's CPU has been above 90 % for 30 seconds
- **THEN** one `WARN` line names the suspected busy loop with the CPU figures, and no new one is written until CPU has dropped below 90 %

#### Scenario: Process survives its pane
- **WHEN** a pane is closed and its process is still running 5 seconds later
- **THEN** a `WARN` line names the pane and the surviving process id

### Requirement: Nothing private in the log
The system SHALL NOT write terminal output, keystrokes, prompts or session file contents to the diagnostic log.

#### Scenario: Pane write fails
- **WHEN** writing a keystroke to a pane fails
- **THEN** the log line has the error but not the data that was being written

