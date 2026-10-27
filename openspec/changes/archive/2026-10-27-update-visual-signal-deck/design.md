# Design

## Context

Tokens already live in design/agent-deck/tokens.css and reach the app through `@import` in src/index.css and the preset loaded by `@config`; changing the tokens re-colours most of the app without code. What tokens cannot reach: glyph icons, hard-coded `text-red-500` / `text-black` / `bg-black/50`, missing hover/transition, pane borders and dimming in TerminalPane, and xterm, which reads only five colours once at creation (src/components/xtermAdapter.ts:20-30). About 40 `toHaveClass` assertions pin class names; most keep passing because token class names (`bg-approval-bg`, `ring-ring`, `border-approval`) do not change.

## Goals / Non-Goals

**Goals:**
- Match design.html#overhaul in both themes with no layout or behaviour change.
- Keep every accessible name and every SRS visual rule (Focus Outline iris, 2px yellow border, red Target Box, ✓/●, section tints).

**Non-Goals:**
- Toast colour per message type, live re-theming of open terminals (behaviour defects, /dev-bug).
- Icon-only "Add Folder": the button keeps its text "+ Add Folder" (SRS 2.1 names the action, tests query it); only its style changes.

## Decisions

- **Icons: `lucide-react`.** Tree-shaken per icon, ISC licence, stroke width set once (1.75). Alternative: inline SVG copies — no dependency, but 12 hand-maintained paths and no updates.
- **Fonts: `@fontsource-variable/inter` + `@fontsource/jetbrains-mono` imported in src/main.tsx.** Vite bundles the woff2 files into the app, so they work offline in Tauri. Alternative: Google Fonts link — breaks offline and leaks requests.
- **Dimming in CSS from props already present.** TerminalPane knows `focused`, `maximized` and the status; it adds `opacity-pane-dim` when none applies. No new state.
- **Glow as a token shadow** `shadow-approval-glow` combined with the existing 2px border classes, so FR-087's border is untouched.
- **xterm palette from tokens** `--ansi-*` and a new `--selection` (iris-5) token: today `selectionBackground` reads `--ring`, which is now iris-9 and too dark behind text in the light theme.
- **Mono face via existing `font-mono`** on headers, section titles, chips and buttons; no new font token.

## Risks / Trade-offs

- [Dimmed panes lower text contrast] → `--pane-dim` is 0.75 dark / 0.9 light, measured ≥4.5 for body text (tokens.css comments).
- [Light amber border is 1.50:1 against the header] → accepted at token gate, unchanged from CR-001.
- [Bundle grows by the two font families] → variable Inter (~350 KB) plus 2 weights of JetBrains Mono (~180 KB); acceptable for a desktop app.
- [Open terminals keep old colours after an OS theme switch] → existing behaviour, left for /dev-bug.
