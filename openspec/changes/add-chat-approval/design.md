## Context

This is CR-016 backlog item 40 (SRS v1.17: SRS-FR-163 to SRS-FR-168, BR-13). The look comes from `design/agent-deck/cr016/design.html`:
- `strip()` and `.strip`, `.allow`, `.deny` for the Approval Strip;
- `#question` with `QCARD` (Question Card) and `PCARD` (plan card).

Both sit just above the Composer, where the Activity Bar is.

What exists after item 39:
- Each pane's `TerminalAdapter` exposes `screen()`, the visible rows with dim flags, and `onScreenChange`.
- `useComposer` recomputes readiness once per animation frame.
- The `PermissionRequest` hook already sets `Needs Approval` with a reason such as "Bash npm install" or "Edit src/main.rs" (`status/signal.rs` › `permission_reason`).
- Chat receives tool items `{ id, name, arg }` from the transcript (`transcript.rs`).

Measured on this Mac (Claude Code 2.1.332, 2026-11-26): real sessions in a 120×40 PTY, replayed into the repo's own @xterm/xterm. The captures are kept for fixtures in the scratchpad (`approval-spike/*.json`).

- **Permission dialog.**
  - The rows below the last full-width rule are:
    - " Bash command" (the tool kind)
    - a description
    - the command between `╌` rules (or in a `│` box)
    - " Do you want to proceed?"
    - numbered options: " ❯ 1. Yes", then "2. Yes, and always allow …", then "3. Yes, and switch to auto mode …", then "4. No"
    - "Esc to cancel · Tab to amend"
  - The number of the "No" option varies: it was 4 in default mode, and 3 in another dialog.
  - Writing the digit alone answers at once. `1` ran the command. `4` (No) did not run it and printed "Interrupted · What should Claude do instead?".
- **Question (AskUserQuestion, one question, single choice).**
  - The rows are:
    - " ☐ <header>"
    - the question
    - "❯ 1. zod" with its description on the next row, then "2. yup", "3. Type something.", "4. Chat about this"
    - "Enter to select · ↑/↓ to navigate · Esc to cancel"
  - Writing an option's digit answers with it at once ("→ zod").
  - Writing the digit of "Type something." only moves the cursor there. Typed text then replaces "Type something.", and `\r` submits it ("→ valibot").
  - The transcript's tool_use input holds `questions[].question`, `header`, `multiSelect` and `options[].label/description` before the dialog is drawn.
- **Plan (ExitPlanMode).**
  - The rows are:
    - " Ready to code?"
    - the plan between `╌` rules
    - " Claude has written up a plan and is ready to execute. Would you like to proceed?"
    - "❯ 1. Yes, and use auto mode", "2. Yes, manually approve edits", "3. Tell Claude what to change"
  - Digit `2` approved the plan, and the next edit asked for permission.
  - Digit `3`, then text, then `\r` sent the feedback, and Claude Code stayed in plan mode and drew a new plan.
  - The transcript holds `input.plan` as markdown, but it cannot be trusted. Some ExitPlanMode records have an empty input `{}`. And after "Tiếp tục lên kế hoạch", Claude Code edited its plan file and called ExitPlanMode again with the old plan text in `input.plan` (249 chars, without the new test steps), while the dialog showed the new plan (real-app verify, 2026-11-26).

## Goals / Non-Goals

**Goals:**
- Answer permission requests, single questions and plan exits with buttons.
- Never deliver a choice to anything but the dialog the user saw (SRS-FR-165).
- Keep Term able to answer, and drop the strip or card as soon as the dialog is gone.

**Non-Goals:**
- Windows/ConPTY verification. The user asked to verify macOS first and Windows later.
- AskUserQuestion with several questions, or with `multiSelect`. No card is shown; the Composer stays locked with "Claude Code đang chờ duyệt", and the user answers in Term. Anything more goes through `/ba-change`.
- "Chat about this", the "Yes, and always allow …" options, Tab to amend, and auto-mode choices. Only Yes and No are offered (SRS-FR-163).
- Other dialogs, such as trust, MCP elicitation and `/` command pickers. They keep locking the Composer.
- The Plan view (item 43).

## Decisions

- **Reading the dialog: `dialogScreen(screen)`**, a pure function in new `src/components/dialogScreen.ts`, beside `inputReady.ts`.
  - It works on the rows below the last full-width rule row that has no input box after it, the same region `inputReadiness` treats as a dialog.
  - It returns `{ kind: "none" }`, or one of:
    - `{ kind: "permission", title, subject, command, yes, no }`:
      - The anchor is the last row asking "Do you want to proceed?", "Do you want to create <file>?" or "Do you want to make this edit to <file>?". Write and Edit were measured with the last two.
      - `title` is the header row, such as "Bash command", "Create file" or "Edit file".
      - `subject` is what is being approved: for a file dialog, the path row; otherwise the fenced command, with its lines kept.
      - `command` is the same fenced text on one line, the identity compared at click time.
      - A fence is a row of `╌` at column 0, at least 90% of the width.
      - `yes` is the digit of menu item 1 "Yes", and `no` that of the last item "No".
    - `{ kind: "question", question, options, other, otherLabel, cursor }`:
      - The menu sits above the last "Enter to select" footer.
      - Its last item is "Chat about this", and the one before it, "Type something.", is `other`. The items before those are `options`.
      - `cursor` is the digit under `❯`.
    - `{ kind: "plan", approve, keepPlanning, keepPlanningLabel, cursor, plan }`:
      - The menu sits below the last "Would you like to proceed?".
      - It includes the digits of "Yes, manually approve edits" and "Tell Claude what to change".
      - `plan` is the text between the two full-width `╌` fences under " Here is Claude's plan:", with the common indentation removed and the line breaks kept. It is null unless the dialog's top rule, that row and both fences are on screen.
    - `{ kind: "other" }`: any other dialog marker from item 39, or a known dialog missing a row the answer needs.
  - The menu is read from the dialog's own footer or anchor. It takes one digit column and consecutive digits ending at 1. Deeper rows, which are descriptions, are skipped, and roles are taken by position. So text that Claude Code prints (commands, plans, questions, descriptions) can never supply a digit.
  - Missing anything means no button can answer, so the result is `other`, and the strip or card is not shown.
- **What the strip and cards show.**
  - Approval Strip: shown while `status.state === "Needs Approval"` and `dialogScreen` is `permission`.
    - Tool: the name of the newest pending tool item in Chat (Bash, Edit, Write…). Without one, the strip shows the detail alone.
    - Detail: the dialog's subject read from the screen, never the hook reason or the item's `arg`, which keep only a command's first line:
      - a Bash command with all its lines;
      - for a file dialog ("Create file", "Edit file"), the path on the row under its title.
    - Text: `<tool> · <detail>`, as `strip()`. The detail is mono, keeps its lines, shows up to 4 rows and then scrolls, and carries the whole subject as its `title`.
  - Question Card: shown while `dialogScreen` is `question`, the newest pending tool item is `AskUserQuestion`, its input has exactly one question with `multiSelect` false, and the question text on screen starts with that question's first 40 characters.
    - The card shows the transcript's question and labels.
    - The keys come from the screen, matched to the transcript labels by label text.
  - Plan card: shown while `dialogScreen` is `plan`.
    - The plan is read from the screen (`dialogScreen` › `plan`), never from the transcript. Its `input.plan` can be stale (measured), so Duyệt kế hoạch would approve a plan the user never saw in the card.
    - When the plan cannot be read whole from the screen, the card shows "Xem kế hoạch ở Term" in place of the plan.
    - The plan markdown is shown as preformatted text, scrollable, up to 12 rows. Rich rendering waits for the Plan view (item 43).
- **Answering (SRS-FR-164, SRS-FR-166, SRS-FR-167): read the screen again, then one write.**
  - The click handler reads `adapter.screen()` and the status synchronously and runs `dialogScreen` again.
  - It delivers only if the result matches what the user saw:
    - the same kind;
    - for permission, the same `command`;
    - for a question, the same question text and the chosen label present;
    - for a plan, the same plan text. A plan shown without its text is answered only while its text still cannot be read.
  - Writes:
    - permission: the `yes` or `no` digit, one write;
    - option: its digit, one write;
    - approve plan: the `approve` digit, one write;
    - Khác and keep planning: three writes, because the digit and the text written in one chunk answered the first option (measured). Each write waits until the screen shows the one before it landed:
      1. the `other` or `keepPlanning` digit;
      2. the text, once the cursor `❯` is on that row;
      3. `\r`, once that row shows the text.
    - Each wait lasts at most 2 s. If it times out, or another dialog takes the screen, nothing more is written and the toast "Yêu cầu đã thay đổi" shows.
  - Text typed into Khác or feedback is first stripped of control characters, as Composer prompts are (`composerLogic`), and newlines become spaces, because Claude Code's single-line field would submit at the first `\r`.
  - Otherwise (SRS-FR-165) nothing is written, and a toast shows "Yêu cầu đã thay đổi", using the app's existing Toast.
  - A second click while a write is pending is ignored.
- **Disappearing (SRS-FR-168).** Visibility is recomputed from the screen on each `onScreenChange` frame and on each status change, as the Composer's readiness is. Once the dialog is gone from the screen, whether answered here or in Term, the strip or card goes away.
- **Backend: tool items carry question data.**
  - In `transcript.rs`, the `ChatItem::Tool` record gains an optional `detail`, `{ question: { text, multiSelect, count, options: [label] } }`, for `AskUserQuestion`, from `questions[0]` plus `questions.len()`.
  - ExitPlanMode carries no detail, because its `input.plan` can be stale (see Context).
  - Serialized camelCase like the other fields. The frontend `ChatEntry` tool keeps it.
  - Nothing else in Chat changes.
- **One hook per pane: `useDialog`.** In new `src/components/useDialog.ts`. It shares the frame scheduler pattern of `useComposer`. It returns `{ strip, question, plan, answer(choice) }` and is used by `TerminalPane`.
- **Layout.** In the Chat layer: log, then Activity Bar, then the Approval Strip or one card, then the Composer. Only one of strip, Question Card or plan card can show, because only one dialog is on screen.
- **Components.**
  - `ApprovalStrip.tsx`: lucide `hand`, the text, Từ chối (`.deny`) and Cho phép (`.allow`). Accessible group name "Yêu cầu quyền".
  - `QuestionCard.tsx`:
    - The question card: the question, options as radio buttons, a "Khác…" input that unselects the options while typed in, and Gửi, disabled until something is chosen.
    - The plan card: the plan, a feedback input, Tiếp tục lên kế hoạch (disabled while feedback is empty), and Duyệt kế hoạch.
  - Focus does not move to them when they appear, so typing in the Composer is not stolen.
- **Labels.**
  - From the SRS: `allow` "Cho phép", `deny` "Từ chối", `requestChanged` "Yêu cầu đã thay đổi", `other` "Khác…", `approvePlan` "Duyệt kế hoạch", `keepPlanning` "Tiếp tục lên kế hoạch". `send` "Gửi" already exists.
  - Proposed for PO confirmation: `permissionGroup` "Yêu cầu quyền", `planFeedback` "Góp ý cho kế hoạch", `planInTerm` "Xem kế hoạch ở Term".
- **CSS.** Copy `.strip`, `.allow`, `.deny` and the card's approval border from the design into `src/index.css` with existing tokens (`--approval-bg`, `--approval-foreground`, `--approval-border`), plus focus-visible rings.

## Seams to test

These seams are approved at GATE 2; no test is written elsewhere.

1. `dialogScreen(screen)`: unit tests on fixture screens from the measured captures:
   - permission with "4. No";
   - permission with "3. No";
   - question;
   - question cursor on "Type something.";
   - plan;
   - trust (→ `other`);
   - idle (→ `none`);
   - a permission dialog missing its "No" row (→ `other`);
   - a command in a `│` box.
2. `transcript.rs` parse: `cargo test` that an AskUserQuestion record produces a tool item with `detail`, and that ExitPlanMode and other tools have no `detail`.
3. Answer steps (`answerSteps(dialog, choice)`, a pure helper): the exact digit for Yes/No/option/plan, and for Khác and feedback the digit, the cleaned text (newlines and tabs to spaces, control characters dropped) and `\r` as screen-gated steps.
4. App level, RTL with the fake client and a fake adapter whose `screen()` is a fixture:
   - the strip text and buttons;
   - Cho phép writes exactly `1` and Từ chối exactly the No digit;
   - the screen changes after render and before the click (→ nothing written, toast "Yêu cầu đã thay đổi");
   - the card with options, Gửi disabled until chosen, the Khác bytes;
   - the plan card buttons and their bytes;
   - the strip disappearing when the screen loses the dialog (answered in Term);
   - no strip on a trust dialog.
5. Real app on macOS: a real permission dialog answered by Cho phép and by Từ chối, a stale strip after answering in Term, a real AskUserQuestion answered by option and by Khác, and a real plan kept planning with feedback and then approved.

## Risks / Trade-offs

- **The dialog layout is Claude Code's, and it can change.** An unknown layout gives `other`. Then no buttons show, the Composer stays locked, and Term still answers. The fixtures pin version 2.1.332.
- **Digits are positional.**
  - Each digit is read from the screen at click time, never assumed. A missing "No" row means no strip at all.
  - The re-read at click time compares the command or question text, so a replaced request is not answered by the old button.
- **The window between the re-read and the write.** It is the same as for a person pressing a key in Term, and it is a few milliseconds.
- **Wrapped long commands.** The `command` comparison joins wrapped rows with spaces, so it is stable as long as the pane width does not change between the render and the click. A resize in that window makes the click stale, which is the safe side.
- **Windows ConPTY may draw dialogs differently.** This is not verified here, at the user's request. Until it is checked, Windows users may see no strip, and the Composer stays locked.

## Migration Plan

The transcript feed only gains a field. Rollback = revert the commit.

## Open Questions

None.
