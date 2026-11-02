# Design

## Context

WorkspaceSidebar.tsx renders an `<aside>` that is itself the scroll container (`overflow-auto`), with three `<section>`s separated by `border-t`, rows inset by `px-2` and rounded, and "+ Add Folder" as an icon button in the Folders header. Tokens live in design/agent-deck/tokens.css and reach Tailwind through tailwind.preset.js.

## Goals / Non-Goals

**Goals:**
- Match design.html#final and its states in both themes with tokens only.
- Keep every accessible name, title text and test-visible behaviour except the two approved at GATE 1 (Add Folder tab position, scroll container).

**Non-Goals:**
- No change to `--muted` itself: panes and dialogs keep using it; only Sidebar rows switch to `--section-hover`.

## Decisions

- **Aside becomes a flex column: a scrolling list area + a fixed foot.** The foot holds "+ Add Folder" so it is always reachable. The list area keeps the `overflow-auto` class and stays mounted while hidden, so its `scrollTop` survives SRS-FR-088 like the aside's did. Alternative: `position: sticky` foot inside the scrolling aside — rejected, sticky at the bottom of a short list floats mid-column.
- **Uppercase by CSS (`uppercase tracking-[0.08em]`), not by changing strings.** Screen readers and tests keep reading "Active Sessions · N".
- **Selected folder = left bar + accent fill.** Rows carry a transparent 2px left border so the bar never shifts text. A highlighted folder keeps its status fill and, when selected, gets the bar instead of the `ring-1`.
- **New tokens rather than reusing `--muted` / `--muted-foreground` for labels and hover.** Grey hover on steel looked off-palette and dark `--muted` (#222) is warmer than the tints; light hover must be lighter than the tint, not darker, because `--muted-foreground` drops to 4.14:1 on a darker steel.

## Risks / Trade-offs

- [Tab order change surprises keyboard users] → "+ Add Folder" remains one Tab stop and keeps its name; approved at GATE 1.
- [Hex values outside Radix] → each token carries its source (palette "Сталь") and measured ratios in tokens.css comments.
