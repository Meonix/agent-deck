import { type PointerEvent, type ReactNode, useRef } from "react";
import { type DividerRect, type Layout, type SplitPath, layoutRects } from "./paneTree";

const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;
const DIVIDER_SIZE = 8;

type Props = {
  layout: Layout;
  /** Kept in a stable order so a pane keeps its place in the tree when the layout changes shape. */
  panes: { id: string; node: ReactNode }[];
  onResize(path: SplitPath, ratio: number): void;
};

export function PaneGrid({ layout, panes, onResize }: Props) {
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
    const min = Math.min((right ? MIN_WIDTH : MIN_HEIGHT) / size, 0.5);
    return Math.max(min, Math.min(1 - min, ratio));
  };

  return (
    <div className="h-full p-1">
      <div ref={grid} data-testid="pane-grid" className="relative h-full min-h-0">
        {panes.map(({ id, node }) => {
          const r = rects.panes[id];
          return (
            <div
              key={id}
              className="absolute flex flex-col min-h-0 min-w-0 p-1 [&>*]:flex-1"
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
        {rects.dividers.map((divider) => (
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
      className={right ? "absolute cursor-col-resize" : "absolute cursor-row-resize"}
      style={
        right
          ? { left: `calc(${at * 100}% - ${DIVIDER_SIZE / 2}px)`, top: `${box.y * 100}%`, width: DIVIDER_SIZE, height: `${box.height * 100}%` }
          : { top: `calc(${at * 100}% - ${DIVIDER_SIZE / 2}px)`, left: `${box.x * 100}%`, height: DIVIDER_SIZE, width: `${box.width * 100}%` }
      }
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
    />
  );
}
