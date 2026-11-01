# Proposal

## Why

The left sidebar reads as three unrelated blocks: the Active Sessions tint (plum) is warm while Folders (sky) and Stashed (teal) are cool, and "+ Add Folder" / "Remove" are bordered text buttons that crowd every folder row. The approved Sidebar Refresh design (design/agent-deck/brief.md, "Đã chốt cho Sidebar Refresh"; design/agent-deck/sidebar/design.html#final) fixes both while keeping the layout and behaviour.

## What Changes

- `--section-active` moves from plum-3 to indigo-3 so the three tints sit on one cool band; all three still meet SRS-NFR-009/010.
- New token `--row-focus` (light iris-9, dark iris-10) draws the Row Focus Mark; on dark tints iris-9 measures 2.8:1, iris-10 at least 3.35:1.
- Section headers become mono, muted labels; their texts stay "Folders", "Active Sessions · N", "Stashed Sessions · N".
- "+ Add Folder" becomes a plus icon button and each folder's "Remove" an × icon button; accessible names and tooltips stay "+ Add Folder" and "Remove <name>".
- A folder's Remove button shows only while its row is hovered or the button has keyboard focus, like the stash ×, and stays in the tab order.
- Not in this change: a "No folders" line or loading skeleton in the sidebar (the main area already shows "No folders yet"), a folder count, the Session History Panel, panes, Toast, row order, and select/remove logic.

## Capabilities

### New Capabilities

### Modified Capabilities
- `app-theme`: "Icon-only controls keep their names" gains the sidebar's Add Folder and Remove controls.
- `workspace-list`: the Remove control is revealed on hover or focus and stays reachable by keyboard.
- `status-board`: the Row Focus Mark keeps at least 3:1 contrast on the Active Sessions tint and the status fills.

## Impact

- src/components/WorkspaceSidebar.tsx, design/agent-deck/tokens.css, design/agent-deck/tailwind.preset.js.
- src/App.test.tsx: two Row Focus Mark assertions move from `ring-ring` to `ring-row-focus`.
- No new dependencies (`lucide-react` is already used).
