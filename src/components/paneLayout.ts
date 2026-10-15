/** Places `newId` right after the focused pane, or at the end when nothing is focused. */
export function insertRight(order: string[], focusedId: string | null, newId: string): string[] {
  const at = focusedId === null ? -1 : order.indexOf(focusedId);
  if (at === -1) return [...order, newId];
  return [...order.slice(0, at + 1), newId, ...order.slice(at + 1)];
}

// Pixel sizes of the classes in PaneGrid (p-2, gap-2) and TerminalPane
// (border, header, p-1 around the terminal); keep them in step.
const GRID_PADDING = 8;
const GRID_GAP = 8;
const PANE_BORDER = 1;
const PANE_HEADER = 29;
const BODY_PADDING = 4;

export type Box = { width: number; height: number };

/** The terminal's box in each of `columns` panes laid out in a grid that fills `area`. */
export function paneBodySize(area: Box, columns: number): Box {
  const paneWidth = (area.width - 2 * GRID_PADDING - GRID_GAP * (columns - 1)) / columns;
  const width = Math.floor(paneWidth - 2 * PANE_BORDER - 2 * BODY_PADDING);
  const height = Math.floor(area.height - 2 * GRID_PADDING - 2 * PANE_BORDER - PANE_HEADER - 2 * BODY_PADDING);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}
