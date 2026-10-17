import type { SessionState } from "../api/sessions";
import type { PaneEntry } from "./TerminalPane";

export type HighlightState = "Error" | "Needs Approval" | "Running";
export type SessionHighlight = { paneId: string; state: HighlightState; since: number; reason: string | null };
export type FolderHighlight = { state: HighlightState; count: number };

// Most urgent first (SRS-FR-040).
const URGENCY: HighlightState[] = ["Error", "Needs Approval", "Running"];

function highlighted(state: SessionState): state is HighlightState {
  return (URGENCY as SessionState[]).includes(state);
}

// A session resumed after its pane ended has two panes; the live one speaks for it.
function currentPanes(entries: PaneEntry[]): PaneEntry[] {
  const bySession = new Map<string, PaneEntry>();
  for (const entry of entries) {
    const seen = bySession.get(entry.pane.sessionId);
    if (!seen || seen.ended || !entry.ended) bySession.set(entry.pane.sessionId, entry);
  }
  return [...bySession.values()];
}

/** Status Highlight of each session open in a tracked pane, keyed by session id (SRS-FR-032). */
export function sessionHighlights(entries: PaneEntry[]): Map<string, SessionHighlight> {
  const highlights = new Map<string, SessionHighlight>();
  for (const { pane, status } of currentPanes(entries)) {
    if (!status.tracked || !highlighted(status.state)) continue;
    highlights.set(pane.sessionId, { paneId: pane.paneId, state: status.state, since: status.since, reason: status.reason });
  }
  return highlights;
}

/** Most urgent state of each folder and how many of its sessions are in it (SRS-FR-040). */
export function folderHighlights(entries: PaneEntry[]): Map<string, FolderHighlight> {
  const folders = new Map<string, FolderHighlight>();
  for (const { workspaceId, status } of currentPanes(entries)) {
    if (!status.tracked || !highlighted(status.state)) continue;
    const current = folders.get(workspaceId);
    if (!current || URGENCY.indexOf(status.state) < URGENCY.indexOf(current.state)) {
      folders.set(workspaceId, { state: status.state, count: 1 });
    } else if (current.state === status.state) {
      current.count += 1;
    }
  }
  return folders;
}

export type MaximizedBadge = { count: number; state: "Error" | "Needs Approval"; paneId: string };

/** The other sessions that need the user while a pane is maximized, and which one to jump to (SRS-FR-044, SRS-FR-045). */
export function maximizedBadge(entries: PaneEntry[], maximizedPaneId: string): MaximizedBadge | null {
  const waiting: { paneId: string; state: MaximizedBadge["state"]; since: number }[] = [];
  for (const { pane, status } of currentPanes(entries)) {
    if (pane.paneId === maximizedPaneId || !status.tracked) continue;
    if (status.state === "Error" || status.state === "Needs Approval") {
      waiting.push({ paneId: pane.paneId, state: status.state, since: status.since });
    }
  }
  if (waiting.length === 0) return null;
  waiting.sort((a, b) => URGENCY.indexOf(a.state) - URGENCY.indexOf(b.state) || a.since - b.since);
  return { count: waiting.length, state: waiting[0].state, paneId: waiting[0].paneId };
}
