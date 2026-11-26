## Why

CR-016 BO-05 is "work with a session without typing in the terminal". BR-13 (Must) asks that the user approves or denies a permission request, and answers Claude Code's multiple-choice questions, with buttons, after seeing clearly which tool and command is being asked for. Item 39 added the Composer, but it locks with "Claude Code đang chờ duyệt" whenever a dialog shows, so every answer still has to be typed in Term. Backlog item 40 adds the Approval Strip, the Question Card and plan approval (SRS v1.17, SRS-FR-163 to SRS-FR-168).

## What Changes

- **Approval Strip** (SRS-FR-163). While a session waits on a tool permission, its pane shows a strip above the Composer: the tool name, its command or file ("Bash · npm install", "Edit · src/main.rs"), and the buttons Cho phép and Từ chối. It follows `design/agent-deck/cr016/design.html` › `strip()` and `.strip`, `.allow`, `.deny`.
- **Answer a permission** (SRS-FR-164). Cho phép and Từ chối answer the request as if the user had chosen Yes or No in Claude Code's own dialog.
- **Stale answer** (SRS-FR-165). Just before the answer is delivered, the session's terminal screen is read again. If the request is no longer the one shown (already answered, or replaced), nothing is sent and the pane shows "Yêu cầu đã thay đổi".
- **Question Card** (SRS-FR-166). While Claude Code asks the user to choose among options (AskUserQuestion), the pane shows the question, each option, a "Khác…" field and the button Gửi. The chosen option, or the text typed in "Khác…", is delivered as the answer. It follows `design.html` › `#question` (QCARD).
- **Plan approval** (SRS-FR-167). While Claude Code asks to leave plan mode (ExitPlanMode), the pane shows the plan with the buttons Duyệt kế hoạch and Tiếp tục lên kế hoạch, the latter with a feedback field. It follows `design.html` › `#question` (PCARD). Duyệt kế hoạch chooses "Yes, manually approve edits", so later edits still come through the Approval Strip (agreed at GATE 1).
- **Answer in Term still works** (SRS-FR-168). Claude Code's dialog stays in Term while the strip or card shows, and the user can answer it there. Once it is answered, from either place, the strip or card goes away.
- Unchanged on purpose:
  - Term keeps its dialogs and keys.
  - The Composer keeps locking while a dialog shows (item 39).
  - Windows (ConPTY) behaviour is verified later, at the user's request. This change is built and verified on macOS.

## Success Criteria

- SC-1: While Claude Code asks permission to run `npm install`, the pane shows "Bash · npm install" with Cho phép and Từ chối.
- SC-2: Pressing Cho phép makes Claude Code run the command; the strip disappears and the session leaves `Needs Approval`. Pressing Từ chối makes Claude Code not run it.
- SC-3: After the request was answered in Term, pressing Cho phép on a strip still showing sends nothing and shows "Yêu cầu đã thay đổi".
- SC-4: For a question with options `zod` and `yup`, the card shows the question, both options, "Khác…" and Gửi. Choosing `zod` and Gửi delivers `zod`. Typing "valibot" in "Khác…" and Gửi delivers "valibot".
- SC-5: When Claude Code asks to leave plan mode, the card shows the plan with Duyệt kế hoạch and Tiếp tục lên kế hoạch. Typing "thêm bước viết test" and choosing Tiếp tục lên kế hoạch keeps the session in plan mode with that feedback.
- SC-6: While the strip shows, answering `1` in Term makes the request answered and the strip disappears.

## Capabilities

### New Capabilities

- `chat-approval`: the Approval Strip, the Question Card and plan approval of a pane (SRS-FR-163 to SRS-FR-168).

### Modified Capabilities

None. The conversation feed of `chat-view` gains the question and plan data that the cards read, but what Chat shows does not change.

## Impact

- Backend: `src-tauri/src/transcript.rs` adds, to a tool item, the question and options of AskUserQuestion. The plan is read from the terminal screen, because ExitPlanMode's transcript input can hold an older plan. No new command, hook or dependency.
- Frontend:
  - New `src/components/dialogScreen.ts`: it reads which Claude Code dialog is on the terminal screen, and the key of each choice.
  - New `ApprovalStrip.tsx` and `QuestionCard.tsx` (with plan approval).
  - `TerminalPane.tsx`: Chat layer layout.
  - `src/labels.ts` and `src/index.css`.
- Answers go through the same `pane_write` as typed input.
