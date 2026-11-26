import type { PaneStatus, SessionState } from "../api/sessions";
import type { Workspace } from "../api/workspaces";
import type { StashedSession } from "./stash";
import type { PaneEntry } from "./TerminalPane";

/** A session in one of these states needs the user (SRS-FR-032). */
export type WaitingState = "Error" | "Needs Approval";

export function needsUser(state: SessionState): state is WaitingState {
  return state === "Error" || state === "Needs Approval";
}

// Most urgent first (SRS-FR-052).
const URGENCY: SessionState[] = ["Error", "Needs Approval", "Running"];

// A session resumed after its pane ended has two panes; the live one speaks for it.
function currentPanes(entries: PaneEntry[]): PaneEntry[] {
  const bySession = new Map<string, PaneEntry>();
  for (const entry of entries) {
    const seen = bySession.get(entry.pane.sessionId);
    if (!seen || seen.ended || !entry.ended) bySession.set(entry.pane.sessionId, entry);
  }
  return [...bySession.values()];
}

type Waiting = { paneId: string; title: string; state: WaitingState; since: number };

// The SRS-FR-045 ordering: Error first, then the longest waiting.
function waitingQueue(panes: PaneEntry[], excludePaneId?: string): Waiting[] {
  const waiting: Waiting[] = [];
  for (const { pane, title, status } of panes) {
    if (pane.paneId === excludePaneId || !status.tracked) continue;
    if (needsUser(status.state)) {
      waiting.push({ paneId: pane.paneId, title, state: status.state, since: status.since });
    }
  }
  return waiting.sort((a, b) => URGENCY.indexOf(a.state) - URGENCY.indexOf(b.state) || a.since - b.since);
}

export type MaximizedBadge = { count: number; state: WaitingState; paneId: string };

/** The other sessions that need the user while a pane is maximized, and which one to jump to (SRS-FR-044, SRS-FR-045). */
export function maximizedBadge(entries: PaneEntry[], maximizedPaneId: string): MaximizedBadge | null {
  const waiting = waitingQueue(currentPanes(entries), maximizedPaneId);
  if (waiting.length === 0) return null;
  return { count: waiting.length, state: waiting[0].state, paneId: waiting[0].paneId };
}

const ACTIVE_ORDER: SessionState[] = [...URGENCY, "Idle", "Ended"];

/** A session open in a pane, as a row under its workspace in the Folder Tree. */
export type SessionRow = {
  paneId: string;
  sessionId: string;
  workspaceId: string;
  title: string;
  state: SessionState;
  since: number;
  reason: string | null;
  /** Needs Approval or Error: the row is tinted and shows its detail line (SRS-FR-032, SRS-FR-033). */
  highlighted: boolean;
};

export type CountTone = WaitingState | "grey";
export type WorkspaceNode = { workspace: Workspace; rows: SessionRow[]; count: { n: number; tone: CountTone } };
export type FolderTree = { open: WorkspaceNode[]; other: Workspace[]; stash: StashedSession[] };

/** The state a pane is taken to be in: an untracked pane's state is unknown, so it counts as Idle (SRS-FR-036). */
export function knownState(status: PaneStatus): SessionState {
  return status.tracked ? status.state : "Idle";
}

function sessionRow({ pane, workspaceId, title, openedAt, ended, status }: PaneEntry): SessionRow {
  // After an abnormal exit the row keeps its Error.
  const known = knownState(status);
  const state: SessionState = known === "Error" ? "Error" : ended ? "Ended" : known;
  return {
    paneId: pane.paneId,
    sessionId: pane.sessionId,
    workspaceId,
    title,
    state,
    since: status.tracked ? status.since : openedAt,
    reason: status.tracked ? status.reason : null,
    highlighted: needsUser(state),
  };
}

// SRS-FR-040: what needs the user, in the colour of the most urgent; else every open session, in grey.
function count(rows: SessionRow[]): WorkspaceNode["count"] {
  const waiting = rows.filter((r) => r.highlighted);
  if (waiting.length === 0) return { n: rows.length, tone: "grey" };
  return { n: waiting.length, tone: waiting.some((r) => r.state === "Error") ? "Error" : "Needs Approval" };
}

/** The Folder Tree: workspaces with open sessions, the Other Folders and the stash (SRS-FR-051, SRS-FR-052, SRS-FR-141). */
export function folderTree(entries: PaneEntry[], workspaces: Workspace[], stashed: StashedSession[]): FolderTree {
  // A pane that never started has no session, so it must not hide that session's earlier pane.
  const rows = currentPanes(entries.filter((entry) => entry.pane.started))
    .map(sessionRow)
    .sort((a, b) => ACTIVE_ORDER.indexOf(a.state) - ACTIVE_ORDER.indexOf(b.state) || a.since - b.since);
  const nodes: WorkspaceNode[] = [];
  const other: Workspace[] = [];
  for (const workspace of workspaces) {
    const mine = rows.filter((r) => r.workspaceId === workspace.id);
    if (mine.length === 0) other.push(workspace);
    else nodes.push({ workspace, rows: mine, count: count(mine) });
  }
  // A stable partition: the rest of the tree stays still when one folder starts waiting.
  const urgent = (n: WorkspaceNode) => n.count.tone !== "grey";
  return { open: [...nodes.filter(urgent), ...nodes.filter((n) => !urgent(n))], other, stash: stashed };
}
