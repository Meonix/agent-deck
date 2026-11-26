## 1. Screen reading (tests first) — seams 1, 2

- [ ] 1.1 Add fixture screens to `src/components/fixtures/claude-screens.ts`: idle, typed, running, permission, question, trust, after-esc. Build them from the measured captures (`composer-spike/screens.json` in the session scratchpad), with the scratch paths replaced by `/Users/me/ws`. Each screen is rows of `{ text, dim }`.
- [ ] 1.2 RED `src/components/inputReady.test.ts`: `inputReadiness` on every fixture and on each state.
  - Ended: `ended`.
  - Needs Approval: `approval`.
  - Permission, question and trust dialogs: `approval`.
  - Running: `running`.
  - Idle with placeholder, or with `❯` alone: ready.
  - Typed text: `unrecognized`.
  - Old boxed prompts above the live box: read the live box.
  - No box: `unrecognized`.
  - Short rule rows: `unrecognized`.
  - Error at an empty box: ready.
  (SRS-FR-155, RULE-12)
- [ ] 1.3 RED `src/components/xtermAdapter.test.ts`, or the adapter's existing test file: write captured escape output into a real `@xterm/xterm` Terminal in jsdom. `screen()` returns the visible rows with dim flags (the placeholder is dim, `❯` is not). `bracketedPaste()` is true after `ESC[?2004h`.
- [ ] 1.4 Implement `inputReady.ts` and the adapter's `screen()` and `bracketedPaste()` → GREEN.

## 2. Delivery and history helpers (tests first) — seam 3

- [ ] 2.1 RED: `sendPrompt` and `historyStep` (in `src/components/composerLogic.ts`).
  - Paste mode bytes are `ESC[200~` + text + `ESC[201~` + `\r`; plain mode is text + `\r`.
  - Multi-line without paste mode is refused.
  - Whitespace-only input is refused.
  - `\r\n` is normalised to `\n`.
  - ↑/↓ steps through history and ↓ past the newest gives an empty Composer.
  (SRS-FR-154, SRS-FR-158)
- [ ] 2.2 Implement → GREEN.

## 3. Composer in the pane (tests first) — seam 4

- [ ] 3.1 RED `src/components/Composer.test.tsx`:
  - placeholder "Nhắn cho Claude…" when ready;
  - lock reason as placeholder, `.send-off` and `aria-disabled` when locked, and the reason in `aria-describedby`;
  - Stop "Dừng" and no send while running;
  - Enter calls `onSend`, Shift+Enter adds a line, Enter while `isComposing` does nothing;
  - the textarea grows to 8 rows.
  (SRS-FR-155, SRS-FR-157)
- [ ] 3.2 RED `src/App.test.tsx` › new `describe("Composer (CR-016)")`, with the fake client and a fake adapter whose `screen()` returns fixtures:
  - Enter sends exactly the paste-mode bytes, clears the Composer and records history (SC-1).
  - A permission screen shows "Claude Code đang chờ duyệt" and Enter sends nothing (SC-2).
  - The screen switches to a dialog after render and before Enter: nothing is written and the text stays (SC-3).
  - Stop writes `\x1b` only while `Running`, and Idle has no Stop (SC-4).
  - ↑ recalls per pane (SC-5).
  - A failed write keeps the text.
  - The draft survives switching to Term and back.
- [ ] 3.3 RED in `src/App.test.tsx` and `useSessionPanes.test.tsx`:
  - New, resumed and reopened panes show Chat with focus in the Composer.
  - Choosing Chat focuses the Composer.
  - A Session Row jump to a pane in Chat focuses its Composer.
  - Typing right after "Phiên mới" lands in the Composer.
  - Update the existing tests that expect panes to open in Term.
  (SRS-FR-147, SRS-FR-014, pane-views › SRS-FR-146)
- [ ] 3.4 Implement:
  - `Composer.tsx`;
  - `draft` and `sentPrompts` in `PaneEntry`;
  - send and stop through `client.write`;
  - readiness recomputed per animation frame and on status change;
  - the Chat layer layout;
  - view and `returnView` starting at `"chat"` and the focus target;
  - labels with `labels.test.ts` cases;
  - `.field`/`.send`/`.send-off`/`.stop` CSS.
  → GREEN.

## 4. Close

- [ ] 4.1 `npm test` green and `cargo test` (in `src-tauri`) green.
- [ ] 4.2 `npx tsc --noEmit` clean and `npm run build` succeeds.
- [ ] 4.3 `openspec validate add-composer --strict`.
- [ ] 4.4 Real app on macOS, separate identifier, scratch folder:
  - a new pane opens in Chat with the Composer focused;
  - a prompt sent from the Composer is answered;
  - a multi-line Vietnamese prompt arrives as one prompt;
  - in a real permission dialog (`--permission-mode default`), the Composer locks with "Claude Code đang chờ duyệt" and Enter sends nothing;
  - Stop interrupts a long command;
  - ↑ recalls;
  - screenshots are compared against `design.html` `#final` and `#error`;
  - test data is cleaned up afterwards.
- [ ] 4.5 Windows 11 ConPTY: is Input Ready recognised there? Deferred by the user. Say so at GATE 3.
