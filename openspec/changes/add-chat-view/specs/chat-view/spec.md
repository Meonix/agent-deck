## Purpose

The Chat view of a pane: the session's conversation read from its transcript and shown as messages, kept up to date, and the Activity Bar of what a running session is doing.

## ADDED Requirements

### Requirement: Chat messages (SRS-FR-149)
While a pane shows Chat, the system SHALL show the conversation of its session as messages: user prompts, Claude Code replies, and each tool call with its result.

Traces: SRS-FR-149 ← BR-11 ← BO-05

The conversation is read from the session's transcript and never written (SRS-NFR-005). Layout follows `design.html` › `#final`; the tool card's main argument is in design.md › Tool card.

#### Scenario: Prompt, tool call and reply
- **GIVEN** the session "Fix login bug" has the prompt "sửa lỗi đăng nhập", then a Read call on `src/login.ts` with its result, then the reply "Đã sửa lỗi token hết hạn."
- **WHEN** the user chooses Chat in its pane
- **THEN** Chat shows, in order, the bubble "sửa lỗi đăng nhập", a tool card "Read src/login.ts" and the text "Đã sửa lỗi token hết hạn."
- **AND** opening the tool card shows the result of the Read call

#### Scenario: Thinking and meta records are not shown
- **GIVEN** the transcript holds a thinking block and a meta user record next to the prompt and the reply
- **WHEN** the pane shows Chat
- **THEN** only the prompt bubble and the reply text are shown

#### Scenario: Loading
- **GIVEN** a session with a long transcript
- **WHEN** the user chooses Chat before the transcript has been read
- **THEN** Chat shows the skeleton bars of `design.html` › `#loading` and no "Đang tải" text

#### Scenario: Subagent records are not shown
- **GIVEN** a subagent of the session wrote its own prompts and replies
- **WHEN** the pane shows Chat
- **THEN** Chat shows the tool card of the call that started the subagent and none of the subagent's own messages

#### Scenario: New session without a conversation
- **GIVEN** a pane opened a new session and no prompt has been sent
- **WHEN** the user chooses Chat
- **THEN** the Chat body is empty and shows no error

#### Scenario: Chat does not stop the session
- **GIVEN** a pane whose session is `Running`
- **WHEN** the user switches the pane to Chat
- **THEN** the session is still `Running` and its process has not been stopped or restarted

### Requirement: Chat update latency (SRS-FR-150)
When the session writes a new conversation entry, the system SHALL show it in Chat within 1 second.

Traces: SRS-FR-150 ← BR-11 ← BO-05

#### Scenario: Reply shows within a second
- **GIVEN** a pane shows Chat
- **WHEN** Claude Code appends a reply to the transcript at 14:02:00
- **THEN** Chat shows the reply before 14:02:01

#### Scenario: Twenty entries in a row
- **GIVEN** a pane shows Chat
- **WHEN** 20 entries are appended to the transcript one after another
- **THEN** each entry is shown in Chat no later than 1 second after it was written

#### Scenario: Entries written while Chat is hidden
- **GIVEN** a pane shows Term and its session writes three new entries
- **WHEN** the user chooses Chat
- **THEN** Chat shows the three entries at once

### Requirement: Follow a cleared conversation (SRS-FR-151)
When the session of a pane moves to a new conversation, the system SHALL show the new conversation in Chat.

Traces: SRS-FR-151 ← BR-11 ← BO-05

#### Scenario: After /clear
- **GIVEN** a pane shows Chat with an earlier conversation
- **WHEN** the user runs `/clear` in Term and then sends "viết test cho login"
- **THEN** Chat shows only the new conversation, starting with "viết test cho login"

#### Scenario: Old conversation is not shown again
- **GIVEN** the pane's session moved to a new conversation
- **WHEN** the old conversation's transcript is written again
- **THEN** Chat still shows only the new conversation

### Requirement: Activity Bar (SRS-FR-152)
While a session is `Running`, the system SHALL show in the Activity Bar the tool currently running, the share of context used and the number of background shells and subagents.

Traces: SRS-FR-152 ← BR-11 ← BO-05

The strip at the bottom of the Chat view, laid out as `design.html` › `activity()`. A part not known yet or with a count of 0 is left out. Counting rules are in design.md › Activity state.

#### Scenario: Everything known
- **GIVEN** a pane shows Chat and its session is `Running`
- **AND** Claude Code is running Bash `npm test`, has used 42% of its context, has 1 background shell running and 2 subagents running
- **WHEN** the user looks at the Activity Bar
- **THEN** it reads "Bash npm test · 42% context · 1 shell · 2 subagent"

#### Scenario: Zero counts are left out
- **GIVEN** a `Running` session running Read `src/login.ts` with 12% context used and no background shell or subagent
- **WHEN** the user looks at the Activity Bar
- **THEN** it reads "Read src/login.ts · 12% context"

#### Scenario: Context share not reported yet
- **GIVEN** a `Running` session running Bash `npm install` before Claude Code reported any context share
- **WHEN** the user looks at the Activity Bar
- **THEN** it reads "Bash npm install"

#### Scenario: A background shell is stopped
- **GIVEN** the Activity Bar shows "1 shell" for the background shell `npm run dev`
- **WHEN** Claude Code stops that shell with a tool call, or reports it no longer running when its turn ends
- **THEN** the Activity Bar shows no shell count

#### Scenario: Not Running
- **GIVEN** a pane shows Chat and its session is `Idle`
- **WHEN** the user looks at the bottom of the Chat view
- **THEN** no Activity Bar is shown

#### Scenario: A subagent finishes
- **GIVEN** the Activity Bar shows "2 subagent"
- **WHEN** one subagent stops
- **THEN** the Activity Bar shows "1 subagent"

### Requirement: Unreadable conversation (SRS-FR-153)
If the conversation of a session cannot be read, then the system SHALL show "Không đọc được hội thoại, xem ở Term" in Chat.

Traces: SRS-FR-153 ← BR-11 ← BO-05

The conversation cannot be read when its transcript file exists but cannot be opened or read, or when it holds user or assistant records and none of them has a shape the app recognizes (Claude Code changed its format). A single damaged line among readable ones is skipped.

#### Scenario: Unrecognized format
- **GIVEN** a session whose transcript holds only user and assistant records in a shape the app does not recognize
- **WHEN** the user chooses Chat in its pane
- **THEN** Chat shows "Không đọc được hội thoại, xem ở Term"
- **AND** choosing Term shows the session terminal, which still takes input

#### Scenario: File cannot be read
- **GIVEN** the session's transcript file exists but reading it fails
- **WHEN** the pane shows Chat
- **THEN** Chat shows "Không đọc được hội thoại, xem ở Term"

#### Scenario: One damaged line
- **GIVEN** a transcript with a prompt, a line that is not valid JSON, and a reply
- **WHEN** the pane shows Chat
- **THEN** Chat shows the prompt and the reply and no error
