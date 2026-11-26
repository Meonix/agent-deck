## MODIFIED Requirements

### Requirement: No machine-wide Claude Code configuration change (SRS-NFR-006)
The system SHALL NOT change the user's machine-wide Claude Code settings.

Traces: SRS-NFR-006 ← BRD §8 constraint

The hooks and the status line the app uses for status tracking, Chat and the Activity Bar are passed to each session it launches through the inline `--settings` argument and are never written to a settings file. The user's own status line settings are only read, so the app's status line can run the user's command and show its text.

#### Scenario: Settings untouched after use
- **GIVEN** the Claude Code settings files under `~/.claude/` before the app is used
- **WHEN** the user opens panes, works in them and closes them
- **THEN** those settings files are byte-for-byte the same as before

#### Scenario: The user's status line still shows
- **GIVEN** the user's Claude Code settings set a status line command that prints "main · 3 files"
- **WHEN** a pane runs a session and the user looks at Term
- **THEN** the session terminal shows "main · 3 files" in its status line
- **AND** the user's settings files are byte-for-byte the same as before

#### Scenario: No user status line
- **GIVEN** the user's Claude Code settings set no status line
- **WHEN** a pane runs a session
- **THEN** the session terminal shows no status line text from the app
