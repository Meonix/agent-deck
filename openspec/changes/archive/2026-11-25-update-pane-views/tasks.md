## 1. Remove the chip, divider and area-under-session tests (delete first)

- [x] 1.1 Delete these tests before touching the code they cover:
  - `src/PaneShell.test.tsx` › "Pane Shell chip and toggle (3.1)": "opens a shell for the pane below the session, 30% of the pane high (SRS-FR-055)", "hides the shell and keeps it running (SRS-FR-056)", "shows the shell again with the output written while hidden, at the same height (SRS-FR-057)", "marks a hidden shell with the command it runs (SRS-FR-058)", "marks a hidden shell at its prompt with Shell, also before the first answer (SRS-FR-058)", "shows no marker on a pane without a shell or with a visible shell (SRS-FR-058)"
  - `src/PaneShell.test.tsx` › "Pane Shell divider and refit (3.2)": "is a horizontal separator with a grip", "makes the shell 100 px taller when the divider moves 100 px up (SRS-FR-059)", "stops following the pointer after release", "leaves the shell and the session at least 80 px tall", "resizes the shell and the session to their new terminal sizes after a drag (SRS-FR-060)", "keeps the dragged height through a hide and show (SRS-FR-057)", "fits the shell when it mounts, resizes it to the fit, and refits the session", "never resizes a hidden shell, and fits it when it shows again", "refits the session when the shell hides and shows" (and the `draggable` helper)
  - `src/PaneShell.test.tsx` › "Pane Shell exit, life after the session, start failure (3.3)": "closes the shell area when the shell exits; the next Shell opens a new one without the old output (SRS-FR-061)", "says Shell could not start and leaves the session running when the shell cannot start (SRS-FR-065)"
  - `src/PaneShell.test.tsx` helpers `chip`, `marker`, `shellArea`, `heightOf`
- [x] 1.2 `src/components/TerminalPane.test.tsx` and `src/App.test.tsx` have no test of the chip, the divider or the area; note the ones that only use the chip to open a shell, repointed in 2.2: `src/App.test.tsx` › "Reopen panes at launch (2.2 to 2.4)" › "resumes the remembered sessions in their places, unmaximized and without a shell (SRS-FR-085)"; "Maximize pane (2.1 to 2.4)" › "leaves the pane as it is on a double-click inside the terminal or on a header button (SRS-FR-066)"; "Text Size (2.1, 2.2)" › "fits every session terminal and Pane Shell after a change (SRS-FR-072)"; "Stashed Sessions (CR-011)" › "asks before stashing a pane whose shell runs a command (SRS-FR-105)". `TerminalPane.test.tsx` only passes `onToggleShell`/`onResizeShell` props (2.3)
- [x] 1.3 Grep the three test files for `openShell`, `hideShell`, `showShell`, `separator` inside a pane, `.bg-primary` marker and `style.height`: every hit left is a helper use listed in 1.2 or a pane split divider test

## 2. Test helpers and labels

- [x] 2.1 In `src/PaneShell.test.tsx` add `viewItem(name, i)` (button in the pane's View Switch group, name matched as `^name`), `shellView(i)` (the Shell layer) and `openShell(user, i)` via the Shell item; repoint "sends typed and binary input to the shell, not to the session (SRS-FR-055)", "gives the keyboard to the shell when it shows again (SRS-FR-057)", "asks every second while a shell is hidden and keeps the last answer when a call fails (D6)" (hide = choose Term), "resizes the shell to the new size on maximize and back on restore (SRS-FR-060)", the rest of 3.3 and all of "Closing a pane with a shell (3.4)"
- [x] 2.2 Repoint the four `src/App.test.tsx` tests of 1.2 from `labels.openShell` to the Shell item; the SRS-FR-066 test double-clicks the Shell item
- [x] 2.3 `src/components/TerminalPane.test.tsx`: `renderPane` and the three direct renders pass `onChooseView` instead of `onToggleShell`/`onResizeShell`
- [x] 2.4 Add `labels.viewSwitch`, `labels.views`, `labels.shellRunning(command)` to `src/labels.ts` with `src/labels.test.ts` cases; keep `openShell`/`showShell`/`hideShell` until group 6

## 3. View Switch (tests first)

- [x] 3.1 RED in new `src/components/ViewSwitch.test.tsx`: a group named "Chế độ của ô" with buttons "Chat", "Term", "Shell", "Plan" in order and class `seg`; the current one has `aria-pressed="true"` and `seg-on`, the others `aria-pressed="false"`; "Chat" and "Plan" have `aria-disabled="true"` and clicking or Enter calls nothing (SRS-FR-146); `shellCommand` "npm run dev" makes the Shell item read "Shell · npm run dev" with the command in `font-mono` (SRS-FR-058)
- [x] 3.2 RED in `src/components/TerminalPane.test.tsx` › new `describe("Pane header with View Switch (SRS-FR-030)")`: header reads "agent-deck · Scaffold Tauri app", then the state chip, the View Switch, Để dành, Phóng to, × in DOM order; the View Switch and buttons are `shrink-0` and the chip truncates first; Term is pressed on a new entry
- [x] 3.3 RED in `src/App.test.tsx` › new `describe("View Switch (CR-016)")`: a new pane shows Term with focus in the session terminal (SRS-FR-014); switching pane 1 to Shell leaves pane 2 on Term (SRS-FR-146); choosing Term moves focus into the session terminal; a relaunch reopens panes in Term with no shell (SRS-FR-085, SRS section 3)
- [x] 3.4 RED: double-click on a View Switch item does not maximize (SRS-FR-066); pointer down on a View Switch item and move over another pane shows no Drop Zone (SRS-FR-080)
- [x] 3.5 Implement `src/components/ViewSwitch.tsx`, `.seg`/`.seg-on` in `src/index.css`, `PaneView`/`view`/`returnView` and `chooseView` in `useSessionPanes.ts`, the header wiring in `TerminalPane.tsx` and `App.tsx` — GREEN for 3.1 to 3.4

## 4. Shell view (tests first)

- [x] 4.1 RED in `src/PaneShell.test.tsx` › new `describe("Shell view (CR-016)")`: choosing Shell opens one shell at 80×24, then the pane shows the Shell layer over the whole body (no `separator`), the Term layer is `invisible` and `inert`, Shell is pressed and focus is in the shell (SRS-FR-055); the pane stays on Term while the shell is starting
- [x] 4.2 RED: choosing Term hides the Shell layer, keeps stream and adapter alive and opens no second shell (SRS-FR-056, SRS-FR-148); output written while hidden is in the shell terminal when Shell is chosen again (SRS-FR-057); session output written while Shell is shown is in the session terminal when Term is chosen again and the session was not closed (SRS-FR-148)
- [x] 4.3 RED: a hidden busy shell makes the Shell item read "Shell · npm run dev"; at the prompt, before the first answer, with no shell, and with the shell shown it reads "Shell" (SRS-FR-058)
- [x] 4.4 RED: the shell fits when it mounts and is resized to the fit; maximize and restore resize the shown shell (SRS-FR-060); a maximize while Shell is shown also resizes the hidden session, and while Term is shown also resizes the hidden shell; choosing a view refits the shown terminal (design.md › Fit and focus on reveal)
- [x] 4.5 RED: `exit` in a shown shell returns the pane to Term with the Shell item reading "Shell", and the next Shell opens a new shell without the old output (SRS-FR-061); a hidden shell that exits leaves the pane on Term; a failed start shows "Không khởi động được shell", keeps Term pressed and the session `Running`, and dismiss clears it (SRS-FR-065); a killed session shows "Phiên đã kết thúc" in the Term layer and the shell still takes input after choosing Shell (SRS-FR-064)
- [x] 4.6 Implement the stacked Term/Shell layers in `TerminalPane.tsx`, `ShellArea` as the Shell view body in `PaneShell.tsx` (no separator, no ratio), the reveal effect (refit + focus), the exit-to-`returnView` and the poll keyed on `view !== "shell"` in `useSessionPanes.ts` — GREEN for 4.1 to 4.5

## 5. Close Dialog, stash and diagnostics stay

- [x] 5.1 Run the repointed "Closing a pane with a shell (3.4)" tests, "asks before stashing a pane whose shell runs a command (SRS-FR-105)" and "counts the shell's terminal in the diagnostic report": green with no change to `ConfirmDialog`, the stash or the diagnostics (SRS-FR-062, SRS-FR-063)

## 6. Remove the chip and the divider

- [x] 6.1 Delete `ShellChip`, the separator, `MIN_HEIGHT` and the pointer handlers from `src/components/PaneShell.tsx`; delete `toggleShell`, `resizeShell`, `SHELL_RATIO`, `ShellEntry.visible` and `ShellEntry.ratio` from `useSessionPanes.ts`; `onToggleShell`/`onResizeShell` from `TerminalPane` and `App.tsx`
- [x] 6.2 Delete `labels.openShell`, `showShell`, `hideShell` and their `labels.test.ts` cases
- [x] 6.3 Grep `src/` for `ShellChip`, `toggleShell`, `resizeShell`, `SHELL_RATIO`, `openShell:` label, `hideShell`, `showShell`, `cursor-row-resize`: no hit left

## 6b. Design follow-ups before item 38

- [x] 6b.1 Shell view's on-shown refit+focus takes focus only through `mayTakeFocus` like Term (bug: it could steal another pane's keyboard); test first
- [x] 6b.2 One `<ViewLayer>` wrapper (absolute, invisible + inert when not shown, data-view) used by the Term and Shell bodies; TerminalPane passes each body `shown={view === <its view>}` instead of the two-view `termHidden` boolean
- [x] 6b.3 One `isAvailable(view)` exported from ViewSwitch used by the hook; a shell start is cancelled when the user chooses any view other than Shell; test that choosing Chat (once available) or Term while the shell starts keeps that view
- [x] 6b.4 The Shell item renders through `labels.shellRunning` (or the label and its test are removed if the split mono part needs another shape)
- [x] 6b.5 `paneFocus` finds the pane by a `data-pane` attribute, not the `section` tag

## 7. Close

- [x] 7.1 `npm test` green
- [x] 7.2 `npx tsc --noEmit` clean
- [x] 7.3 `openspec validate update-pane-views --strict`
- [x] 7.4 Build and run the app under a separate identifier (never close the running agent-deck) and screenshot against `design/agent-deck/cr016/design.html` `#final` (header) and `#views` (Term, Shell): View Switch with Term on, Chat and Plan disabled, Shell view over the whole body, "Shell · <command>" on a hidden busy shell, `exit` back to Term, maximize with the shell shown, light and dark — not run: showing a pane needs a real Claude session; the user checks Term/Shell views in their own run (agreed at GATE 3)
