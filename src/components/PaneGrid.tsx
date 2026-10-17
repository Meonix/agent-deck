import { type PointerEvent, type ReactNode, useRef } from "react";
import { type DividerRect, type Layout, type SplitPath, layoutRects, minSpan } from "./paneTree";

const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;
const DIVIDER_SIZE = 8;

function subtree(layout: Layout, path: SplitPath): Layout {
  return path.reduce<Layout>((node, step) => ("pane" in node ? node : node[step]), layout);
}

type Props = {
  layout: Layout;
  /** Rendered in a fixed order so React never moves a pane's DOM node, which would re-attach its terminal. */
  panes: { id: string; node: ReactNode }[];
  /** Shown over the whole window below the title bar; the others keep their size, hidden in place. */
  maximizedId: string | null;
  onResize(path: SplitPath, ratio: number): void;
};

// top-9 matches the h-9 title bar in App.
const MAXIMIZED = "fixed inset-x-0 bottom-0 top-9 z-10 flex flex-col min-h-0 min-w-0 p-2 bg-background [&>*]:flex-1";

export function PaneGrid({ layout, panes, maximizedId, onResize }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const rects = layoutRects(layout);

  const ratioAt = (divider: DividerRect, e: PointerEvent) => {
    const area = grid.current!.getBoundingClientRect();
    const right = divider.dir === "right";
    const size = (right ? area.width : area.height) * (right ? divider.box.width : divider.box.height);
    if (size === 0) return null;
    const start = right
      ? area.left + area.width * divider.box.x
      : area.top + area.height * divider.box.y;
    const ratio = ((right ? e.clientX : e.clientY) - start) / size;
    const minPx = right ? MIN_WIDTH : MIN_HEIGHT;
    const split = subtree(layout, divider.path);
    if ("pane" in split) return null;
    const minFirst = minSpan(split.first, divider.dir, minPx) / size;
    const minSecond = minSpan(split.second, divider.dir, minPx) / size;
    // Both sides cannot fit: keep the ratio rather than jump.
    if (minFirst + minSecond > 1) return null;
    return Math.max(minFirst, Math.min(1 - minSecond, ratio));
  };

  return (
    <div className="h-full p-1">
      <div ref={grid} data-testid="pane-grid" className="relative h-full min-h-0">
        {panes.map(({ id, node }) => {
          const r = rects.panes[id];
          if (id === maximizedId) {
            return (
              <div key={id} className={MAXIMIZED}>
                {node}
              </div>
            );
          }
          const covered = maximizedId !== null;
          return (
            <div
              key={id}
              inert={covered}
              className={`absolute flex flex-col min-h-0 min-w-0 p-1 [&>*]:flex-1 ${covered ? "invisible" : ""}`}
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.width * 100}%`,
                height: `${r.height * 100}%`,
              }}
            >
              {node}
            </div>
          );
        })}
        {maximizedId === null &&
          rects.dividers.map((divider) => (
            <Divider key={divider.path.join("/")} divider={divider} ratioAt={ratioAt} onResize={onResize} />
          ))}
      </div>
    </div>
  );
}

type DividerProps = {
  divider: DividerRect;
  ratioAt(divider: DividerRect, e: PointerEvent): number | null;
  onResize(path: SplitPath, ratio: number): void;
};

function Divider({ divider, ratioAt, onResize }: DividerProps) {
  const dragging = useRef(false);
  const { box, dir, at, path } = divider;
  const right = dir === "right";
  const move = (e: PointerEvent) => {
    if (!dragging.current) return;
    const ratio = ratioAt(divider, e);
    if (ratio !== null) onResize(path, ratio);
  };
  return (
    <div
      role="separator"
      aria-orientation={right ? "vertical" : "horizontal"}
      className={right ? "absolute touch-none select-none cursor-col-resize" : "absolute touch-none select-none cursor-row-resize"}
      style={
        right
          ? { left: `calc(${at * 100}% - ${DIVIDER_SIZE / 2}px)`, top: `${box.y * 100}%`, width: DIVIDER_SIZE, height: `${box.height * 100}%` }
          : { top: `calc(${at * 100}% - ${DIVIDER_SIZE / 2}px)`, left: `${box.x * 100}%`, height: DIVIDER_SIZE, width: `${box.width * 100}%` }
      }
      onPointerDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
      onPointerCancel={() => (dragging.current = false)}
      onLostPointerCapture={() => (dragging.current = false)}
    />
  );
}
