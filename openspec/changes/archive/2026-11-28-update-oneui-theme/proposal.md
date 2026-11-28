## Why

CR-020 (approved 2026-11-27) brings back the One UI look over the CR-016 layout, keeping every feature: the PO finds the floating cards of One UI easier on the eye than the flat agent-deck-remote shapes, and the functions of the remote stay. Backlog item 46. CR-021 lets the status dot of a Session Row be a 28px round status icon. BO-01 (spot sessions that need the user) and BR-06 stay the reason the status signals are kept at full strength.

## What Changes

- **Visual** The window becomes a grey canvas with floating cards: the Sidebar is one card, every pane is its own card with 24px corners and a 12px gap, per `design/agent-deck/oneui/design.html` (layout A, colour v3).
- A shape layer `design/agent-deck/tokens-oneui.css` is loaded after `tokens.css`; colours and fonts do not change.
- Session Rows become two-line rows 52px high that start with a 28px round status icon (CR-021); the Row Focus Mark stays a 3px iris bar on the left edge.
- The pane header starts with the round status icon; the View Switch fills the item shown with `--primary`; a pane narrower than 560px puts the View Switch on a second header line.
- Dialogs and the Session Chooser stay centred (CR-020) with 26px corners over a dimmed, blurred backdrop; dialog actions are text buttons split by vertical rules.
- Composer, Approval Strip, Question Card, Plan card and menus become 18px blocks; the Focus Outline is drawn outside the pane card.
- Sidebar group titles ("Folder khác (N)", "Để dành (N)") become plain 13px `--muted-foreground` subheaders instead of uppercase mono.

## Success Criteria

- SC-1: With two panes open, the main window shows the Sidebar card and two pane cards with a 12px canvas gap between them and 24px corners.
- SC-2: A Session Row in `Needs Approval` shows a 28px round icon on `--approval`, "Cần duyệt" and the light yellow tint.
- SC-3: The Session Chooser opens in the middle of the window with 26px corners over a blurred, dimmed backdrop.
- SC-4: Every Sidebar subheader and every status word keeps a contrast of at least 4.5:1 against the card it sits on, in light and dark.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-theme`: sidebar label contrast measured on the One UI card; new requirement for the card layout.
- `status-board`: Session Row status dot is a 28px round icon (SRS-FR-032, CR-021).
- `session-pane`: pane header starts with the round status icon (SRS-FR-030).
- `session-history`: Session Chooser shape — 26px corners, dimmed and blurred backdrop (SRS-FR-007).

## Impact

- `src/index.css` (imports `tokens-oneui.css`, restyles `.bar`, `.side`, `.side-label`, `.dlg`, `.scrim`, `.menu`, `.seg`, `.field`, `.strip`, `.card`, `.toast`, `.chip`, `.pane-*`), `src/App.tsx`, `src/components/{PaneGrid,TerminalPane,WorkspaceSidebar,statusTone,ViewSwitch,ConfirmDialog,SessionChooser,Composer,ActivityBar,ApprovalStrip,QuestionCard,PlanCard,SuggestionMenu,FolderMenu,Toast}.tsx`.
- Tests that assert the Sidebar label style, the dot shapes and the dialog backdrop.
- No backend, data format or Claude Code configuration change.
