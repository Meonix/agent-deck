import type { SessionState } from "../api/sessions";
import type { PaneEntry } from "./TerminalPane";

export type HighlightState = "Error" | "Needs Approval" | "Running";
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

export type ActiveSession = {
  paneId: string;
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  state: SessionState;
  since: number;
  reason: string | null;
  highlighted: boolean;
};

const ACTIVE_ORDER: SessionState[] = [...URGENCY, "Idle", "Ended"];

/** Every session open in a pane across folders, most urgent first (SRS-FR-051, SRS-FR-052). */
export function activeSessions(entries: PaneEntry[]): ActiveSession[] {
  // A pane that never started has no session, so it must not hide that session's earlier pane.
  const rows = currentPanes(entries.filter((entry) => entry.pane.started))
    .map(({ pane, workspaceId, workspaceName, title, openedAt, ended, status }): ActiveSession => {
      // An untracked pane's state is unknown, so it waits with the Idle rows (SRS-FR-036).
      const state: SessionState =
        status.tracked && status.state === "Error" ? "Error" : ended ? "Ended" : status.tracked ? status.state : "Idle";
      return {
        paneId: pane.paneId,
        sessionId: pane.sessionId,
        workspaceId,
        workspaceName,
        title,
        state,
        since: status.tracked ? status.since : openedAt,
        reason: status.tracked ? status.reason : null,
        highlighted: highlighted(state),
      };
    });
  return rows.sort((a, b) => ACTIVE_ORDER.indexOf(a.state) - ACTIVE_ORDER.indexOf(b.state) || a.since - b.since);
}
