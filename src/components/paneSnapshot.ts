import { type Layout, paneOrder, removePane } from "./paneTree";
import { UNTITLED } from "./TerminalPane";

const STORAGE_KEY = "adOpenPanes";
const VERSION = 1;

export type RememberedPane = { workspaceId: string; sessionId: string; title: string };
export type Snapshot = { version: typeof VERSION; layout: Layout; panes: Record<string, RememberedPane> };

/** The fields of a pane entry the snapshot needs. */
export type SnapshotEntry = {
  pane: { paneId: string; sessionId: string; started: boolean };
  workspaceId: string;
  title: string;
  ended: boolean;
  prompted: boolean;
};

// A new session has no history file until its first prompt, so it could not be resumed (SRS-FR-084).
function remembered(e: SnapshotEntry) {
  return e.pane.started && !e.ended && (e.prompted || e.title !== UNTITLED);
}

/** The panes worth reopening and the layout pruned to them; null when there are none. */
export function snapshotOf(layout: Layout | null, entries: SnapshotEntry[]): Snapshot | null {
  if (layout === null) return null;
  const kept = new Map(entries.filter(remembered).map((e) => [e.pane.paneId, e]));
  let pruned: Layout | null = layout;
  for (const id of paneOrder(layout)) {
    if (!kept.has(id)) pruned = pruned && removePane(pruned, id);
  }
  if (pruned === null) return null;
  const panes: Record<string, RememberedPane> = {};
  for (const id of paneOrder(pruned)) {
    const e = kept.get(id)!;
    panes[id] = { workspaceId: e.workspaceId, sessionId: e.pane.sessionId, title: e.title };
  }
  return { version: VERSION, layout: pruned, panes };
}

/** Renames reopened panes to their new ids; a null id leaves the pane out and its space to its neighbours. */
export function rebuildLayout(layout: Layout, reopened: Record<string, string | null>): Layout | null {
  if ("pane" in layout) {
    const id = reopened[layout.pane];
    return id ? { pane: id } : null;
  }
  const first = rebuildLayout(layout.first, reopened);
  const second = rebuildLayout(layout.second, reopened);
  if (first === null) return second;
  if (second === null) return first;
  return { ...layout, first, second };
}

export function readSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Snapshot;
    if (value?.version !== VERSION || typeof value.panes !== "object" || value.panes === null) return null;
    const ids = paneOrder(value.layout);
    return ids.length > 0 && ids.every((id) => id in value.panes) ? value : null;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: Snapshot | null) {
  try {
    if (snapshot) localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not kept for the next launch; the panes of this one are unaffected.
  }
}
