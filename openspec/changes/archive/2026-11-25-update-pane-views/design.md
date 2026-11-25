## Context

CR-016 item 37. The approved look is `design/agent-deck/cr016/design.html`: `header()` draws the pane header `.bar h-10` as state dot · "workspace · title" · state chip · spacer · `seg()` · Để dành · Phóng to/Thu về · ×; `seg()` draws the View Switch as a `.seg` pill (1px border, 22px radius, 12px text, items `padding: 2px 8px` in the muted colour) whose current item has `.seg-on` (accent background and text), with the items "Chat", "Term", "Shell" or "Shell · <cmd>", "Plan" or "Plan 2/5". `#final` shows the header in Chat; `#views` shows Term (the Claude Code terminal, no Composer) and Shell (the shell terminal over the whole pane body, "Shell · dev" while a command runs hidden). SRS v1.17 (Baselined) rewrote SRS-FR-030, SRS-FR-055 to SRS-FR-058, SRS-FR-061, SRS-FR-066, SRS-FR-080, deleted SRS-FR-059 and added SRS-FR-146 to SRS-FR-148.

Today `TerminalPane` renders the header with `ShellChip` (open / hide / show, with a dot and the command name while hidden), and the body as the session terminal plus, when a shell exists, `ShellArea` below it: a `role="separator"` divider and an xterm box taking `ratio` (30% at open) of the body, `display: none` while hidden. `useSessionPanes` keeps `ShellEntry { adapter, stream, visible, ratio, activity }` per pane, `toggleShell` opens or flips `visible`, `resizeShell` sets `ratio`, and a 1 s interval asks `shellActivity` for every hidden shell. Items 34 to 36 are archived: remote tokens, the Folder Tree and the Session Chooser exist. Chat (item 38), Composer (item 39) and Plan (item 43) are not built.

## Goals / Non-Goals

**Goals:**
- A View Switch on every pane header matching `header()`/`seg()`, with Term and Shell working and Chat and Plan visibly present but disabled.
- The Pane Shell as the full-body Shell view: start on first choice, hide and keep running, show again with its output, "Shell · <command>" while hidden and busy, back to the previous view on exit.
- Both terminals keep running and keep their output while hidden, and fit to the pane on resize, maximize, restore and Text Size change.
- Every test of the chip, the divider and the area under the session is deleted first, not left skipped.

**Non-Goals:**
- No Chat, Composer, Activity Bar, Approval Strip or Plan content (items 38, 39, 43); no "Plan 2/5" count (SRS-FR-170).
- No default Chat view: SRS-FR-147 is not implemented here.
- No Settings (item 45).
- No change to the Close Dialog and Stash Dialog warnings (SRS-FR-063, SRS-FR-105), to closing a pane with its shell (SRS-FR-062), to the pane split divider (SRS-FR-023) or to the backend shell commands.
- No persistence of the view across launches.

## Decisions

- **SRS-FR-147 moves to item 38.** With Chat disabled a pane cannot open in Chat, so new and reopened panes open in Term and SRS-FR-014 puts focus in the session terminal. The SRS-FR-147 requirement is left out of this change's deltas; backlog row 37 (which lists SRS-FR-147) and row 38 (add-chat-view, which does not) are to be corrected through /ba-change. Alternative — open in a disabled Chat placeholder: rejected at GATE 1, a pane that opens on an empty view costs a click every time.
- **View state per pane in `useSessionPanes`.** `type PaneView = "chat" | "term" | "shell" | "plan"`; `PaneEntry` gains `view` (starts `"term"`) and `returnView` (the last non-Shell view, `"term"` for now). `chooseView(paneId, view)` replaces `toggleShell`: `"chat"`/`"plan"` are ignored; `"term"` sets the view; `"shell"` sets the view when a shell exists, else starts one and sets `view: "shell"` in the same `update` that inserts the `ShellEntry`. Until the shell has started the pane keeps its view; a start failure leaves it there with `shellFailed` (SRS-FR-065). On shell exit the entry drops the shell and, if `view === "shell"`, sets `view = returnView` (SRS-FR-061). Alternative — view state in `TerminalPane` local state: rejected, the activity poll, the exit handler and the stash/close warnings all live in the hook and need to know whether the shell is hidden.
- **`ShellEntry` loses `visible` and `ratio`.** Hidden is derived: `entry.view !== "shell"`. `resizeShell`, `SHELL_RATIO` and `onResizeShell` go. The activity poll keys on panes whose shell exists and whose view is not Shell, as today on `!visible`.
- **Term and Shell layers stay mounted, hidden with CSS.** The pane body is one `relative` box holding two `absolute inset-0` layers: the session layer (xterm + "Phiên đã kết thúc" strip + start-failure text) and, when a shell exists, the shell layer (`ShellArea`). The hidden layer gets `invisible` (`visibility: hidden`) and `inert`, not `display: none`, so it keeps its layout size: xterm keeps receiving output, its `ResizeObserver` keeps firing, and the hidden session or shell is resized with the pane (SRS-FR-024, SRS-FR-060, SRS-FR-072, SRS-FR-148). `inert` keeps keyboard and pointer out of the hidden terminal. Alternative — unmount the hidden layer and replay output: rejected, the adapters already outlive a mount and xterm holds the scrollback.
- **Fit and focus on reveal.** `TerminalPane` calls the shown layer's `refit` and then `adapter.focus()` in an effect on `view` (after commit, as a hidden element cannot take focus), in addition to the existing maximize and Text Size refits. Choosing a view by keyboard therefore lands the keyboard in the shown terminal.
- **`ShellArea` becomes the Shell view body; `ShellChip` and the divider are deleted.** `ShellArea` keeps opening the adapter, the fit/resize loop and input wiring; it loses `ratio`, `onResize`, the separator and the `border-t bg-card` strip styling, and takes the same padding wrapper as the session body. `ShellFailure` stays as the strip at the bottom of the pane.
- **New `src/components/ViewSwitch.tsx`.** Props: `view`, `shellCommand: string | null` (set only while the shell is hidden and busy), `onChoose(view)`. Renders `<div role="group" aria-label={labels.viewSwitch} className="seg">` with four `<button type="button">`s named "Chat", "Term", "Shell", "Plan"; the current one has `aria-pressed="true"` and `.seg-on`, the others `aria-pressed="false"`. "Chat" and "Plan" get `aria-disabled="true"`, a muted disabled look and an `onClick` that does nothing; they stay in the tab order so a screen reader user finds them and hears that they are unavailable. The Shell item text is `labels.shellRunning(command)` ("Shell · npm run dev", command in `font-mono`, truncating) when `shellCommand` is set. A group of toggle buttons rather than `role="radiogroup"`: a radiogroup would select on arrow keys and, with focus moving into the terminal on every choice, arrow navigation would break; buttons also stay matched by the header's `closest("button")` guard.
- **Header.** `ViewSwitch` replaces `ShellChip` between the state chip and Để dành, `shrink-0` like the icon buttons so the title and chip truncate first. Double-click (SRS-FR-066) and drag (SRS-FR-080) already ignore any target inside a `button`, so the items need no extra code; tests cover them.
- **CSS.** `.seg`, `.seg > button`, `.seg-on` copied from the design into `src/index.css`, plus focus-visible ring and the disabled colour from existing tokens.
- **Labels.** Add `viewSwitch` "Chế độ của ô" (proposed, not in the Bảng nhãn — for PO confirmation), `views` { chat "Chat", term "Term", shell "Shell", plan "Plan" } and `shellRunning(command)` "Shell · <command>". Delete `openShell`, `showShell`, `hideShell`. `shellFailed`, `shellBusy`, `shellCommandStops` stay.

## Risks / Trade-offs

- [xterm fit while hidden: with `display: none` `fit()` reads a 0×0 box and would shrink the PTY to its minimum] → hidden layers use `visibility: hidden` and keep their size; the reveal effect fits again in case an observation was missed. A test checks that a pane resize while Shell is shown also resizes the session, and that showing Term after a maximize fits it.
- [Two live xterm renderers per pane with a shell cost CPU while one is invisible] → only panes with a started shell have the second layer; SRS-NFR-001 (4 panes) is unchanged in kind from today, where the hidden shell also kept its terminal.
- [`inert` on the hidden layer is ignored by jsdom] → tests assert the attribute and the `invisible` class, not focus behaviour of the browser.
- [About 25 tests in `src/PaneShell.test.tsx` reach the shell through `chip()`] → group 1 deletes the tests that pin the chip, the divider or the area, group 2 adds `viewItem(name)`/`shellView()` helpers and repoints the rest in one pass.
- [Users who relied on seeing the session and the shell at once lose the split view] → accepted in CR-016; a second pane in the same folder gives both side by side.

## Migration Plan

UI only; no data migration. The pane snapshot never stored the shell or the view. Rollback = revert the commit.

## Open Questions

None.
