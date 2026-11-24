## Context

CR-016 item 34. The approved design is `design/agent-deck/cr016/design.html` (layout A, colour v1 "Bản remote"); its rules are in `design/agent-deck/brief.md` › "Đã chốt cho CR-016". `design/agent-deck/tokens.css` already holds the agent-deck-remote tokens (commit 9a568eb). Today `src/index.css` also loads `oneui/tokens-oneui.css` and maps the One UI shape utilities (`rounded-card`, `bg-canvas`, `bg-surface`, `gap-gap`, `shadow-oneui`, `backdrop-blur-oneui` …) used by 8 files. About 90 user-facing strings are English literals spread over `src/`.

Items 35–37 rebuild the sidebar (Folder Tree), the history panel (Session Chooser) and the pane header (View Switch). This change must not do their work; it only swaps the visual foundation and the language underneath the current structure.

## Goals / Non-Goals

**Goals:** remote tokens and flat shapes everywhere; no One UI utility left; every visible string, tooltip and accessible name in Vietnamese from one table; status word contrast proven by a test.

**Non-Goals:** new layout of sidebar, history panel or pane header; new features (Chat, Composer …); changing unfocused-pane dimming (kept, user decision at GATE 1).

## Decisions

- **One label table, `src/labels.ts`.** A plain object of strings and small functions for the strings with parameters (`removeFolder(name)`, `sessionsCouldNotBeRead(n)` …). Keys are English, values Vietnamese, matching SRS v1.16 › Bảng nhãn. Tests import the same table instead of repeating literals, so a wording change touches one file. Alternative — an i18n library: rejected, one language only, nothing to switch at runtime.
- **State names stay English in code.** `SessionState` values (`"Needs Approval"` …) are data and test fixtures; only their display goes through `labels.state[state]`. Renaming the union would ripple through the backend channel for no user value.
- **Shapes from the remote classes, as Tailwind utilities.** Port the few semantic classes the current components need (`.side`, `.bar`, `.dlg`, `.scrim`, `.chip-*`, `.allow`/`.outline-btn`/`.btn-danger`, `.toast`) into `src/index.css`, copied from `agent-deck-remote/web/src/index.css`, so later items reuse them. Remove the One UI `@theme inline` block and the import. Panes sit edge to edge, separated by the existing 1px split borders, `--radius` 4px.
- **RoundMark becomes the remote marker.** States render as the 8px dot (`dot-app` ring for Needs Approval), folder/history/stash marks as a muted Lucide icon without the filled circle. Same component name, so items 35–37 replace it rather than this change.
- **Dialog keeps its behaviour**, only the look changes: centred, `.scrim` 45% black, `.dlg` 14px radius, Cancel as outline button, confirm filled (iris, red for Trash actions).
- **Contrast test** reads `design/agent-deck/tokens.css` and measures the SRS-NFR-014 pairs plus the modified sidebar-label pairs with the WCAG formula, in both themes.

## Risks / Trade-offs

- [Strings missed by the sweep stay English] → a test greps the rendered app (App.test) for a list of known English labels and fails on any hit; plus a grep of `src/` for capitalised English literals in JSX before GATE 3.
- [Approval border light 1.50:1 on light] → accepted since CR-001; chip, row tint and strip still signal.
- [Sidebar without tints reads as one block until item 35] → interim, item 35 follows immediately.

## Migration Plan

Visual only; no data migration. Rollback = revert the commit. `design/agent-deck/oneui/` is deleted in the same change once no file imports it.

## Open Questions

None.
