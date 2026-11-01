# Design

## Context

WorkspaceSidebar.tsx renders the three sidebar sections with Tailwind classes mapped to tokens in design/agent-deck/tokens.css through tailwind.preset.js. The Row Focus Mark is `ring-2 ring-inset ring-ring`, shared colour with the pane Focus Outline. Folder Remove is an always-visible bordered text button; the stash × already uses `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`.

## Goals / Non-Goals

**Goals:**
- Match design.html#final in both themes with token changes only, no hard-coded colours.
- Keep every accessible name, header text, tab stop and test-visible behaviour except the two approved ones (Remove visibility, Row Focus Mark class).

**Non-Goals:**
- No change to the pane Focus Outline (`--ring` stays iris-9).

## Decisions

- **A separate `--row-focus` token instead of raising `--ring`.** `--ring` also draws the pane Focus Outline, which SRS fixes at iris and which already passes on `--background`. Only the sidebar row needs the brighter step on dark tints. Alternative: change `--ring` dark to iris-10 — rejected, it would restyle every focus ring in the app.
- **Hide Remove with opacity, not `hidden`/`display:none`.** Opacity keeps the button in the tab order and the accessibility tree; `focus-visible:opacity-100` shows it to keyboard users. Same pattern as the stash ×, so one look for both.
- **Keep header texts in one element.** Tests and users read "Active Sessions · N" as one string; splitting it into label and count spans for styling would change what `getByText` and screen readers see. Styling stays on the existing span.

## Risks / Trade-offs

- [Remove is less discoverable for mouse users] → it appears on row hover, the same convention as the stash ×, and the folder row already has a hover background.
- [Tint contrast values copied by hand] → each value carries its measured ratio in a tokens.css comment, measured with the WCAG script from the design step.
