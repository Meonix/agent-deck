## Why

CR-016 (approved 2026-11-24) moves agent-deck onto the look of agent-deck-remote. Backlog item 37 turns the Pane Shell from a chip in the header plus a resizable area under the session into one of the pane's views: every pane header gets the View Switch "Chat · Term · Shell · Plan" of SRS v1.17, the Pane Shell fills the whole pane body in the Shell view, and the view not shown keeps running. The 30% shell strip squeezed the Claude Code terminal and needed a divider drag to be usable; a full-body Shell view gives both terminals the whole pane.

## What Changes

- **BREAKING (UI)** Every pane header shows the View Switch after the state chip: a segmented pill with the items "Chat", "Term", "Shell", "Plan", the current one filled, then Để dành · Phóng to/Thu về · × (SRS-FR-030, SRS-FR-146; `design/agent-deck/cr016/design.html` › `header()`, `seg()`, `#final`, `#views`).
- "Chat" and "Plan" are shown but disabled (`aria-disabled`, cannot be chosen) until backlog items 38 (add-chat-view) and 43 (add-plan-view) build them. Panes open in Term, with keyboard focus in the session terminal (SRS-FR-014).
- **SRS-FR-147 (default view Chat) is not implemented here**: with Chat disabled a pane cannot open in Chat. It moves to item 38 (add-chat-view); backlog rows 37 and 38 are to be corrected through /ba-change.
- **BREAKING (UI)** The Shell chip ("Mở shell" / "Ẩn shell" / "Hiện shell") and the shell area below the session are removed, together with its divider (SRS-FR-059 is `Deleted (CR-016)`). Choosing Shell starts the Pane Shell if the pane has none and shows it over the whole pane body (SRS-FR-055); choosing another view hides it and keeps it running (SRS-FR-056, SRS-FR-148); choosing Shell again shows its previous output (SRS-FR-057).
- While the Pane Shell is hidden and running a command, the Shell item reads "Shell · <command>" (SRS-FR-058); the dot marker on the old chip goes.
- When the shell exits, the Shell view closes and the pane returns to the view it showed before, Term in this change (SRS-FR-061). A shell that cannot start leaves the pane in Term with "Không khởi động được shell" (SRS-FR-065).
- The Pane Shell and the session terminal fit their content to the pane when the pane is resized, maximized or restored and when the Text Size changes (SRS-FR-060, SRS-FR-024); while the Term or Shell view is hidden, its session or shell keeps running and its output is kept (SRS-FR-148).
- Double-clicking or dragging from a View Switch item does not maximize or move the pane, like the other header buttons (SRS-FR-066, SRS-FR-080).
- The view is per pane and is not kept between launches; reopened panes show Term.
- Explanations only: SRS-FR-025 (standard terminal) and SRS-FR-026 (Vietnamese input) apply in the Term view.
- Unchanged on purpose: the Close Dialog and Stash Dialog busy-shell warning (SRS-FR-063, SRS-FR-105), closing a pane ends its shell (SRS-FR-062), the stash button order, the pane split divider (SRS-FR-023). No Chat, Composer or Plan content; no Settings.

## Capabilities

### New Capabilities

- `pane-views`: the View Switch on the pane header and the per-pane view (SRS-FR-146), hidden views keep running (SRS-FR-148).

### Modified Capabilities

- `pane-shell`: the Pane Shell becomes the Shell view (SRS-FR-055, SRS-FR-056, SRS-FR-057), its marker becomes the command name on the Shell item (SRS-FR-058), reflow without a divider (SRS-FR-060), exit returns to the previous view (SRS-FR-061), start failure and abnormal session exit scenarios use the view (SRS-FR-065, SRS-FR-064); "Resize the pane shell" is removed (SRS-FR-059).
- `session-pane`: new panes focus the Term view (SRS-FR-014); SRS-FR-025 and SRS-FR-026 apply in Term; the pane header carries the View Switch (SRS-FR-030).
- `pane-layout`: the header double-click and drag ignore the View Switch items as they ignore Để dành, Phóng to and × (SRS-FR-066, SRS-FR-080).

## Impact

- `src/components/useSessionPanes.ts`: `PaneEntry` gains `view` (`"chat" | "term" | "shell" | "plan"`, starts at `"term"`) and the view to return to; `toggleShell` becomes `chooseView(paneId, view)`; `resizeShell`, `SHELL_RATIO` and `ShellEntry.visible`/`ratio` go; the hidden-shell activity poll keys on `view !== "shell"`.
- `src/components/TerminalPane.tsx`: header renders the new `ViewSwitch`; the body stacks a Term layer and a Shell layer; `onToggleShell`/`onResizeShell` props become `onChooseView`.
- `src/components/PaneShell.tsx`: `ShellChip` and the divider are deleted; `ShellArea` becomes the Shell view body; `ShellFailure` stays.
- New `src/components/ViewSwitch.tsx`; `.seg`/`.seg-on` classes in `src/index.css` from the design.
- `src/labels.ts`: adds the view names, the View Switch group name and `shellRunning(command)`; drops `openShell`, `showShell`, `hideShell`.
- Tests: `src/PaneShell.test.tsx` (chip, divider and area-under-session tests deleted first, see tasks.md group 1), `src/components/TerminalPane.test.tsx` (props), `src/App.test.tsx` (four tests repointed from the chip to the Shell item).
- No backend, PTY command, snapshot format or Claude Code configuration change.
