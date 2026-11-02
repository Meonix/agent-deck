# Tasks

## 1. Tokens

- [x] 1.1 In design/agent-deck/tokens.css set the three section tints to the steel values and add `--section-label` and `--section-hover` (light and dark) with measured ratios in comments; verify by re-running the WCAG script on every pair in the comments
- [x] 1.2 Map `section.label` and `section.hover` in tailwind.preset.js; verify `npx vitest run` passes 410 tests

## 2. Sidebar layout

- [x] 2.1 Move "+ Add Folder" to a foot bar after the lists: update the two tab-order tests to the new order first (RED), then change WorkspaceSidebar.tsx (GREEN); lock tests "keeps Add Folder inside the Workspaces sidebar" and "keeps the sidebar list scroll position" stay green
- [x] 2.2 Rows full width with a transparent 2px left border; selected folder gets the `--row-focus` bar plus `--accent`; selected+highlighted keeps its status fill with the bar; add a test that the selected folder row carries the bar class (RED → GREEN)
- [x] 2.3 Section titles uppercase with tracking in `--section-label`, no `border-t` between sections, chips without border, hover rows use `--section-hover`; lock test "keeps the three section titles" and App tint tests stay green

## 3. Verify

- [x] 3.1 `npx vitest run`, `npx tsc --noEmit` and `openspec validate update-sidebar-steel-layout --strict` pass
- [x] 3.2 Render WorkspaceSidebar with sample data in a throwaway page, screenshot light and dark, compare with design.html#final; then run `npm run tauri dev` and check the real app

## Workflow follow-up

- Archive the change, then commit.
