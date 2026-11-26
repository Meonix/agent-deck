## 1. Reading the dialog (tests first) — seam 1

- [x] 1.1 Add fixture screens to `src/components/fixtures/claude-screens.ts`. Build them from the measured captures in the session scratchpad (`approval-spike/perm.json`, `q.json`, `o.json`, `plan.json`, `plan2.json`), with the scratch paths replaced by `/Users/me/ws`:
  - permission with "4. No";
  - permission with "3. No" (from `plan2.json` › after-2);
  - question;
  - question with the cursor on "Type something.";
  - plan.
  Derive from them: a permission dialog with no "No" row, and a command in a `│` box.
- [x] 1.2 RED `src/components/dialogScreen.test.ts`: `dialogScreen` on each fixture, plus trust (→ `other`) and idle (→ `none`) from the existing fixtures. Check the digits, the command, the question text and the option labels. (SRS-FR-163, SRS-FR-166, SRS-FR-167)
- [x] 1.3 Implement `src/components/dialogScreen.ts` → GREEN.

## 2. Question data from the transcript (tests first) — seam 2

- [x] 2.1 RED `cargo test` in `src-tauri/src/transcript.rs`:
  - an AskUserQuestion tool_use gives a tool item with `detail.question { text, multiSelect, count, options }`;
  - an ExitPlanMode tool_use has no `detail`, even with `plan`, because its input can be stale (measured); the plan card reads the screen;
  - a Bash tool_use has no `detail`;
  - serialization is camelCase.
- [x] 2.2 Implement → GREEN. Carry `detail` through the frontend `ChatItem`/`ChatEntry` types and `applyChat`, and extend the `chatState.test.ts` case.

## 3. Answer steps (tests first) — seam 3

- [x] 3.1 RED `answerSteps(dialog, choice)` in `src/components/dialogAnswer.ts`:
  - Yes and No digits;
  - an option digit;
  - Khác: the digit, then cleaned text, then `\r`;
  - approving the plan: its digit;
  - keep planning: the digit, the feedback, then `\r`;
  - control characters stripped and newlines turned into spaces;
  - an empty Khác or feedback is refused.
  (SRS-FR-164, SRS-FR-166, SRS-FR-167)
- [x] 3.2 Implement → GREEN.

## 4. Strip and cards in the pane (tests first) — seam 4

- [x] 4.1 RED `ApprovalStrip.test.tsx` and `QuestionCard.test.tsx`:
  - the strip text and buttons;
  - radio options;
  - Khác unselects the options;
  - Gửi disabled until something is chosen;
  - the plan card's buttons, with Tiếp tục lên kế hoạch disabled while feedback is empty;
  - "Xem kế hoạch ở Term" when there is no plan.
- [x] 4.2 RED `src/App.test.tsx` › new `describe("Approval (CR-016)")`, with the fake client and a fake adapter whose `screen()` returns fixtures:
  - SC-1: the strip "Bash · npm install".
  - SC-2: Cho phép writes exactly `1`; Từ chối writes exactly the No digit.
  - SC-3: the screen changes before the click → nothing written, toast "Yêu cầu đã thay đổi".
  - SC-4: the question card; choosing `zod` and Gửi writes its digit; Khác "valibot" writes the digit, then "valibot", then `\r`.
  - SC-5: the plan card; Tiếp tục lên kế hoạch writes `3`, then the feedback, then `\r`; Duyệt kế hoạch writes `2`.
  - SC-6: the screen loses the dialog → the strip disappears.
  - No strip on a trust dialog.
  - No card for a question with `multiSelect` or with two questions.
- [x] 4.3 Implement:
  - `useDialog.ts`;
  - `ApprovalStrip.tsx` and `QuestionCard.tsx`;
  - the Chat layer layout in `TerminalPane.tsx`;
  - labels with `labels.test.ts` cases;
  - the `.strip`/`.allow`/`.deny` and card CSS.
  → GREEN.

## 5. Close

- [x] 5.1 `npm test` green and `cargo test` (in `src-tauri`) green.
- [x] 5.2 `npx tsc --noEmit` clean and `npm run build` succeeds.
- [x] 5.3 `openspec validate add-chat-approval --strict`.
- [ ] 5.4 Real app on macOS, separate identifier, scratch folder, session in manual (default) permission mode:
  - Cho phép on a real permission dialog runs the command;
  - Từ chối does not run it;
  - a strip after answering `1` in Term disappears, or shows "Yêu cầu đã thay đổi" if clicked in that window;
  - a real AskUserQuestion answered by option and by Khác (Vietnamese text);
  - a real plan kept planning with feedback, then approved;
  - screenshots compared against `design.html` `#final` and `#question`;
  - test data cleaned up afterwards.
- [ ] 5.5 Windows 11 ConPTY dialogs: deferred by the user. Say so at GATE 3.
