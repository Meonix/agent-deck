export type SplitDir = "right" | "down";
export type Layout =
  | { pane: string }
  | { split: SplitDir; ratio: number; first: Layout; second: Layout };
export type SplitPath = ("first" | "second")[];
export type Rect = { x: number; y: number; width: number; height: number };
export type DividerRect = { path: SplitPath; dir: SplitDir; box: Rect; at: number };

/** Splits the target pane (the last pane when it is null or unknown); the new pane goes second. */
export function splitPane(layout: Layout | null, targetId: string | null, newId: string, dir: SplitDir): Layout {
  if (layout === null) return { pane: newId };
  const order = paneOrder(layout);
  const target = targetId !== null && order.includes(targetId) ? targetId : order[order.length - 1];
  return replaceLeaf(layout, target, (leaf) => ({ split: dir, ratio: 0.5, first: leaf, second: { pane: newId } }));
}

function replaceLeaf(layout: Layout, id: string, make: (leaf: Layout) => Layout): Layout {
  if ("pane" in layout) return layout.pane === id ? make(layout) : layout;
  return {
    ...layout,
    first: replaceLeaf(layout.first, id, make),
    second: replaceLeaf(layout.second, id, make),
  };
}

/** The removed pane's sibling takes its parent's place; the last pane leaves no layout. */
export function removePane(layout: Layout, id: string): Layout | null {
  if ("pane" in layout) return layout.pane === id ? null : layout;
  const first = removePane(layout.first, id);
  const second = removePane(layout.second, id);
  if (first === null) return second;
  if (second === null) return first;
  return first === layout.first && second === layout.second ? layout : { ...layout, first, second };
}

export function setRatio(layout: Layout, path: SplitPath, ratio: number): Layout {
  if ("pane" in layout) return layout;
  if (path.length === 0) return { ...layout, ratio };
  const [head, ...rest] = path;
  const child = setRatio(layout[head], rest, ratio);
  return child === layout[head] ? layout : { ...layout, [head]: child };
}

/** The least pixels a layout needs along an axis so every pane in it keeps minPx. */
export function minSpan(layout: Layout, dir: SplitDir, minPx: number): number {
  if ("pane" in layout) return minPx;
  const first = minSpan(layout.first, dir, minPx);
  const second = minSpan(layout.second, dir, minPx);
  return layout.split === dir ? first + second : Math.max(first, second);
}

export function paneOrder(layout: Layout | null): string[] {
  if (layout === null) return [];
  if ("pane" in layout) return [layout.pane];
  return [...paneOrder(layout.first), ...paneOrder(layout.second)];
}

export function layoutRects(layout: Layout | null): { panes: Record<string, Rect>; dividers: DividerRect[] } {
  const panes: Record<string, Rect> = {};
  const dividers: DividerRect[] = [];
  if (layout !== null) place(layout, { x: 0, y: 0, width: 1, height: 1 }, [], panes, dividers);
  return { panes, dividers };
}

function place(layout: Layout, box: Rect, path: SplitPath, panes: Record<string, Rect>, dividers: DividerRect[]) {
  if ("pane" in layout) {
    panes[layout.pane] = box;
    return;
  }
  const { split, ratio } = layout;
  let firstBox: Rect;
  let secondBox: Rect;
  let at: number;
  if (split === "right") {
    const width = box.width * ratio;
    at = box.x + width;
    firstBox = { ...box, width };
    secondBox = { ...box, x: at, width: box.width - width };
  } else {
    const height = box.height * ratio;
    at = box.y + height;
    firstBox = { ...box, height };
    secondBox = { ...box, y: at, height: box.height - height };
  }
  dividers.push({ path, dir: split, box, at });
  place(layout.first, firstBox, [...path, "first"], panes, dividers);
  place(layout.second, secondBox, [...path, "second"], panes, dividers);
}
