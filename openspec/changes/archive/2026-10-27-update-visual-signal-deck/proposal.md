# Proposal

## Why

The app looks plain: every icon is a unicode glyph, nothing has hover or transition, three colours are hard-coded, and the terminal ignores the theme's colours. The Signal Deck direction (design/agent-deck/brief.md, "Đã chốt cho Visual Overhaul", design.html#overhaul) restyles every region while keeping the layout and behaviour.

## What Changes

- Swap the slate palette for neutral gray, keep iris as accent (tokens.css is already updated by ux-design-ui).
- Bundle Inter and JetBrains Mono with the app; pane headers, section titles, chips, buttons and the Target Box use the mono face.
- Replace every glyph icon (✕ ⤓ ⤢ ⤡ ☰ ▸ ▾ ‹ › >_) with Lucide icons; accessible names stay as they are. ✓ and ● in the Progress Strip stay text (SRS-FR-119).
- Radius 4px, panes sit flush and are split by 1px lines, hover + 120ms transition on every button.
- Needs Approval pane: the 2px amber border stays and gains an inner glow; Error pane: 2px red border.
- Panes that are neither focused, maximized, Needs Approval nor Error are dimmed with `--pane-dim`.
- Hard-coded colours become tokens: Target Box `--goal`, destructive button text `--error-solid-foreground`, dialog overlay.
- xterm reads its 16 ANSI colours and selection colour from tokens.
- Not in this change: the Toast always using Error colours, and terminals not re-theming when the OS switches light/dark — both are behaviour defects for /dev-bug.

## Capabilities

### New Capabilities
- `app-theme`: how the app signals pane status visually, dims unfocused panes, names icon-only controls, and colours terminals from the design tokens.

### Modified Capabilities

## Impact

- src/App.tsx, src/main.tsx, src/index.css, every file in src/components/ that renders UI, src/components/xtermAdapter.ts.
- design/agent-deck/tokens.css: one new token `--selection` for terminal selection.
- New dependencies: `lucide-react` (ISC), `@fontsource-variable/inter` and `@fontsource/jetbrains-mono` (OFL-1.1).
- Tests that assert on `text-red-500` change to the token class.
