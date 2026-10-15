## ADDED Requirements

### Requirement: Supported platforms (SRS-NFR-004)
Traces: SRS-NFR-004 ← BRD §8 constraint

The system SHALL run as an installed desktop application on macOS 14 or later and on Windows 11.

#### Scenario: Demo script passes on macOS
- **WHEN** the application built for macOS is installed and opened on macOS 26
- **THEN** every scenario of the `workspace-list` capability passes in the demo script

#### Scenario: Demo script passes on Windows 11
- **WHEN** the application built for Windows is installed and opened on Windows 11
- **THEN** every scenario of the `workspace-list` capability passes in the demo script

### Requirement: Interface language (SRS-NFR-008)
Traces: SRS-NFR-008 ← BR-06 ← BO-01

The system SHALL display its own labels and messages in English.

#### Scenario: Labels and messages are English
- **WHEN** the user looks at the Folders section, the empty state and any message of the application
- **THEN** every label and message is in English, such as "+ Add Folder", "Missing" and "Close the open sessions of this folder first"
