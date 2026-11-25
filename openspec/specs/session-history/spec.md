# session-history Specification

## Purpose
TBD - created by archiving change add-session-history. Update Purpose after archive.
## Requirements
### Requirement: List sessions of a workspace (SRS-FR-007)
When the user chooses + on a workspace row, the system SHALL open the Session Chooser listing every Claude Code session that belongs to that workspace per RULE-02.

Traces: SRS-FR-007 ← BR-02 ← BO-02

The Session Chooser is a 440px modal dialog centred over a 45% scrim. Its header shows the workspace name and ×; below it come the primary button "Phiên mới", the label "Mở lại phiên cũ" and the session rows. While it is open, keyboard focus stays inside it. The sessions are read again every time it opens.

#### Scenario: Three sessions
- **GIVEN** the workspace `agent-deck` has 3 Claude Code sessions started in `/Users/mionix/Project/personal/agent-deck`
- **WHEN** the user chooses + on the row `agent-deck`
- **THEN** the Session Chooser opens in the middle of the window with the header `agent-deck`, the button "Phiên mới" and 3 session rows
- **AND** the panes keep their size

#### Scenario: + on a workspace inside Folder khác
- **GIVEN** `mokairo` has no open pane and is listed in the open "Folder khác" group
- **WHEN** the user chooses + on the row `mokairo`
- **THEN** the Session Chooser of `mokairo` opens

#### Scenario: Workspace name opens it too
- **GIVEN** the Folder Tree shows the row `agent-deck`
- **WHEN** the user clicks the name `agent-deck`
- **THEN** the Session Chooser of `agent-deck` opens, as with + (additional trigger approved by the PO at GATE 1)
- **AND** the row `agent-deck` is the selected workspace

#### Scenario: Session started in a subfolder
- **GIVEN** a session started in `/Users/mionix/Project/agent-deck/ui`
- **WHEN** the user opens the Session Chooser of the workspace `/Users/mionix/Project/agent-deck`
- **THEN** that session is not in the Session Chooser

#### Scenario: Session created outside the app
- **GIVEN** the user started a new Claude Code session in the folder from a terminal outside agent-deck
- **WHEN** the user opens the Session Chooser of that workspace again
- **THEN** the new session is in the Session Chooser

#### Scenario: Keyboard stays in the chooser
- **GIVEN** the Session Chooser of `agent-deck` is open and a pane is open behind it
- **WHEN** the user presses Tab repeatedly
- **THEN** keyboard focus moves only between the controls of the Session Chooser and never reaches the Sidebar or the pane

#### Scenario: Skeleton while reading
- **GIVEN** the sessions of `agent-deck` are still being read
- **WHEN** the Session Chooser of `agent-deck` opens
- **THEN** it shows skeleton rows and no "Đang tải" text

#### Scenario: No pane open points to +
- **GIVEN** at least one workspace is listed and no pane is open
- **THEN** the pane area reads "Chưa mở phiên nào" and "Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ."
- **AND** it has no "Phiên mới" button

### Requirement: Show session title and last activity (SRS-FR-008)
The system SHALL show the title per RULE-01 and the last activity time of each session in the Session Chooser.

Traces: SRS-FR-008 ← BR-02 ← BO-02

#### Scenario: Titled session active 2 minutes ago
- **GIVEN** a session whose Claude Code title is "Scaffold Tauri app" and whose last activity was 2 minutes ago
- **THEN** its row in the Session Chooser shows "Scaffold Tauri app" and "2 phút trước"

### Requirement: Report unreadable sessions (SRS-FR-011)
If one or more sessions of the workspace of the Session Chooser cannot be read, then the system SHALL show the notice "<N> sessions could not be read" in the Session Chooser.

Traces: SRS-FR-011 ← BR-02 ← BO-02

#### Scenario: Two broken sessions out of ten
- **GIVEN** a workspace with 10 sessions, 2 of which cannot be read
- **WHEN** the user opens its Session Chooser
- **THEN** the Session Chooser shows 8 sessions and the notice "2 phiên không đọc được"

### Requirement: Mark live sessions (SRS-FR-012)
While a session is open in a pane, the system SHALL mark that session as `Live` in the Session Chooser.

Traces: SRS-FR-012 ← BR-02 ← BO-02

The `Live` row shows the chip "Đang mở" in place of the relative time and carries no Status Highlight; the state shows on its Session Row in the Folder Tree (SRS-FR-032).

#### Scenario: Session open in a pane
- **GIVEN** the session "Scaffold Tauri app" is open in a pane
- **WHEN** the user opens the Session Chooser of its workspace
- **THEN** its row carries the chip "Đang mở"

#### Scenario: Live row needing approval is not highlighted
- **GIVEN** the session "Scaffold Tauri app" is open in a pane and `Needs Approval`
- **WHEN** the user opens the Session Chooser of its workspace
- **THEN** its row carries "Đang mở" and has no Status Highlight background, chip or detail line

#### Scenario: Pane closed
- **GIVEN** the session "Scaffold Tauri app" was open in a pane
- **WHEN** the user closes that pane and opens the Session Chooser of its workspace
- **THEN** its row shows its relative time and no "Đang mở" chip

### Requirement: Session list load time (SRS-NFR-003)
When the user opens the Session Chooser of a workspace with up to 200 sessions, the system SHALL list its sessions within 3 seconds.

Traces: SRS-NFR-003 ← BR-02 ← BO-02

#### Scenario: 200 sessions
- **GIVEN** a workspace with 200 sessions
- **WHEN** the user chooses + on its row
- **THEN** the Session Chooser lists all 200 sessions less than 3 seconds after the click

### Requirement: Read-only session history (SRS-NFR-005)
The system SHALL NOT modify any Claude Code session history on the machine other than moving a session the user deletes to the operating system's trash.

Traces: SRS-NFR-005 ← BRD §8 constraint

#### Scenario: Listing leaves files untouched
- **GIVEN** the session files of a workspace
- **WHEN** the user opens the Session Chooser of the workspace and its list is read
- **THEN** every session file has the same content and modification time as before

#### Scenario: Only the deleted session moves
- **GIVEN** a workspace with the sessions "Scaffold Tauri app" and "Init repo"
- **WHEN** the user deletes "Scaffold Tauri app"
- **THEN** only the files of "Scaffold Tauri app" are moved to the trash
- **AND** the files of "Init repo" have the same content and modification time as before

### Requirement: Data stays on the machine (SRS-NFR-007)
The system SHALL NOT send session content or session history to any network destination.

Traces: SRS-NFR-007 ← BRD §8 constraint

#### Scenario: Listing opens no connection
- **WHEN** the user opens the Session Chooser of a workspace and its session list is read
- **THEN** the app opens no network connection for it

#### Scenario: Working in a pane sends nothing
- **GIVEN** a pane running a Claude Code session
- **WHEN** the user works in it for 30 minutes
- **THEN** the app sends none of that session's content anywhere, itself or through a Claude Code run it starts

### Requirement: Delete a session (SRS-FR-047)
When the user confirms deleting a session, the system SHALL move that session's history to the operating system's trash and remove the session from the Session Chooser.

Traces: SRS-FR-047 ← BR-08 ← BO-02

#### Scenario: Session goes to the Trash
- **GIVEN** the Session Chooser of the folder lists "Scaffold Tauri app"
- **WHEN** the user deletes it and confirms
- **THEN** its session file and its session folder are in the Trash
- **AND** its row is gone from the Session Chooser, which stays open

#### Scenario: Restored from the Trash
- **GIVEN** the files of a deleted session were put back from the Trash
- **WHEN** the user chooses + on the folder row
- **THEN** the session is in the Session Chooser again

#### Scenario: Only a session of that folder
- **GIVEN** a session id that does not belong to the folder of the Session Chooser
- **WHEN** a delete is requested for it
- **THEN** no file is moved

### Requirement: Confirm deleting a session (SRS-FR-048)
When the user chooses Delete on a row of the Session Chooser, the system SHALL ask "Move "<title>" to Trash?" before deleting.

Traces: SRS-FR-048 ← BR-08 ← BO-02

Delete is the trash icon on the row; it shows while the row is hovered or holds keyboard focus. The confirm dialog opens above the Session Chooser.

#### Scenario: Ask first
- **GIVEN** the Session Chooser lists "Scaffold Tauri app"
- **WHEN** the user chooses the trash icon on that row
- **THEN** a dialog above the Session Chooser asks "Chuyển "Scaffold Tauri app" vào Thùng rác?"
- **AND** no pane opens

#### Scenario: Trash icon on demand
- **GIVEN** the Session Chooser lists "Scaffold Tauri app"
- **WHEN** the pointer is not over its row and nothing in the row has focus
- **THEN** its trash icon is not visible
- **AND** tabbing into the row shows it

#### Scenario: Cancel keeps the session
- **GIVEN** the delete dialog for "Scaffold Tauri app" is open
- **WHEN** the user chooses "Huỷ" or presses Esc
- **THEN** only the delete dialog closes; the Session Chooser stays open and still lists the session
- **AND** no file is moved

### Requirement: Delete an open session (SRS-FR-049)
If the user confirms deleting a session that is open in a pane, then the system SHALL end that session and close its pane before moving its history to the trash.

Traces: SRS-FR-049 ← BR-08 ← BO-02

#### Scenario: Running session in pane 2
- **GIVEN** "Research PTY crates" is `Running` in pane 2
- **WHEN** the user chooses Delete on its row
- **THEN** the dialog asks "Close "Research PTY crates" and move it to Trash?"
- **WHEN** the user confirms
- **THEN** pane 2 closes and its session ends before its files are moved to the trash

### Requirement: Report delete failure (SRS-FR-050)
If a session's history cannot be moved to the trash, then the system SHALL keep that session in the Session Chooser and show the message "Session could not be deleted".

Traces: SRS-FR-050 ← BR-08 ← BO-02

#### Scenario: File cannot be moved
- **GIVEN** the session file of "Scaffold Tauri app" cannot be moved
- **WHEN** the user deletes it from the Session Chooser and confirms
- **THEN** "Scaffold Tauri app" is still in the Session Chooser
- **AND** the message "Không xoá được phiên" shows above the Session Chooser

### Requirement: Order session history (SRS-FR-009)
The system SHALL order the Session Chooser by last activity time, newest first.

Traces: SRS-FR-009 ← BR-02 ← BO-02

#### Scenario: Newer above older
- **GIVEN** session A was last active yesterday and session B 2 minutes ago
- **WHEN** the user opens the Session Chooser of their workspace
- **THEN** B is listed above A

### Requirement: Empty session history (SRS-FR-010)
If the workspace of the Session Chooser has no session, then the system SHALL show the message "No sessions yet" in the Session Chooser.

Traces: SRS-FR-010 ← BR-02 ← BO-02

#### Scenario: Brand-new folder
- **GIVEN** a workspace where Claude Code has never run
- **WHEN** the user chooses + on its row
- **THEN** the Session Chooser shows "Chưa có phiên nào" under "Mở lại phiên cũ"
- **AND** the button "Phiên mới" is still there

### Requirement: Add the new session to the session history (SRS-FR-019)
When a new session starts in a pane, the system SHALL add that session to the Session Chooser of its workspace.

Traces: SRS-FR-019 ← BR-04 ← BO-02

#### Scenario: New session in agent-deck
- **GIVEN** the user chose "Phiên mới" in the Session Chooser of `agent-deck` and its pane is open
- **WHEN** the user chooses + on the row `agent-deck`
- **THEN** the Session Chooser of `agent-deck` has one more row, at the top, with the chip "Đang mở"

### Requirement: Select a session (SRS-FR-073)
When the user ticks the checkbox of a row in the Session Chooser, the system SHALL add that session to the Session Selection.

Traces: SRS-FR-073 ← BR-08 ← BO-02

#### Scenario: Tick two rows
- **GIVEN** the Session Chooser lists "Scaffold Tauri app" and "Fix login bug"
- **WHEN** the user ticks both rows
- **THEN** the Session Selection holds those 2 sessions

#### Scenario: Ticking opens nothing
- **GIVEN** no pane is open and the Session Chooser is open
- **WHEN** the user ticks a row
- **THEN** no pane opens and the Session Chooser stays open

#### Scenario: Untick
- **GIVEN** two rows are ticked
- **WHEN** the user unticks one of them
- **THEN** the Session Selection holds only the other one

### Requirement: Delete selected action (SRS-FR-074)
While the Session Selection is not empty, the system SHALL show the actions "Delete selected (<n>)" and "Select all" in the Session Chooser, where <n> is the number of selected sessions.

Traces: SRS-FR-074 ← BR-08 ← BO-02

The actions sit in a footer below the rows; "Xoá đã chọn (<n>)" is red.

#### Scenario: Two ticked rows
- **GIVEN** two rows are ticked
- **THEN** the Session Chooser shows "Xoá đã chọn (2)" and "Chọn tất cả" below the rows

#### Scenario: Nothing ticked
- **GIVEN** the user unticks every row
- **THEN** neither "Xoá đã chọn" nor "Chọn tất cả" is shown

### Requirement: Select all sessions (SRS-FR-075)
When the user chooses Select all, the system SHALL add every session listed in the Session Chooser to the Session Selection.

Traces: SRS-FR-075 ← BR-08 ← BO-02

#### Scenario: Select all from one
- **GIVEN** the Session Chooser lists 5 sessions and 1 is ticked
- **WHEN** the user chooses "Chọn tất cả"
- **THEN** the Session Chooser shows "Xoá đã chọn (5)"

### Requirement: Clear the selection (SRS-FR-076)
When the Session Chooser closes, the system SHALL empty the Session Selection.

Traces: SRS-FR-076 ← BR-08 ← BO-02

#### Scenario: Close and reopen
- **GIVEN** two sessions are ticked in the Session Chooser of `agent-deck`
- **WHEN** the user closes it and chooses + on `agent-deck` again
- **THEN** no row is ticked

#### Scenario: Closed by opening a session
- **GIVEN** two sessions are ticked in the Session Chooser of `agent-deck`
- **WHEN** the user chooses "Phiên mới" and later opens the Session Chooser of `agent-deck` again
- **THEN** no row is ticked

### Requirement: Confirm deleting selected sessions (SRS-FR-077)
When the user chooses Delete selected, the system SHALL ask "Move <n> sessions to Trash?" before deleting.

Traces: SRS-FR-077 ← BR-08 ← BO-02

#### Scenario: Nothing open
- **GIVEN** 3 sessions are selected and none is open in a pane
- **WHEN** the user chooses "Xoá đã chọn (3)"
- **THEN** a dialog above the Session Chooser asks "Chuyển 3 phiên vào Thùng rác?"

#### Scenario: One open
- **GIVEN** 3 sessions are selected and 1 of them is open in a pane
- **WHEN** the user chooses "Xoá đã chọn (3)"
- **THEN** the dialog asks "Đóng 1 phiên đang mở và chuyển 3 phiên vào Thùng rác?"

#### Scenario: Cancel
- **GIVEN** the dialog for 3 selected sessions is shown
- **WHEN** the user chooses "Huỷ"
- **THEN** no session is moved to the trash
- **AND** the Session Chooser is still open with the 3 rows ticked

### Requirement: Delete selected sessions (SRS-FR-078)
When the user confirms deleting the selected sessions, the system SHALL delete each selected session as in SRS-FR-047 and SRS-FR-049.

Traces: SRS-FR-078 ← BR-08 ← BO-02

#### Scenario: Three sessions, one running
- **GIVEN** 3 sessions are selected and 1 of them is `Running` in pane 2
- **WHEN** the user confirms
- **THEN** pane 2 closes, all 3 sessions are moved to the trash and their rows disappear from the Session Chooser, which stays open
- **AND** the Session Selection is empty

### Requirement: Report partial delete failure (SRS-FR-079)
If some selected sessions cannot be moved to the trash, then the system SHALL keep those sessions in the Session Chooser and in the Session Selection and show the message "<k> of <n> sessions deleted".

Traces: SRS-FR-079 ← BR-08 ← BO-02

#### Scenario: One of three locked
- **GIVEN** 3 sessions are selected and the file of 1 of them cannot be moved
- **WHEN** the user confirms
- **THEN** 2 rows disappear from the Session Chooser, the remaining row stays ticked
- **AND** the message "Đã xoá 2/3 phiên" is shown

### Requirement: Close and move to Trash (SRS-FR-101)
When the user chooses Close and move to Trash in the Close Dialog, the system SHALL close that pane and then move that session's history to the operating system's trash.

Traces: SRS-FR-101 ← BR-08 ← BO-02

#### Scenario: Idle session trashed on close
- **GIVEN** the session "Fix login bug" is `Idle` in a pane
- **WHEN** the user presses the pane's close button and chooses "Đóng và chuyển vào Thùng rác"
- **THEN** the pane disappears and its session has ended
- **AND** "Fix login bug" is no longer listed in the Session Chooser of its workspace and its history is in the trash
- **AND** no "Chuyển … vào Thùng rác?" dialog was shown

#### Scenario: Running session trashed on close
- **GIVEN** a pane is `Running` and its Close Dialog shows "Phiên vẫn đang chạy."
- **WHEN** the user chooses "Đóng và chuyển vào Thùng rác"
- **THEN** the session ends, the pane closes and the history is moved to the trash

### Requirement: Report delete failure after close (SRS-FR-102)
If the history of a session closed with Close and move to Trash cannot be moved to the trash, then the system SHALL keep that session in the Session Chooser and show the message "Session could not be deleted".

Traces: SRS-FR-102 ← BR-08 ← BO-02

#### Scenario: Locked history file
- **GIVEN** the history of the session in a pane cannot be moved to the trash
- **WHEN** the user chooses "Đóng và chuyển vào Thùng rác" in its Close Dialog
- **THEN** the pane is closed and "Không xoá được phiên" is shown
- **AND** the session is still listed in the Session Chooser of its workspace

### Requirement: Close the Session Chooser (SRS-FR-054)
When the user chooses Close on the Session Chooser, clicks outside it or presses Esc, the system SHALL close the Session Chooser.

Traces: SRS-FR-054 ← BR-02 ← BO-02

Opening a session (SRS-FR-013, SRS-FR-018) also closes it. When it closes without opening a pane, keyboard focus returns to the control that opened it.

#### Scenario: Close button
- **GIVEN** the Session Chooser of `agent-deck` is open
- **WHEN** the user chooses × on it
- **THEN** the Session Chooser closes and no pane opens
- **AND** keyboard focus is back on the + of `agent-deck`

#### Scenario: Click outside
- **GIVEN** the Session Chooser of `agent-deck` is open
- **WHEN** the user clicks the scrim outside the dialog
- **THEN** the Session Chooser closes and no pane opens

#### Scenario: Esc
- **GIVEN** the Session Chooser of `agent-deck` is open
- **WHEN** the user presses Esc
- **THEN** the Session Chooser closes and the Esc does not reach any pane

#### Scenario: Open again and read again
- **GIVEN** the Session Chooser of `agent-deck` was closed
- **WHEN** the user chooses + on `agent-deck` again
- **THEN** the Session Chooser opens and the sessions of `agent-deck` are read again (SRS-FR-007)

