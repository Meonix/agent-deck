## Context

This is CR-016 backlog item 41 (SRS v1.17: SRS-FR-159, SRS-FR-160; SRS § 6 "git của workspace"). The Composer (item 39) is a textarea in `Composer.tsx` whose state lives in `useComposer.ts`. Enter sends; ↑/↓ walk the prompt history when the field is empty or a recalled prompt is shown. The look comes from `design/agent-deck/cr016/design.html` › `#composer-menus`: a `.menu` box above the input, a `side-label` heading ("Lệnh", "File trong <folder>"), `h-8` rows, `.pick-on` on the highlighted row, the name in `font-mono`, and a `.sub` description. A file row has a `file` or `folder` icon. These classes are already in `src/index.css`.

Measured on this Mac (2026-11-26, Claude Code 2.1.332):
- User skills: `~/.claude/skills/<dir>/SKILL.md`, with YAML frontmatter `name` and `description`. Some directories hold no `SKILL.md` (`synced/`) and are not skills.
- Workspace commands: `<workspace>/.claude/commands/opsx/apply.md` shows as `/opsx:apply` in Claude Code.
- Plugins:
  - `~/.claude/settings.json` › `enabledPlugins` maps `figma@claude-plugins-official` and `superpowers@claude-plugins-official` to `true`.
  - `~/.claude/plugins/installed_plugins.json` › `plugins.<id>[].installPath` gives the folder.
  - A plugin's skills are `<installPath>/skills/<dir>/SKILL.md` and show as `superpowers:brainstorming`. Neither installed plugin has a `commands/` folder; the format is the same as a user command.
- Built-in commands are not written in any file. Task 1.1 measured them from the real "/" menu: 225 rows, 112 of them not from a file source. They are recorded with Claude Code's own descriptions in `builtins-2.1.332.json` next to this file. Some descriptions carry live state (`/model` "(currently Opus 5.5)", `/fast`, `/sandbox`, the free counts of `/code-review` and `/ultrareview`).
- Claude Code also lists the skills synced from the user's account: `~/.claude/skills/synced/<id>/<dir>/SKILL.md` (`/docs`, `/pdf`). Some skills appear under a prefix with no folder this change can read (`anthropic-skills:`, `humanizer:`).

## Goals / Non-Goals

**Goals:**
- A "/" menu with the four command sources and an "@" menu with up to 8 workspace files, both driven only by the keyboard or a click.
- No delay per keystroke: the lists are fetched once when a menu opens, then filtered in the frontend.

**Non-Goals:**
- Windows/ConPTY verification, later at the user's request.
- Fuzzy matching, quoting paths with spaces, argument hints and MCP prompts (proposal › Non-Goals).
- Attachments (item 42).

## Decisions

### Where the lists come from
- **Backend (`suggest.rs`), not the frontend.** Only the backend can read `~/.claude` and run git. The pane's workspace path is looked up from `pane_id` (`Panes::workspace_of` → the workspace list), so the frontend never names a path.
- **`list_commands(pane_id) → [{name, description, source}]`**, with `source` one of `user-skill`, `user-command`, `workspace-skill`, `workspace-command`, `plugin`.
  - Commands: every `*.md` under a `commands/` folder. The name is the relative path without `.md`, with `/` written as `:` (`opsx/apply.md` → `opsx:apply`).
  - Skills: `skills/<dir>/SKILL.md`, and for the user also `skills/synced/<id>/<dir>/SKILL.md` (source `user-skill`). The name is the frontmatter `name`, else `<dir>`. A skill whose frontmatter says `user-invocable: false` is left out.
  - Prefixed skills with no readable folder (`anthropic-skills:`, `humanizer:`) are not listed. Ruling: no documented source exists for them; the cost is a few missing rows.
  - Plugins: an id is enabled when `enabledPlugins` maps it to `true` in `~/.claude/settings.json`, `<workspace>/.claude/settings.json` or `<workspace>/.claude/settings.local.json`; the later file wins. The name is `<plugin>:<name>`, where `<plugin>` is the part of the id before "@".
  - Description: the frontmatter `description`, first line, cut to 80 characters.
  - The same name twice: the workspace wins over the user, and the user wins over a plugin.
  - A missing or unreadable file or folder is skipped, never an error.
- **Built-in commands are a list in `suggestions.ts`**, taken from `builtins-2.1.332.json` (task 1.1) with Claude Code's own English description. Live state is cut from a description: `/model` → "Switch model", `/fast` → "Toggle fast mode", `/sandbox` → "Configure the sandbox", and the free counts of `/code-review` and `/ultrareview`. Ruling: the English text is what Claude Code shows in Term, so the two menus read the same; the cost if wrong is translating one list. Alternative: read the list from the binary. Rejected, because the binary's strings carry no stable format.
- **`list_files(pane_id) → {folder, entries: [{path, dir}]}`**, where `folder` is the workspace folder's name for the heading.
  - With git: `git -c core.fsmonitor=false ls-files -z --cached --others --exclude-standard`, run in the workspace folder. `core.fsmonitor=false` stops a repository's own config from starting a program.
  - Folders are the parent folders of the listed files, each written with a trailing `/`.
  - Without git (the command fails or the folder is not in a repository): walk the folder, follow no symlinks, and skip entries whose name starts with ".".
  - Either way, a path with a part that starts with "." is dropped, and the list stops at 20 000 entries.

### When a menu opens (`trigger(text, caret)`)
- **Command:** the text starts with "/" and the caret is inside the first word, so there is no space or line break between "/" and the caret. The query is the text between them.
- **File:** the word that ends at the caret starts with "@", and that "@" is at the start of the text or follows a space or a line break. The query is the rest of the word.
- Otherwise there is no menu. Esc closes the menu until that trigger is gone: another "/" or "@" word opens it again.

### Matching
- **Commands:** case-insensitive prefix match on the full name, or on the part after the last ":". Full-name matches come first, then alphabetical order. All matches are listed; the box shows 8 rows and scrolls.
- **Files:** case-insensitive substring of the path.
  - Ranking: first, files whose name starts with the query; then paths that start with it; then the rest. Within each group, shorter path first, then alphabetical order.
  - At most 8 rows (SRS-FR-160). An empty query lists the shortest paths first.

### Choosing
- `apply(text, trigger, item)` replaces the trigger word with the item and returns the new text and caret.
  - A command becomes `/<name> `.
  - A file becomes `@<path> `.
  - A folder becomes `@<path>/` with no space, so the menu stays open on the files under it.
- Keys while a menu is open:
  - ↑/↓ move the highlight and wrap around.
  - Tab and Enter choose the highlighted item.
  - Esc closes the menu.
  - Enter during an IME composition is left alone, as today.
  - ↑/↓ never reach the history handler while a menu is open.
- A mouse click on a row chooses it. `mousedown` is prevented, so the textarea keeps focus.
- Accessibility:
  - The textarea gets `aria-controls` and `aria-activedescendant`.
  - The menu is a `listbox` and each row an `option`.

### Loading
- `useComposer` fetches the list when a menu of that kind opens. It keeps the list while the menu stays open and drops it when the menu closes, so a new skill or file shows the next time. A reply that arrives after the menu closed is ignored.
- Until the list arrives, or when it fails, no menu is shown. An empty match list shows no menu.

## Seams to test

1. `suggest::commands(home, workspace)`, with temp folders as fixtures:
   - all four sources;
   - an enabled and a disabled plugin;
   - `user-invocable: false`;
   - a folder without `SKILL.md`;
   - name clashes;
   - description cut.
2. `suggest::files(workspace)`:
   - a temp git repository with `.gitignore`, a hidden file, an untracked file and a subfolder;
   - a folder without git;
   - the 20 000 cap.
3. `suggestions.ts` pure functions: `trigger`, `matchCommands`, `matchFiles`, `apply`, against the SRS examples.
4. `Composer` with a fake `SessionsClient`, in RTL:
   - typing opens the menu;
   - ↑/↓, Tab, Enter, Esc and a click;
   - Enter with the menu open sends nothing;
   - ↑ in an empty Composer with no menu still recalls history.
5. Real app on macOS (`qa-verify-after-dev`): SC-1 to SC-7 in a pane of `agent-deck` and in a folder without git. Then a chosen "/commit " and "@src/App.tsx" are submitted, to check that Claude Code takes them.

## Risks / Trade-offs

- Claude Code may change its sources or its built-in list → the list is one constant and the readers are one module, each with a test of the measured layout.
- In a large repository, `git ls-files` takes time → it runs on a blocking thread, once per menu opening, capped at 20 000 entries.
- A pasted "/commit" may not run as a command in Claude Code → seam 5 checks this on the real app before archive.
