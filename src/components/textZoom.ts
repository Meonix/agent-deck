/** The Text Size of the whole window: steps, limits and the stored value (SRS-FR-068 to SRS-FR-071). */

export type ZoomAction = "in" | "out" | "reset";
type ZoomKeys = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">;

const MIN = 0.5;
const MAX = 2;
const STEP = 0.1;
export const DEFAULT_TEXT_SIZE = 1;

const ACTIONS: Record<string, ZoomAction> = { "+": "in", "=": "in", "-": "out", "0": "reset" };

/** Cmd on macOS, Ctrl elsewhere; the other modifier stays with the terminal. */
export function zoomAction(e: ZoomKeys, mac: boolean): ZoomAction | null {
  const modifier = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!modifier || e.altKey) return null;
  return ACTIONS[e.key] ?? null;
}

// Sizes live on the 0.1 grid; rounding after each step keeps ten steps from drifting off 2.
const onGrid = (size: number) => Math.round(size * 10) / 10;

export function nextTextSize(current: number, action: ZoomAction): number {
  if (action === "reset") return DEFAULT_TEXT_SIZE;
  const next = onGrid(current + (action === "in" ? STEP : -STEP));
  return Math.min(MAX, Math.max(MIN, next));
}

export function storedTextSize(raw: string | null): number {
  const size = Number(raw);
  if (raw === null || raw === "" || !Number.isFinite(size)) return DEFAULT_TEXT_SIZE;
  if (size < MIN || size > MAX || onGrid(size) !== size) return DEFAULT_TEXT_SIZE;
  return size;
}
