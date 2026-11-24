# app-shell Specification

## Purpose
TBD - created by archiving change add-workspace-list. Update Purpose after archive.
## Requirements
### Requirement: Supported platforms (SRS-NFR-004)
The system SHALL run as an installed desktop application on macOS 14 or later and on Windows 11.

Traces: SRS-NFR-004 ← BRD §8 constraint

#### Scenario: Demo script passes on macOS
- **WHEN** the application built for macOS is installed and opened on macOS 26
- **THEN** every scenario of the `workspace-list` capability passes in the demo script

#### Scenario: Demo script passes on Windows 11
- **WHEN** the application built for Windows is installed and opened on Windows 11
- **THEN** every scenario of the `workspace-list` capability passes in the demo script

### Requirement: Interface language (SRS-NFR-008)
The system SHALL display its own labels and messages in Vietnamese, as listed in the Bảng nhãn of SRS section 7.

Traces: SRS-NFR-008 ← BR-06 ← BO-01

#### Scenario: Labels and messages are Vietnamese
- **WHEN** the user looks at the Folders section, the empty state and any message of the application
- **THEN** every label and message is in Vietnamese, such as "Thêm folder", "Không còn" and "Đóng các phiên đang mở của folder này trước"

#### Scenario: No English label left
- **WHEN** the user opens a pane, the Session History Panel and the Close Dialog
- **THEN** buttons and messages read "Phiên mới", "Mở lại", "Xoá", "Huỷ", "Đóng" and "Đóng và chuyển vào Thùng rác", not their English originals

