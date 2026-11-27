## Why

CR-016 BO-05 is "work with a session without typing in the terminal". BR-12 asks that the user writes prompts from the pane's own input. In Term, Claude Code helps with a menu of commands after "/" and of files after "@"; the Composer (item 39) has neither, so the user must remember every command and type every path. Backlog item 41 adds both menus (SRS v1.17, SRS-FR-159, SRS-FR-160).

## What Changes

- Typing "/" at the start of the Composer opens a command menu above the input (SRS-FR-159). It lists, filtered by the text typed after "/":
  - Claude Code's built-in commands;
  - the user's commands and skills (`~/.claude/commands`, `~/.claude/skills`);
  - the workspace's commands and skills (`<workspace>/.claude/commands`, `<workspace>/.claude/skills`);
  - the commands and skills of enabled plugins, named `<plugin>:<name>`.
  Each row shows the name and a short description, with "skill", "lệnh" or "plugin" for the ones that are not built in.
- Typing "@" in the Composer opens a file menu (SRS-FR-160). It lists up to 8 files and folders of the session's workspace folder, filtered by the text typed after "@", excluding hidden and git-ignored files. A folder without git is walked, and only hidden files are left out.
- In either menu ↑ and ↓ move the highlight, Tab or Enter puts the highlighted item into the prompt, a click does the same, and Esc closes the menu. While a menu is open, Enter does not send and ↑/↓ do not walk the prompt history.
- The look follows `design/agent-deck/cr016/design.html` › `#composer-menus` (`SLASH`, `AT`).
- Unchanged on purpose:
  - What is sent: a chosen item is plain text in the prompt ("/commit ", "@src/App.tsx "). Claude Code reads it when the prompt is submitted, as if it was typed in Term.
  - Attachments and the paperclip (item 42) are not part of this change.
  - Windows (ConPTY) behaviour is verified later, at the user's request. This change is built and verified on macOS.

## Non-Goals

- Fuzzy matching. Commands match by prefix, files by substring (design.md › Matching).
- Quoting paths that contain spaces. A chosen path is inserted as it is; the SRS does not say how such a path must look → `/ba-change` if it matters.
- Arguments hints for a command (`argument-hint`), and MCP prompts. The SRS lists neither.

## Success Criteria

- SC-1: In a pane of `agent-deck`, typing "/com" in the Composer shows a menu that holds `/compact` (built in) and `/commit` (the user's skill).
- SC-2: Typing "sửa a/b" shows no menu.
- SC-3: Typing "/brain" shows `/superpowers:brainstorming`, marked "plugin", while the superpowers plugin is enabled. It is not shown once the plugin is disabled.
- SC-4: In a pane of `agent-deck`, typing "@App" shows a menu of at most 8 rows that holds `src/App.tsx`.
- SC-5: Typing "@node_modules" or "@.env" in that pane shows no row for `node_modules` or `.env`.
- SC-6: In a workspace folder without git, typing "@" lists its files and folders but no hidden one.
- SC-7: With the command menu open on "/comm", pressing Enter makes the Composer read "/commit " and sends nothing. Esc closes the menu and leaves the text as it is.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `composer`: adds command suggestions (SRS-FR-159) and file suggestions (SRS-FR-160).

## Impact

- Backend:
  - New `src-tauri/src/suggest.rs`. It reads the command sources and lists the workspace's files.
  - Two Tauri commands, `list_commands(pane_id)` and `list_files(pane_id)`. The workspace path comes from the pane on the backend, never from the frontend.
  - `git ls-files` runs in the workspace folder. No new crate.
- Frontend:
  - New `src/components/suggestions.ts`: pure trigger, filter and insert functions, and the built-in command list.
  - New `src/components/SuggestionMenu.tsx`.
  - `Composer.tsx` and `useComposer.ts` open the menu and route its keys.
  - `SessionsClient` gains `listCommands` and `listFiles`.
  - `labels.ts` gains the menu headings and source tags.
- No change to how a prompt is delivered, to status tracking, or to hooks.
