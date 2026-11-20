# Tasks

## 1. Status Summary content (S1)

- [ ] 1.1 Add `statusSummary(entries)` to `src/components/statusHighlight.ts` per design D1, test-first in `statusHighlight.test.ts`: headline and need count (SRS-FR-132, unavailable excluded), three counts with zero omitted (SRS-FR-133), "clear" (SRS-FR-134), "idle" with no started pane and "clear" with only an ended pane (SRS-FR-135), Go-to target Error-first then earliest `since`, null when clear (SRS-FR-136). Verify: `npx vitest run src/components/statusHighlight.test.ts` green.

## 2. Expanded / collapsed / hidden (S2)

- [ ] 2.1 Add `summaryMode({ maximized, focusInPanes, narrow })` and the `useSummaryMode(paneArea, maximized)` hook per design D2, test-first on the pure function: maximized → hidden, focus in panes → collapsed, narrow → collapsed, else expanded (SRS-FR-137, SRS-FR-138, SRS-FR-139). Verify: `npx vitest run` on its test file green.

## 3. Status Summary in the window (S3)

- [ ] 3.1 Add `StatusSummary.tsx` (expanded and one-line layouts from `design.html#final` and `#final-collapsed`, state marks, Go-to button, Status Latency button at the right end) and mount it in `App.tsx` above the Workbench in place of the title bar (design D3); write the S3 tests in `App.test.tsx` first: "3 need you" / "All clear" / "Agent Deck · No sessions running" after status events (SRS-FR-132 to SRS-FR-135, SRS-FR-140), Go-to click focuses the target pane (SRS-FR-136), focus in a pane collapses and focus in the Sidebar expands (SRS-FR-137), stubbed `matchMedia` collapses (SRS-FR-138), maximize hides and restore shows (SRS-FR-139), Status Latency still opens its report (SRS-FR-039). Verify: `npm test` green.

## 4. One UI look (design D5)

- [ ] 4.1 Load `design/agent-deck/oneui/tokens-oneui.css` in `src/index.css`, map `--oneui-*` into the Tailwind theme, turn the Workbench into the padded canvas with gaps and make Sidebar, Session History Panel and panes rounded cards (`App.tsx`, `PaneGrid.tsx`), keeping pane dividers draggable in the gaps. Verify: `npm test` green and `npm run build` passes.
- [ ] 4.2 Sidebar and Session History Panel in One UI form (`WorkspaceSidebar.tsx`, `SessionHistoryPanel.tsx`, `statusTone.tsx`): grouped blocks on the existing section tints, 28 px round marks (folder, state with Lucide icon, unavailable), "+ Add Folder" kept in the pinned bottom bar as a pill, all accessible names unchanged. Verify: `npm test` green, including `WorkspaceSidebar.test.tsx` and the app-theme icon-name tests.
- [ ] 4.3 Pane card header in Inter with the round state mark, terminal on `--oneui-term`, One UI confirm dialog and pill toast (`TerminalPane.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`), satisfying the modified "Fonts work offline" requirement; attention borders, dimming and Focus Outline unchanged. Verify: `npm test` green.

## 5. Integration check

- [ ] 5.1 Run the app (`npm run dev` in a browser with the fake clients, or `npm run tauri dev`) and capture the main window at 1280×800 in dark and light, with the Status Summary expanded and collapsed, a maximized pane and a 960 px window; compare with `design.html#final`, `#final-collapsed`, `#maximized`, `#narrow` (SC-4, SC-5). Verify: screenshots read and differences listed in the report.

## Workflow follow-up

- `openspec validate add-status-summary --strict`, safety fact, review, GATE 3.
- Archive the change, set backlog item 29 to `archived`, commit.
