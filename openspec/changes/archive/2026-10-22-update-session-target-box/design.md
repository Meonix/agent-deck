## Context

`GoalKeeper` (`src-tauri/src/session_goal.rs`) follows a pane's current session from hook events, pins the first
`UserPromptSubmit` prompt into `GoalStore`, and answers every prompt of a session with a goal with
`reminder_body(goal)`. `hooks::serve` sends a sink's answer back only for `UserPromptSubmit`; `hook_settings`
lets that event's `curl` print to stdout so Claude Code reads the answer, all other events go to `/dev/null`.
The UI receives `{"goal": text | null}` on the pane channel and shows `GoalLine` (one line, ≤ 80 characters,
pencil button). `GoalKeeper::set` ignores a blank text. Requirements: SRS v1.10, CR-010; leftover table approved
at GATE 1.

## Goals / Non-Goals

**Goals:**

- No context of any kind is added to a prompt; the hook path is back to "observe only".
- Target Box: red, below every pane header, 1–3 lines tall then scrolls, placeholder while empty, edits in place.
- `""` is a stored goal: it blocks the first-prompt pin and is never refilled.

**Non-Goals:**

- `GoalStore` file format, `.bak` handling, the resume pin (SRS-FR-097), the session follower: unchanged.
- `design/agent-deck/` files are not updated; the PO chose the layout on the brainstorm mockup (style B).

## Decisions

- **`HookSink::hook` goes back to returning `()`.** With no reminder no sink has an answer, so the answer path
  (`Option<Value>` return, JSON body in `response`, the `UserPromptSubmit` stdout exception in `hook_settings`)
  is removed rather than left returning `None`. This restores the earlier guarantee that nothing a hook port
  returns — even a port taken over after the app died — reaches Claude's context.
- **Store the text as given, trimmed; empty allowed.** `GoalKeeper::set` trims and stores, including `""`, and
  sends it. `hook` pins only when `stored(session)` is `None`, so `""` and text typed before the first prompt both
  win over the prompt. The pinned prompt is trimmed but keeps its inner line breaks.
- **`TargetBox` is a controlled `<textarea>` with a local draft.** The draft follows the `goal` prop while the box
  is not focused. Blur saves when `draft.trim() !== (goal ?? "")`; Escape restores the draft to the goal and blurs
  without saving; Enter inserts a newline (default textarea). The shown value comes back through the existing echo
  (`onGoal`); a failed `setGoal` leaves the old goal stored while the box keeps the typed text until the next goal
  arrives.
- **Height by JS, not `field-sizing`.** After each value change the box sets `height = min(scrollHeight,
  3 × line-height)` with `overflow-y: auto`; WebKit in Tauri does not reliably support `field-sizing: content`.
  jsdom reports `scrollHeight` 0, so tests assert the cap through the `max-height`/`rows` contract, not pixels.
- **Look.** `text-red-500` (red in both themes), `placeholder:` muted red, `bg-card`, bottom border like the old
  line; placeholder "Target — filled from your first prompt". Accessible name "Session target".

## Seams to test

- **S1 — `GoalKeeper` with an in-memory `GoalOut`** (`session_goal.rs`): first prompt pinned and sent, hook
  returns nothing; later prompt keeps the goal; `set("")` stores and sends `""`, next prompt does not pin; `set`
  before any prompt wins over the first prompt; multi-line prompt kept with its line breaks.
- **S2 — `HookServer` over loopback** (`hooks.rs`): every event, `UserPromptSubmit` included, gets `200` with an
  empty body; `hook_settings` discards output for every posted event.
- **S3 — pane spawn with a real hook URL** (`pane_commands.rs`): a resumed pane announces its stored goal; a
  `UserPromptSubmit` response has no body; `set_goal` echoes the new goal.
- **S4 — `TerminalPane` render** (`TerminalPane.test.tsx`): box present with placeholder when `goal` is null;
  shows a multi-line goal in red; typing then blur calls `onSetGoal` with the trimmed text, unchanged blur does
  not; clearing then blur calls `onSetGoal("")`; Escape restores and does not save; Enter adds a newline; a new
  `goal` prop updates the box while not focused; double-click in the box does not maximize.

## Risks / Trade-offs

- [A user mid-edit when a goal echo arrives] → the draft is kept while focused; the echo only applies after blur.
- [Old `session-goals.json` written by the reminder build] → same format; read as before.
