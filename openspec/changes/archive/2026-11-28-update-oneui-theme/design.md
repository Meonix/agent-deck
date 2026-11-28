## Context

The look is set by `design/agent-deck/oneui/design.html` (approved 2026-11-27) and `design/agent-deck/brief.md` › "Đã chốt cho CR-020". This document does not copy tokens or layout; it records how the code reaches that look.

## Goals / Non-Goals

**Goals:** cards on a canvas, round status icons, centred One UI dialogs, every feature and accessible name unchanged.

**Non-Goals:** Files View and Settings Page (items 44, 45) are drawn when built; no new colour; no change to what a pane, row or dialog does; Windows/ConPTY verification is left for the user's own run, like items 38–42.

## Decisions

- **Keep the class names, change their rules.** `.bar`, `.side`, `.dlg`, `.scrim`, `.menu`, `.seg`, `.field`, `.strip`, `.card`, `.toast`, `.chip`, `.btn-danger`, `.outline-btn` stay, so the component tests that check roles and classes keep their meaning; only `src/index.css` rules change. `.btn-danger` and `.outline-btn` become text buttons inside dialogs.
- **Shape tokens come from `design/agent-deck/tokens-oneui.css`,** imported by `src/index.css` after `tokens.css`, like `tokens.css` itself.
- **Gap is the divider.** `PaneGrid` keeps its divider hit areas; each sits in the 12px gap and draws no line. The pane rectangles are inset by half the gap.
- **Focus Outline outside the card.** The pane card gets `outline: 2px solid var(--ring); outline-offset: 2px`, which lands in the gap; the attention border stays an inset 2px ring. This matches pane-layout "the Focus Outline outside that border".
- **Row Focus Mark stays a 3px bar** (SRS mục 2): an inset box-shadow on the left of the rounded row, not the ring drawn in the design (PO, GATE 1).
- **Narrow pane header.** Below 560px pane width (`ResizeObserver` already measures the pane for the terminal), the header renders two lines: icon, title, chip and buttons, then the View Switch.
- **Ended icon.** `Ended` and `Status unavailable` use a hollow 28px ring in `--muted-foreground`, so "hollow" in SRS-FR-032 still holds.

## Risks / Trade-offs

- Terminal area shrinks by about 24px each way per pane → accepted in CR-020 brief ("Đánh đổi đã biết").
- Dark card `#191919` on canvas `#111111` is only 1.07:1 → separation relies on corners and gap; PO approved at GATE 2 of design-ui.
- `backdrop-filter` cost on large windows → one blur layer only while a dialog is open.
