export type DropTarget = (paths: string[]) => void;

type DragDropEvent = { payload: { type: string; paths?: string[]; position?: { x: number; y: number } } };

const targets = new Map<string, DropTarget>();

export function registerDropTarget(paneId: string, target: DropTarget): () => void {
  targets.set(paneId, target);
  return () => {
    if (targets.get(paneId) === target) targets.delete(paneId);
  };
}

/** `physical` is in device pixels; `hit` takes CSS pixels. True when a pane took the paths. */
export function routeDrop(
  paths: string[],
  physical: { x: number; y: number },
  scale: number,
  hit: (x: number, y: number) => Element | null,
): boolean {
  const id = hit(physical.x / scale, physical.y / scale)?.closest("[data-pane-id]")?.getAttribute("data-pane-id");
  const target = id ? targets.get(id) : undefined;
  if (!target) return false;
  target(paths);
  return true;
}

export function listenForDrops(listen: (cb: (e: DragDropEvent) => void) => Promise<() => void>): () => void {
  let stopped = false;
  let unlisten: (() => void) | null = null;
  listen((e) => {
    const { type, paths, position } = e.payload;
    if (type !== "drop" || !paths || !position) return;
    routeDrop(paths, position, window.devicePixelRatio, (x, y) => document.elementFromPoint(x, y));
  }).then(
    (off) => {
      // The cleanup may have run while the subscription was still being set up.
      if (stopped) off();
      else unlisten = off;
    },
    () => {},
  );
  return () => {
    stopped = true;
    unlisten?.();
    unlisten = null;
  };
}
