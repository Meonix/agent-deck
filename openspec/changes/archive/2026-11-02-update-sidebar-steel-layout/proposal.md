# Proposal

## Why

The first Sidebar Refresh (archive 2026-11-02-update-sidebar-refresh) kept the old block layout and changed one tint, so the sidebar still looked the same. The user picked layout C and the "Сталь" steel palette in a second design round (design/agent-deck/brief.md, "Đã chốt cho Sidebar Refresh vòng 2"; design/agent-deck/sidebar/design.html#final).

## What Changes

- Section tints move to steel: Folders #18212A / #E7EDF2, Active Sessions #1F2C38 / #DDE4EB, Stashed Sessions #10161C / #F0F3F6 (dark / light), all within SRS-NFR-009/010.
- New tokens `--section-label` (uppercase section titles, steel) and `--section-hover` (row hover, steel instead of grey `--muted`).
- Layout C: rows span the full sidebar width; the selected folder shows a 2px `--row-focus` bar on its left edge plus the `--accent` fill; section titles render uppercase with letter spacing (DOM text unchanged); no borders between sections; folder chips lose their border.
- "+ Add Folder" moves to a bar pinned at the foot of the sidebar; the lists scroll above it. **Tab order changes**: "+ Add Folder" now comes after every list row instead of before the first folder.
- Only the list area scrolls; its position still survives hiding and showing the Sidebar (SRS-FR-088).
- Not in this change: accessible names, section title texts, the "time · reason" subline, the Row Focus Mark ring, the Sidebar Toggle position, select/remove logic, Session History Panel, panes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `workspace-list`: "+ Add Folder" sits at the sidebar foot after the lists in tab order; the Remove control's keyboard scenario follows the new order.
- `app-theme`: section titles and hovered rows keep readable contrast on the steel tints.

## Impact

- src/components/WorkspaceSidebar.tsx, design/agent-deck/tokens.css, design/agent-deck/tailwind.preset.js.
- src/components/WorkspaceSidebar.test.tsx: two tab-order tests follow the new order.
- No new dependencies.
