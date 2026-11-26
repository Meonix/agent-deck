## 1. Command sources (tests first) — seam 1

- [x] 1.1 Measure Claude Code 2.1.332's built-in commands. Open its "/" menu in a scratch PTY in a scratchpad folder; no prompt is sent. Record name and meaning for `suggestions.ts` (`builtins-2.1.332.json`).
- [x] 1.2 RED `suggest.rs` tests for `commands(home, workspace)`:
  - user skills (also under `skills/synced/<id>/`) and commands, workspace skills and commands (`opsx/apply.md` → `opsx:apply`);
  - enabled plugin skills named `<plugin>:<name>`; a disabled plugin is left out;
  - `user-invocable: false` and a folder without `SKILL.md` are left out;
  - a name clash keeps the workspace, then the user;
  - the description is its first line, cut to 80 characters.
  (SRS-FR-159)
- [x] 1.3 Implement `commands` → GREEN.

## 2. Workspace files (tests first) — seam 2

- [ ] 2.1 RED `suggest.rs` tests for `files(workspace)`:
  - in a temp git repository: tracked and untracked files, no git-ignored ones (`node_modules/`), no hidden ones (`.env`, `.github/x`); parent folders with a trailing `/`;
  - in a folder without git: walked, hidden entries skipped;
  - at most 20 000 entries.
  (SRS-FR-160)
- [ ] 2.2 Implement `files` with `git -c core.fsmonitor=false ls-files -z --cached --others --exclude-standard`, falling back to a walk → GREEN.
- [ ] 2.3 Tauri commands `list_commands(pane_id)` and `list_files(pane_id)`, with the workspace looked up from the pane and the work done on a blocking thread. Register them in `lib.rs`. Add `SessionsClient.listCommands` / `listFiles`, with an `invoke` test in `sessions.test.ts`.

## 3. Menu logic (tests first) — seam 3

- [ ] 3.1 RED `src/components/suggestions.test.ts`:
  - `trigger`: "/com" → command "com"; "sửa a/b" → none; "Xem lại @src/comp" → file "src/comp"; "a@b" → none; "/commit x" → none.
  - `matchCommands`: "/com" → `/compact` and `/commit`; "brain" → `superpowers:brainstorming`.
  - `matchFiles`: "App" → `src/App.tsx`, at most 8, ranked by design.md › Matching.
  - `apply` for a command, a file and a folder.
  (SRS-FR-159, SRS-FR-160)
- [ ] 3.2 Implement `suggestions.ts`, with the built-in list from 1.1 → GREEN.

## 4. Menu in the Composer (tests first) — seam 4

- [ ] 4.1 RED `Composer` RTL tests with a fake client:
  - "/com" shows the menu with `/compact` and `/commit` marked "skill";
  - Enter on "/comm" gives "/commit " and nothing is written;
  - Tab on a file; Enter on a folder keeps the menu open;
  - Esc closes the menu; ↑/↓ move the highlight; a click chooses;
  - with no menu, ↑ in an empty Composer still recalls history;
  - the file menu shows at most 8 rows under "File trong agent-deck".
  (SRS-FR-159, SRS-FR-160)
- [ ] 4.2 Implement `SuggestionMenu.tsx`, the Composer key routing and the fetch in `useComposer.ts`, plus labels, following `#composer-menus` → GREEN.

## 5. Verify

- [ ] 5.1 Real app on macOS (`qa-verify-after-dev`): SC-1 to SC-7 in a pane of `agent-deck` and of a folder without git. Then submit a chosen "/commit"-style command and an "@" file to check that Claude Code takes them.
