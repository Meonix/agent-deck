## Why

CR-016 BO-05 is "work with a session without typing in the terminal". BR-12 (Must) asks that the user sends prompts from the pane's own input, and that a prompt is never sent while Claude Code is not waiting for one. Item 38 made the conversation readable in Chat, but every prompt still has to be typed in Term. Backlog item 39 adds the Composer (SRS v1.17, SRS-FR-154 to SRS-FR-158), and with it panes open in Chat (SRS-FR-147, moved here by CR-019).

## What Changes

- A Composer under the Chat view (and its Activity Bar): an input that grows with its text, plus a send button. It follows `design/agent-deck/cr016/design.html` › `composer()`, `.field`, `.send`, `.send-off`, `.stop`, `#final`, `#error`.
- Enter sends and Shift+Enter adds a line. A prompt is delivered to the session as if typed and submitted in Term, but only while the session is Input Ready (RULE-12) (SRS-FR-154).
- Input Ready is read from the session's own terminal screen:
  - Claude Code's input box is showing and empty;
  - no Claude Code dialog is showing;
  - the screen matches the known layout.
  Otherwise sending is disabled and the Composer says why:
  - "Claude Code đang chờ duyệt" for a dialog or `Needs Approval`;
  - "Không nhận ra màn hình Claude Code — gõ ở Term" when the screen is not recognised;
  - "Phiên đã kết thúc" when the session ended (SRS-FR-155).
- Just before delivery the screen is checked again. If a dialog appeared meanwhile, nothing reaches the session and the prompt stays in the Composer (SRS-FR-156).
- While the session is `Running`, the send button becomes a Stop button that interrupts the turn as Esc does in Term (SRS-FR-157).
- ↑ in an empty Composer brings back the previous prompt sent from that pane (SRS-FR-158).
- Panes open in Chat with keyboard focus in the Composer. This applies to new panes, resumed panes and panes reopened at launch (SRS-FR-147). This replaces "panes open in Term" from items 37 and 38.
- Choosing Chat in the View Switch puts keyboard focus in the Composer.
- Unchanged on purpose:
  - Term keeps taking typed input.
  - Composer menus for "/" and "@" (item 41), attachments (item 42), the Approval Strip and the Question Card (item 40), and Plan (item 43) are not part of this change.
  - Windows (ConPTY) behaviour is verified later, at the user's request. This change is built and verified on macOS.

## Success Criteria

- SC-1: In a pane whose session is `Idle` at an empty input box, typing "chạy lại test" in the Composer and pressing Enter makes the session receive exactly that text as a submitted prompt. The session turns `Running` and the Composer is empty.
- SC-2: While Claude Code shows its permission dialog, the Composer's send is disabled and reads "Claude Code đang chờ duyệt". Pressing Enter sends nothing and leaves the prompt in the Composer.
- SC-3: A prompt sent when a dialog appears between typing and delivery is not delivered; the dialog is still waiting and the prompt is still in the Composer.
- SC-4: While the session is `Running`, the Composer shows a Stop button. Pressing it interrupts the turn the way Esc in Term does. While the session is `Idle`, no Stop button is shown.
- SC-5: After "chạy lại test" was sent from pane 1, pressing ↑ in pane 1's empty Composer fills it with "chạy lại test". Pressing ↑ in pane 2 does not.
- SC-6: Choosing "Phiên mới" opens a pane showing Chat with keyboard focus in its Composer. A pane reopened at launch also shows Chat.

## Capabilities

### New Capabilities

- `composer`: the Composer of a pane. It covers send (SRS-FR-154), lock with reason (SRS-FR-155), never answering a dialog (SRS-FR-156), Stop (SRS-FR-157), and prompt history (SRS-FR-158).

### Modified Capabilities

- `pane-views`:
  - panes open in Chat with focus in the Composer (SRS-FR-147, added);
  - the View Switch (SRS-FR-146) no longer says panes open in Term, a relaunch reopens panes in Chat, and choosing Chat puts focus in the Composer.
- `session-pane`: "Focus the new pane" (SRS-FR-014) puts keyboard focus in the Composer of a pane opening in Chat.

## Impact

- Frontend only:
  - New `src/components/inputReady.ts`, a pure screen reader for RULE-12.
  - New `src/components/Composer.tsx`.
  - `TerminalAdapter` gains a read of the visible screen and of bracketed-paste mode.
  - `useSessionPanes.ts`: the view starts at Chat, plus per-pane prompt history and send/stop through the existing `SessionsClient.write`.
  - `TerminalPane.tsx`: the Composer sits in the Chat layer.
  - `src/labels.ts` and `src/index.css`: `.field`, `.send`, `.send-off`, `.stop`.
- No backend, PTY command, hook or dependency change. The prompt goes through the same `pane_write` as typed input, so status tracking sees it like a prompt typed in Term (`UserPromptSubmit`).
