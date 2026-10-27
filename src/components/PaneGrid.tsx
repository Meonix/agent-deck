import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { type DividerRect, type Layout, type Rect, type Side, type SplitPath, dropSide, layoutRects, minSpan } from "./paneTree";

const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;
const DIVIDER_SIZE = 8;
// A press on a header becomes a drag only past this distance, so clicks and double-clicks still work.
const DRAG_THRESHOLD = 4;

type Drag = { id: string; x: number; y: number; active: boolean; over: { target: string; side: Side } | null };

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
  /** SRS-FR-081: the dragged pane goes to `side` of the target. */
  onMove(id: string, targetId: string, side: Side): void;
};

// top-9 matches the h-9 title bar in App.
const MAXIMIZED = "fixed inset-x-0 bottom-0 top-9 z-10 flex flex-col min-h-0 min-w-0 p-2 bg-background [&>*]:flex-1";

export function PaneGrid({ layout, panes, maximizedId, onResize, onMove }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const rects = layoutRects(layout);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const latest = useRef({ rects, onMove });
  latest.current = { rects, onMove };
  const draggable = maximizedId === null && panes.length > 1;

  // SRS-FR-080: only a press on a header, outside its buttons, picks a pane up.
  const pickUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !draggable || !(e.target instanceof Element)) return;
    if (e.target.closest("button") || !e.target.closest("[data-drag-handle]")) return;
    const id = e.target.closest("[data-pane-id]")?.getAttribute("data-pane-id");
    if (id) setDrag({ id, x: e.clientX, y: e.clientY, active: false, over: null });
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const dropAt = (e: globalThis.PointerEvent, id: string): Drag["over"] => {
      const area = grid.current!.getBoundingClientRect();
      if (area.width === 0 || area.height === 0) return null;
      const x = (e.clientX - area.left) / area.width;
      const y = (e.clientY - area.top) / area.height;
      for (const [target, r] of Object.entries(latest.current.rects.panes)) {
        if (target === id || x < r.x || x > r.x + r.width || y < r.y || y > r.y + r.height) continue;
        return { target, side: dropSide((x - r.x) / r.width, (y - r.y) / r.height) };
      }
      return null;
    };
    // On window, so terminals under the pointer cannot swallow the moves.
    const move = (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= DRAG_THRESHOLD) return;
      setDrag({ ...d, active: true, over: dropAt(e, d.id) });
    };
    const drop = () => {
      const d = dragRef.current;
      if (d?.active && d.over) latest.current.onMove(d.id, d.over.target, d.over.side);
      setDrag(null);
    };
    // Capture phase, so the Esc never reaches the terminal, where it would interrupt Claude Code.
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    window.addEventListener("keydown", cancel, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
      window.removeEventListener("keydown", cancel, true);
    };
  }, [dragging]);

  // A layout change under a drag (a pane closed, one maximized) ends it.
  useEffect(() => {
    if (!draggable) setDrag(null);
  }, [draggable]);

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
      <div
        ref={grid}
        data-testid="pane-grid"
        onPointerDown={pickUp}
        className={`relative h-full min-h-0 ${draggable ? "[&_[data-drag-handle]]:cursor-grab" : ""}`}
      >
        {panes.map(({ id, node }) => {
          const r = rects.panes[id];
          if (id === maximizedId) {
            return (
              <div key={id} data-pane-id={id} className={MAXIMIZED}>
                {node}
              </div>
            );
          }
          const covered = maximizedId !== null;
          return (
            <div
              key={id}
              data-pane-id={id}
              inert={covered}
              className={`absolute flex flex-col min-h-0 min-w-0 p-0.5 [&>*]:flex-1 ${covered ? "invisible" : ""} ${drag?.active && drag.id === id ? "opacity-50" : ""}`}
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
        {drag?.active && drag.over && (
          <DropZones target={drag.over.target} box={rects.panes[drag.over.target]} side={drag.over.side} />
        )}
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

const SIDES: Side[] = ["left", "right", "top", "bottom"];

/** Where a band sits in the target pane: a quarter of it, or, lit, the half the dropped pane will take. */
function band(side: Side, depth: string) {
  switch (side) {
    case "left":
      return { left: 0, top: 0, bottom: 0, width: depth };
    case "right":
      return { right: 0, top: 0, bottom: 0, width: depth };
    case "top":
      return { left: 0, right: 0, top: 0, height: depth };
    case "bottom":
      return { left: 0, right: 0, bottom: 0, height: depth };
  }
}

function DropZones({ target, box, side }: { target: string; box: Rect; side: Side }) {
  return (
    <div
      aria-hidden
      data-drop-target={target}
      className="absolute pointer-events-none p-1"
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
    >
      <div className="relative h-full w-full rounded-lg border border-dashed border-primary/40">
        {SIDES.map((s) => (
          <div
            key={s}
            data-drop-side={s}
            data-active={s === side || undefined}
            className={
              s === side
                ? "absolute rounded-lg border border-primary bg-primary/20"
                : "absolute rounded-lg border border-dashed border-primary/40 bg-primary/5"
            }
            style={band(s, s === side ? "50%" : "25%")}
          />
        ))}
      </div>
    </div>
  );
}
