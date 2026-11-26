## Why

CR-016 (approved 2026-11-24) adds BO-05, "work with a session without typing in the terminal": BR-11 (Must) asks that the user can read a session as a conversation of prompts, replies, tool calls with their results, plus the tool running now and the share of context used. Backlog item 38 builds the Chat view and its Activity Bar (SRS v1.17, SRS-FR-149 to SRS-FR-153). Today the View Switch shows "Chat" disabled and the only way to follow a session is its terminal.

## What Changes

- "Chat" in the View Switch becomes choosable (SRS-FR-146 is modified: only "Plan" stays disabled until item 43).
- Choosing Chat shows the session's conversation as messages: the user's prompts as bubbles on the right, Claude Code's replies as text on the left, and each tool call as a card (tool name and its main argument) that opens to its result (SRS-FR-149; `design/agent-deck/cr016/design.html` › `#final`, `chatBody()`, `.bubble`, `.tool`).
- A new entry written by the session appears in Chat within 1 second (SRS-FR-150).
- When the session moves to a new conversation (as after `/clear`), Chat shows only the new conversation (SRS-FR-151).
- While the session is `Running`, an Activity Bar at the bottom of the Chat view shows the tool running, the share of context used and the number of background shells and subagents, e.g. "Bash npm test · 42% context · 1 shell · 2 subagent" (SRS-FR-152; `design.html` › `activity()`).
- A conversation that cannot be read shows "Không đọc được hội thoại, xem ở Term" in Chat, and Term keeps working (SRS-FR-153; `design.html` › `#error`, `ERR_CHAT`).
- While Chat is still reading the conversation, it shows the skeleton of `design.html` › `#loading` (`LOADING_CHAT`), no "Đang tải" text.
- The session is launched with an inline `statusLine` (through the same `--settings` as the hooks) so the app learns the share of context used; a status line the user configured keeps showing in Term because the app's command runs it (SRS-NFR-006: nothing is written to the user's Claude Code settings).
- Unchanged on purpose: panes still open in Term with keyboard focus in the session terminal (SRS-FR-014); opening in Chat with focus in the Composer is SRS-FR-147, moved to backlog item 39 by CR-019. No Composer, Approval Strip, Question Card or Plan.

## Success Criteria

- SC-1: In a pane whose session has the prompt "sửa lỗi đăng nhập", a `Read src/login.ts` call and a reply, choosing Chat shows the prompt bubble, a tool card "Read src/login.ts" that opens to its result, then the reply text.
- SC-2: 20 conversation entries appended one after another to the session's transcript each appear in Chat no later than 1 second after being written.
- SC-3: After `/clear` and the prompt "viết test cho login", Chat holds only the new conversation, starting with "viết test cho login".
- SC-4: While the session is `Running` `npm test` with 42% context used, 1 background shell and 2 subagents, the Activity Bar reads "Bash npm test · 42% context · 1 shell · 2 subagent"; when the session is not `Running` the Activity Bar is not shown.
- SC-5: A transcript whose records are all unreadable shows "Không đọc được hội thoại, xem ở Term" in Chat, and choosing Term still shows the working session terminal.
- SC-6: With a user status line configured, the session terminal in Term still shows that status line's text.

## Capabilities

### New Capabilities

- `chat-view`: the Chat view of a pane — conversation as messages (SRS-FR-149), update latency (SRS-FR-150), following a cleared conversation (SRS-FR-151), the Activity Bar (SRS-FR-152), the unreadable-conversation message (SRS-FR-153).

### Modified Capabilities

- `pane-views`: "Chat" in the View Switch is enabled; only "Plan" stays disabled (SRS-FR-146).
- `session-pane`: the note under "Focus the new pane" (SRS-FR-014) points SRS-FR-147 to backlog item 39 (add-composer) instead of item 38.
- `status-board`: "No machine-wide Claude Code configuration change" (SRS-NFR-006) also covers the inline `statusLine` and the extra hook events.

## Impact

- Backend (`src-tauri/src/`): new `transcript.rs` (parse records into chat items, tail the transcript file), new `activity.rs` (Activity Bar state from hook events and status line input); `hooks.rs` posts `SubagentStart`/`SubagentStop` and builds the `statusLine` setting; `pane_commands.rs` feeds both from the pane's hook sink and the session follower and sends `{"chat": …}` and `{"activity": …}` on the pane channel; reading the user's own `statusLine` from their settings files (read only).
- Frontend: `src/api/sessions.ts` stream gains `onChat` and `onActivity`; new `src/components/ChatView.tsx` and `ActivityBar.tsx`; `ViewSwitch.tsx` enables Chat; `useSessionPanes.ts` keeps chat items and activity per pane; `TerminalPane.tsx` adds the Chat layer; `src/labels.ts` adds the Chat and Activity Bar strings; `.bubble`, `.tool`, `.callout-err`, `.skel` from the design in `src/index.css`.
- No new dependency; no change to the pane snapshot, the session list or any Claude Code file on disk (SRS-NFR-005).
