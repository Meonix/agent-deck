## Context

This is CR-016 backlog item 39 (SRS v1.17: SRS-FR-147, SRS-FR-154 to SRS-FR-158, RULE-12). The look comes from `design/agent-deck/cr016/design.html` › `composer()`. It is a strip under the Chat body: `px-3 py-2`, a top border, a card background, a paperclip, a rounded `.field` input, and on the right either `.send` (arrow-up), `.send-off` when locked, or `.stop` (square) while running. A locked Composer shows its reason as the placeholder (`#final`, `#error`). The Activity Bar sits just above it (item 38). Item 41 adds the paperclip and its menus, so this change leaves the paperclip out.

Today, after item 38, a pane opens in Term. Chat is a mounted `ViewLayer` holding `ChatView` and `ActivityBar`. Each `TerminalAdapter` (xterm) receives all session output, even while hidden. Typed input goes through `SessionsClient.write(paneId, data)` → `pane_write` → `TrackedProcess.write`. `TrackedProcess.write` also lets the status tracker see answer keys. `PaneStatus.state` comes from hooks: `Running`, `Needs Approval`, `Idle`, `Error`, `Ended`.

Measured on this Mac (Claude Code 2.1.332, 2026-11-26). Real sessions ran in a 120×40 PTY and the output was replayed into the repo's own @xterm/xterm. The screens are kept for fixtures in the scratchpad (`composer-spike/screens.json`).
- **Idle:**
  - The bottom of the screen is a rule line of `─` across the width, then `❯` + NBSP + a dim placeholder (`Try "how do I log an error?"`), then a rule line, then the status lines.
  - A submitted prompt echoed in the transcript is also boxed as `❯ <text>`, with a normal space.
- **Running:** Same input box, empty (`❯` alone), with "esc to interrupt" in the footer.
- **Permission dialog:**
  - No input box below the last rule.
  - The lines include "Do you want to proceed?", "❯ 1. Yes" and "Esc to cancel · Tab to amend".
- **Question (AskUserQuestion):** "❯ 1. Đỏ", "Enter to select · ↑/↓ to navigate · Esc to cancel".
- **Trust dialog:** "❯ No, exit", "Enter to confirm · Esc to cancel".
- **Bracketed paste mode:** It is on in every state.
- **Submitting a prompt:** Writing `ESC[200~` + a two-line Vietnamese prompt + `ESC[201~` + `\r` as one write submitted it as one prompt, and Claude answered it.

## Goals / Non-Goals

**Goals:**
- Send from the Composer only when RULE-12 holds, with a reason when locked.
- Check the screen again at the moment of sending.
- Provide Stop while `Running`, and prompt history per pane.
- Open panes in Chat with focus in the Composer.

**Non-Goals:**
- Windows/ConPTY verification. The user asked to verify macOS first, and Windows later.
- "/" and "@" menus (item 41), attachments and the paperclip (item 42), the Approval Strip and the Question Card (item 40), and Plan (item 43).
- Keeping prompt history across launches: SRS-FR-158 says "sent from that pane", in memory. Anything more goes through `/ba-change`.
- Queueing a prompt while `Running`: send is replaced by Stop, as in `composer({running:true})`.
- A specific message for text typed in Term. It falls under "Không nhận ra màn hình Claude Code — gõ ở Term" because RULE-12 says "không chắc thì không Input Ready".

## Decisions

- **Input Ready is read from the session terminal's screen in the frontend.** This was approach A at GATE 1.
  - `TerminalAdapter` gains `screen(): ScreenLine[]`, the visible viewport rows of the xterm buffer, each as `{ text, dim }`. `dim` is a per-cell flag.
  - It also gains `bracketedPaste(): boolean`, from `term.modes.bracketedPasteMode`.
  - Term is always mounted (item 37), so the buffer is current whichever view is shown.
  - Alternatives rejected at GATE 1: a Rust `vt100` emulator (new dependency, second emulation) and hooks alone (misses dialogs and text typed in Term).

- **`inputReadiness(screen, state)` is a pure function** in new `src/components/inputReady.ts`. It returns `{ ready: true }` or `{ ready: false, reason }`, where reason is `approval | unrecognized | running | ended`. The checks run in this order:
  1. `state` is `Ended`: `ended`.
  2. `state` is `Needs Approval`: `approval`.
  3. A dialog is visible. A dialog is any row matching `^\s*❯ \d+\. `, or containing "Esc to cancel", "Enter to confirm", "Enter to select" or "Do you want to proceed?", below the last rule row that opens the input box (or anywhere when no input box is found): `approval`.
  4. `state` is `Running`: `running`. The Composer then shows Stop and no lock text.
  5. The input box is found:
     - Find the bottom-most row that starts with `❯` and is followed by NBSP, a space, or nothing.
     - The row directly above it must be a rule row: only `─`, covering at least half the width.
     - A rule row must follow it, after any continuation rows that start with two spaces.
     - Its text after `❯` must be empty or entirely dim (the placeholder).
     If all of this holds: ready. Otherwise: `unrecognized`.
  - `Idle` and `Error` both go through the screen checks. A session in `Error` can still wait for a prompt (RULE-06 lets a new prompt leave `Error`).

- **When readiness is computed.**
  - On each write of session output into the adapter, coalesced to one run per animation frame.
  - On every status change.
  - At the moment of sending (SRS-FR-156): the send handler re-reads `screen()` and `status` synchronously and delivers only if the result is `ready`. Otherwise the prompt stays and the lock shows.
  - The remaining window, between that read and the bytes reaching the PTY, is the same as for a human typing in Term.

- **Delivery.**
  - With bracketed paste on: `client.write(paneId, "\x1b[200~" + text + "\x1b[201~\r")`, as one write.
  - With it off, a single-line prompt is sent as `text + "\r"`. A multi-line prompt counts as not ready (`unrecognized`), because without paste mode a newline would submit early.
  - Line endings are normalised to `\n`. The text is sent as the user typed it, with no trimming inside. A prompt that is only whitespace is not sent.
  - After a successful write, the Composer clears and the prompt is pushed to the pane's history.
  - A failed write (the promise rejects) keeps the text in the Composer.

- **Stop.**
  - While `status.state === "Running"`, the Composer shows the `.stop` button (lucide `square`, accessible name "Dừng").
  - Pressing it writes `"\x1b"` through `client.write`. That goes through `TrackedProcess.write` exactly like Esc in Term.
  - Stop does not check Input Ready.

- **History.**
  - `PaneEntry.sentPrompts: string[]`, in memory, per pane.
  - ↑ in an empty Composer, or in one still showing an unedited history entry, loads the next older prompt.
  - ↓ moves newer, and ↓ past the newest empties the Composer.
  - ↑/↓ elsewhere in a multi-line text move the caret as usual. History only takes over when the caret is on the first row (↑) or the last row (↓).

- **Composer component** `src/components/Composer.tsx`.
  - Props: `value`, `onChange`, `readiness`, `running`, `onSend`, `onStop`, `onHistory(dir)`.
  - A `<textarea rows=1>` that grows up to 8 rows. `aria-label` "Nhắn cho Claude".
  - Placeholder: "Nhắn cho Claude…" when ready or running, or the lock reason when locked.
  - Send button: `.send`, or `.send-off` + `aria-disabled` when locked, with accessible name "Gửi". It is replaced by Stop while `Running`.
  - The locked reason is also given to `aria-describedby`, so a screen reader hears why.
  - The draft is held in `PaneEntry.draft`, so it survives view switches.
  - IME composition: Enter during composition (`isComposing`) does not send, to protect Vietnamese input.

- **Layout.** In the Chat layer, under the `ChatView` log and the `ActivityBar`: log (flex-1) / Activity Bar / Composer. The Chat layer is still mounted from the pane's start.

- **Default view and focus (SRS-FR-147, SRS-FR-014).**
  - `PaneEntry.view` starts at `"chat"` for new, resumed and reopened panes, and `returnView` starts at `"chat"`.
  - Focus on open, on choosing Chat, and on jumps from a Session Row (`shownView` from item 38) goes to the Composer textarea, located the same way the Chat log is now (`data-composer` scoped by pane id).

- **Labels.**
  - From the SRS: `composerLockApproval` "Claude Code đang chờ duyệt" and `composerLockUnrecognized` "Không nhận ra màn hình Claude Code — gõ ở Term".
  - Proposed, for PO confirmation as in items 37 and 38: `composerLockEnded` "Phiên đã kết thúc", `composerPlaceholder` "Nhắn cho Claude…" (the design's "(/ lệnh, @ file)" waits for item 41), `composerLabel` "Nhắn cho Claude", `send` "Gửi", `stop` "Dừng".

- **CSS.** Copy `.field`, `.field-on`, `.send`, `.send-off` and `.stop` from the design into `src/index.css`, using existing tokens, with a focus-visible ring.

## Seams to test

These seams are approved at GATE 2; no test is written elsewhere.

1. `inputReadiness(screen, state)`: unit tests on fixture screens built from the measured captures (idle with placeholder, typed text, running, permission dialog, question dialog, trust dialog, a scrolled transcript with old `❯` boxes above the live one, no input box at all, rule rows shorter than half width) and on each `state`.
2. `xtermAdapter.screen()` / `bracketedPaste()`: a test that writes real captured escape output into the real @xterm/xterm `Terminal` (jsdom, as in the spike) and checks that the rows, the dim flags and the paste mode come back.
3. Delivery and history logic (`sendPrompt`, `historyStep`), pure helpers: the exact bytes written in paste mode and in plain mode, multi-line without paste mode refused, whitespace-only refused, history up and down.
4. App level, RTL with the fake `SessionsClient` and a fake adapter whose `screen()` is a fixture:
   - Enter sends the exact bytes and clears.
   - A locked Composer sends nothing and shows its reason.
   - The re-check at send time blocks a dialog that appeared since the last render.
   - Stop writes Esc only while `Running`.
   - ↑ recalls per pane.
   - New and reopened panes open in Chat with focus in the Composer.
   - IME Enter does not send.
5. Real app on macOS (task 7.4): send, lock in a real permission dialog, Stop, ↑, and opening in Chat.

## Risks / Trade-offs

- **The screen layout is Claude Code's, and it can change.**
  - An unknown layout locks the Composer with the unrecognized reason rather than sending, so Term still works.
  - The fixtures pin version 2.1.332.
- **Patterns are fragile across languages and terminal width.**
  - The dialog footer strings are English in 2.1.332 even though question text was Vietnamese.
  - Very narrow panes can wrap the input box. Rule rows must cover half the width, so a wrapped box reads as unrecognized: it locks, it does not send.
- **The window between the check and the write.**
  - This is the same race a human has in Term.
  - Hooks also mark `Needs Approval`, which locks independently of the screen.
- **Windows ConPTY may draw the box differently.** This is not verified here, at the user's request. Until it is checked, Windows users may see the Composer locked as unrecognized.
- **Reading the buffer on each frame.** It is cheap: viewport rows only (≤ 80) and coalesced to one run per animation frame.

## Migration Plan

UI only, with no data migration. Reopened panes now start in Chat. Rollback = revert the commit.

## Open Questions

None.
