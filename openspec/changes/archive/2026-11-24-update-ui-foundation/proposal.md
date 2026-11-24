## Why

CR-016 (approved 2026-11-24) moves agent-deck onto the look of agent-deck-remote, which the user works in every day and finds easier to use. Backlog item 34 is the foundation every later item builds on: the remote's tokens and flat shapes instead of the One UI layer, and Vietnamese labels instead of English (SRS v1.16 turned SRS-NFR-008 around, dropped the section tints SRS-NFR-009/010, and added a contrast rule for status words SRS-NFR-014).

## What Changes

- **BREAKING (visual)** Drop the One UI shape layer: no grey canvas, no 24px floating cards, no 12px gaps, no blurred bottom-sheet dialogs. The window becomes flat like agent-deck-remote: sidebar on `--card` with a right border, pane headers as `.bar`, panes edge to edge separated by 1px borders, dialogs centred with a 45% black scrim and 14px radius, a pill toast.
- The Needs Approval pane keeps its 2px border but loses the inner glow (design v1 has no glow).
- Every label, message, tooltip and accessible name the app shows switches to Vietnamese, from one label table (`src/labels.ts`) matching the Bảng nhãn of SRS section 7.
- Sidebar sections lose their background tints (SRS-NFR-009, SRS-NFR-010 deleted).
- Status words and status-tinted rows keep a text contrast of at least 4.5:1 in light and dark (SRS-NFR-014).
- Unchanged on purpose: layout of the sidebar sections, the Session History Panel and the pane header (items 35–37 rebuild them), unfocused panes still dim.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-shell`: interface language requirement (SRS-NFR-008) changes from English to Vietnamese.
- `app-theme`: attention panes lose the inner glow; icon-only controls carry Vietnamese names; sidebar label contrast is measured on `--card` instead of the section tints.
- `status-board`: Sidebar section tints (SRS-NFR-009) removed; status word contrast (SRS-NFR-014) added.
- `session-stash`: Stashed Sessions tint (SRS-NFR-010) removed.

## Impact

- `src/index.css` (drops the `oneui/tokens-oneui.css` import and the One UI `@theme inline` block), `src/labels.ts` (new), `src/App.tsx`, `src/components/{WorkspaceSidebar,SessionHistoryPanel,PaneGrid,TerminalPane,PaneShell,ConfirmDialog,Toast,statusTone,statusHighlight}.tsx|ts`, `src/api/sessions.ts` (relative time strings).
- Tests that assert English strings: `App.test.tsx`, `WorkspaceSidebar.test.tsx`, `TerminalPane.test.tsx`, `PaneShell.test.tsx`, `statusTone.test.tsx`, `statusHighlight.test.ts`, `api/sessions.test.ts`.
- `design/agent-deck/oneui/` is deleted once nothing imports it. `design/agent-deck/tokens.css` already holds the remote tokens (commit 9a568eb).
- No backend, data format or Claude Code configuration change.
