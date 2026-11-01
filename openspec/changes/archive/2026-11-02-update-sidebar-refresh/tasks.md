# Tasks

## 1. Tokens

- [x] 1.1 In design/agent-deck/tokens.css set `--section-active` to indigo-3 (light #edf2fe, dark #182449) and add `--row-focus` (light #5b5bd6, dark #6e6ade) with measured ratios in comments; verify by re-running the WCAG script on every pair listed in the comments
- [x] 1.2 Map `row-focus` in design/agent-deck/tailwind.preset.js; verify `npx vitest run` still passes 407 tests

## 2. Sidebar

- [x] 2.1 Row Focus Mark uses `ring-row-focus`: update the two App.test.tsx assertions first (RED), then WorkspaceSidebar.tsx (GREEN)
- [x] 2.2 Folder Remove becomes an × icon button revealed on row hover or focus: add a test that the button carries `opacity-0` and `focus-visible:opacity-100` (RED), then change it (GREEN); lock tests "keeps Remove in the tab order" and "gives each Remove button a distinct name" stay green
- [x] 2.3 "+ Add Folder" becomes a plus icon button with aria-label and title "+ Add Folder"; existing Add Folder tests stay green
- [x] 2.4 Section headers restyled per design.html#final with unchanged texts; lock test "keeps the three section titles" stays green

## 3. Verify

- [x] 3.1 `npx vitest run` and `npx tsc --noEmit` pass; `openspec validate update-sidebar-refresh --strict` passes
- [x] 3.2 Run the app (`npm run tauri dev` or `npm run dev`) and compare the sidebar against design.html#final in light and dark

## Workflow follow-up

- Archive the change, then commit.
