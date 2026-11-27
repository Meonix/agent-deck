## ADDED Requirements

### Requirement: Attach files (SRS-FR-161)
When the user pastes or drops files into the Composer, the system SHALL store each file as a Prompt File and insert its absolute path into the prompt.

Traces: SRS-FR-161 ← BR-12 ← BO-05

A Prompt File is a copy in the app's data folder, outside every repository. Paths are inserted at the caret, one after another, each followed by a space. Each attached file shows as a chip with its name and size; the chip's × takes its path out of the prompt.

#### Scenario: Paste a screenshot
- **GIVEN** an empty Composer
- **WHEN** the user pastes a screenshot `screenshot.png` of 214 KB
- **THEN** the image is stored as a Prompt File in the app's data folder
- **AND** the Composer reads the absolute path of that Prompt File followed by a space
- **AND** a chip shows "screenshot.png · 214 KB"

#### Scenario: Drop a file on a pane
- **GIVEN** two panes are open
- **WHEN** the user drops `log.txt` on pane 2's Composer
- **THEN** `log.txt` is copied as a Prompt File and its path is inserted in pane 2's Composer only
- **AND** the original `log.txt` is unchanged

#### Scenario: Claude Code reads the attached file
- **GIVEN** the Composer holds the path of a pasted image and the words "ảnh này có chữ gì?"
- **WHEN** the user sends the prompt while the session is Input Ready
- **THEN** Claude Code reads the image at that path and answers about it

#### Scenario: Insert at the caret
- **GIVEN** the Composer reads "xem lỗi trong " with the caret at the end
- **WHEN** the user pastes `a.png` and `b.png`
- **THEN** the Composer reads "xem lỗi trong <path of a.png> <path of b.png> "

#### Scenario: Remove an attachment
- **GIVEN** the Composer holds the path of `a.png` and the words "giải thích"
- **WHEN** the user presses × on the `a.png` chip
- **THEN** the path of `a.png` is no longer in the prompt and "giải thích" stays

#### Scenario: A dropped folder is skipped
- **GIVEN** an empty Composer
- **WHEN** the user drops the folder `docs/`
- **THEN** nothing is stored and the prompt is unchanged

### Requirement: Attachment size limit (SRS-FR-162)
If an attached file is larger than 50 MB, then the system SHALL reject that file and show "File lớn hơn 50 MB".

Traces: SRS-FR-162 ← BR-12 ← BO-05

50 MB is 50 × 1024 × 1024 bytes. The error chip stays until its × is pressed or the prompt is sent.

#### Scenario: Large file dropped with a small one
- **GIVEN** an empty Composer
- **WHEN** the user drops `demo.mov` of 120 MB together with `log.txt` of 2 KB
- **THEN** `demo.mov` is not stored and a chip reads "demo.mov · File lớn hơn 50 MB"
- **AND** `log.txt` is stored and its path is inserted in the prompt

#### Scenario: Large file pasted
- **GIVEN** an empty Composer
- **WHEN** the user pastes a 60 MB file
- **THEN** nothing is stored, the prompt is unchanged and a chip reads "<name> · File lớn hơn 50 MB"
