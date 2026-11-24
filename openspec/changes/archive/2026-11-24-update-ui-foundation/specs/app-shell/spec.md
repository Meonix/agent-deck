## MODIFIED Requirements

### Requirement: Interface language (SRS-NFR-008)
The system SHALL display its own labels and messages in Vietnamese, as listed in the Bảng nhãn of SRS section 7.

Traces: SRS-NFR-008 ← BR-06 ← BO-01

#### Scenario: Labels and messages are Vietnamese
- **WHEN** the user looks at the Folders section, the empty state and any message of the application
- **THEN** every label and message is in Vietnamese, such as "Thêm folder", "Không còn" and "Đóng các phiên đang mở của folder này trước"

#### Scenario: No English label left
- **WHEN** the user opens a pane, the Session History Panel and the Close Dialog
- **THEN** buttons and messages read "Phiên mới", "Mở lại", "Xoá", "Huỷ", "Đóng" and "Đóng và chuyển vào Thùng rác", not their English originals
