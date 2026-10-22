import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionsClient } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import type { ZoomClient } from "./api/zoom";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { StatusLatencyReport } from "./components/StatusLatencyReport";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, UNTITLED, type PaneEntry, type TerminalAdapterFactory } from "./components/TerminalPane";
import { ToastProvider, useToast } from "./components/Toast";
import { SessionHistoryPanel } from "./components/SessionHistoryPanel";
import { activeSessions, folderHighlights, maximizedBadge } from "./components/statusHighlight";
import { useSessionPanes } from "./components/useSessionPanes";
import { useSidebarToggle } from "./components/useSidebarToggle";
import type { StashedSession } from "./components/stash";
import { useStash } from "./components/useStash";
import { useTextZoom } from "./components/useTextZoom";
import { useWorkspaces } from "./components/useWorkspaces";
import { mergeSessions, type OpenSession } from "./components/sessionList";
import { useMinuteClock, useSessionList } from "./components/useSessionList";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { countTerminals, type DiagClient } from "./diagnostics";

type Deps = {
  workspaces: WorkspacesClient;
  sessions: SessionsClient;
  createTerminal: TerminalAdapterFactory;
  diag?: DiagClient;
  zoom?: ZoomClient;
  /** Picks Cmd rather than Ctrl for the Zoom shortcut. */
  mac?: boolean;
};

const REPORT_MS = 60_000;

function App(deps: Deps) {
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);
  const textSize = useTextZoom(deps.zoom, deps.mac ?? false);
  const sidebar = useSidebarToggle(deps.mac ?? false);
  return (
    <div className="h-screen relative flex flex-col bg-background text-foreground font-sans">
      <ToastProvider>
        <div className="h-9 flex items-center justify-between px-4 border-b border-border bg-card">
          <span className="text-sm font-medium text-foreground">agent-deck</span>
          <button
            onClick={() => setReportOpen(true)}
            className="text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5"
          >
            Status Latency
          </button>
        </div>
        <Workbench {...deps} textSize={textSize} sidebar={sidebar} />
        {reportOpen && <StatusLatencyReport client={deps.sessions} onClose={closeReport} />}
      </ToastProvider>
    </div>
  );
}

function Workbench({ workspaces: workspacesClient, sessions, createTerminal: makeTerminal, diag, textSize, sidebar }: Deps & {
  textSize: number;
  sidebar: { shown: boolean; toggle(): void };
}) {
  const terminals = useMemo(() => countTerminals(makeTerminal), [makeTerminal]);
  const createTerminal = terminals.factory;
  const workspaces = useWorkspaces(workspacesClient);
  const { refresh } = workspaces;
  const paneArea = useRef<HTMLElement>(null);
  const panes = useSessionPanes(
    sessions,
    createTerminal,
    () => void refresh().catch(() => {}),
    paneArea,
  );
  const { diagnostics } = panes;
  const { reopenPanes } = panes;
  useEffect(() => {
    if (workspaces.items) void reopenPanes(workspaces.items);
  }, [reopenPanes, workspaces.items]);
  useEffect(() => {
    if (!diag) return;
    const timer = setInterval(() => {
      void diag.report({ terminals: terminals.live(), ...diagnostics() }).catch(() => {});
    }, REPORT_MS);
    return () => clearInterval(timer);
  }, [diag, diagnostics, terminals]);
  const newSession = () => {
    if (workspaces.selected) void panes.newSession(workspaces.selected);
  };

  const resume = (workspaceId: string, row: { id: string; title: string }) => {
    const workspace = workspaces.items?.find((w) => w.id === workspaceId);
    if (workspace) void panes.resume(workspace, row);
  };

  const openSessions: OpenSession[] = panes.entries
    .filter((e) => e.pane.started && !e.ended)
    .map((e) => ({ sessionId: e.pane.sessionId, workspaceId: e.workspaceId, title: e.title, openedAt: e.openedAt }));
  const selectedId = workspaces.selected?.id ?? null;
  const openHere = openSessions
    .filter((o) => o.workspaceId === selectedId)
    .map((o) => o.sessionId)
    .sort()
    .join(",");
  const [reloads, setReloads] = useState(0);
  const sessionList = useSessionList(sessions, workspaces.selected, workspaces.selections, openHere, reloads);
  const now = useMinuteClock();
  const historyShown = workspaces.historyOpen && workspaces.selected !== null;
  const othersBadge = panes.maximizedId === null ? null : maximizedBadge(panes.entries, panes.maximizedId);
  const [selection, setSelection] = useState<string[]>([]);
  // SRS-FR-076: a switch of folder or a close starts the next view of the panel with nothing ticked.
  useEffect(() => setSelection([]), [selectedId, historyShown]);

  // `shell`: what the shell answered when × was clicked, null when it ran nothing.
  const [closing, setClosing] = useState<{ paneId: string; shell: { command: string | null } | null } | null>(null);
  const closingEntry = panes.entries.find((e) => e.pane.paneId === closing?.paneId);
  useEffect(() => {
    if (closing !== null && closingEntry === undefined) setClosing(null);
  }, [closing, closingEntry]);
  const cancelClose = useCallback(() => setClosing(null), []);
  // Only the latest × or Stash may open its dialog: an older shell answer can come back after a newer click.
  const closeRequests = useRef(0);
  /** What the pane's shell runs, null when it runs nothing; undefined once a newer request has started. */
  const busyShell = async (paneId: string) => {
    const request = ++closeRequests.current;
    const entry = panes.entries.find((e) => e.pane.paneId === paneId);
    // "not_found": the shell is already gone. Any other failure warns, the safer side.
    const activity = entry?.shell
      ? await sessions.shellActivity(paneId).catch((e) => (e === "not_found" ? null : { busy: true, command: null }))
      : null;
    if (request !== closeRequests.current) return undefined;
    return activity?.busy ? { command: activity.command } : null;
  };
  const requestClose = async (paneId: string) => {
    const shell = await busyShell(paneId);
    if (shell !== undefined) setClosing({ paneId, shell });
  };
  const closeOnly = (paneId: string) => {
    setClosing(null);
    void panes.closePane(paneId);
  };
  const closeAndTrash = (entry: PaneEntry) => {
    const { paneId, sessionId } = entry.pane;
    // The Delete already running moves the history; this one only has to close the pane.
    if (inFlight.current.has(sessionId)) return closeOnly(paneId);
    setClosing(null);
    void confirmDelete({ workspaceId: entry.workspaceId, id: sessionId, title: entry.title, paneId, live: !entry.ended });
  };

  const stash = useStash();
  const [stashing, setStashing] = useState<{ paneId: string; shell: { command: string | null } | null } | null>(null);
  const stashingEntry = panes.entries.find((e) => e.pane.paneId === stashing?.paneId);
  useEffect(() => {
    if (stashing !== null && stashingEntry === undefined) setStashing(null);
  }, [stashing, stashingEntry]);
  const cancelStash = useCallback(() => setStashing(null), []);
  // SRS-FR-104: the row is added only once the pane is closed; a failed close keeps the pane and says why.
  const stashPane = async (entry: PaneEntry) => {
    setStashing(null);
    const { paneId, sessionId } = entry.pane;
    if (!(await panes.closePane(paneId))) return;
    stash.add({ sessionId, workspaceId: entry.workspaceId, workspaceName: entry.workspaceName, title: entry.title, stashedAt: Date.now() });
  };
  const requestStash = async (paneId: string) => {
    const shell = await busyShell(paneId);
    const entry = panes.entries.find((e) => e.pane.paneId === paneId);
    if (shell === undefined || !entry) return;
    if (shell || (!entry.ended && isBusy(entry))) setStashing({ paneId, shell });
    else void stashPane(entry);
  };

  const showToast = useToast();
  // SRS-FR-108: a Missing folder is refused inside resume, so its row stays like any other failed open.
  const reopenStashed = (row: StashedSession) => {
    const workspace = workspaces.items?.find((w) => w.id === row.workspaceId);
    if (workspace) void panes.resume(workspace, { id: row.sessionId, title: row.title });
    else showToast("Folder not found");
  };
  // SRS-FR-109: whatever opened it, a session running in a pane is no longer put aside.
  const { remove: unstash } = stash;
  const runningIds = openSessions.map((o) => o.sessionId).join(",");
  useEffect(() => {
    if (runningIds) runningIds.split(",").forEach(unstash);
  }, [runningIds, unstash]);
  // SRS-FR-112: once per launch, rows whose history was trashed outside the app go; a folder that cannot answer keeps its rows.
  const pruned = useRef(false);
  const { items: stashed, prune } = stash;
  useEffect(() => {
    if (pruned.current || !workspaces.items) return;
    pruned.current = true;
    const asked = new Set(stashed.map((row) => row.workspaceId));
    for (const w of workspaces.items) {
      if (!asked.has(w.id) || w.missing) continue;
      sessions.list(w.id).then(
        (listing) => prune(w.id, listing.sessions.map((row) => row.id)),
        () => {},
      );
    }
  }, [workspaces.items, stashed, sessions, prune]);

  const [deleting, setDeleting] = useState<Deleting | null>(null);
  // A second Delete while the first still waits for its session to end would move files Claude Code may still write.
  const inFlight = useRef(new Set<string>());
  const cancelDelete = useCallback(() => setDeleting(null), []);
  const target = (workspaceId: string, row: { id: string; title: string }): Deleting => {
    const pane = panes.entries.find((e) => e.pane.sessionId === row.id && e.pane.started);
    return { workspaceId, ...row, paneId: pane?.pane.paneId ?? null, live: pane !== undefined && !pane.ended };
  };
  const requestDelete = (workspaceId: string, row: { id: string; title: string }) => {
    if (deletingSelection || inFlight.current.has(row.id)) return;
    setDeleting(target(workspaceId, row));
  };
  /** True when nothing of the session is left on disk. */
  const deleteOne = async ({ workspaceId, id, paneId, live }: Deleting): Promise<boolean> => {
    if (inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    let error: unknown = null;
    try {
      await sessions.deleteSession(workspaceId, id, live && paneId ? paneId : undefined);
    } catch (e) {
      error = e;
    } finally {
      inFlight.current.delete(id);
    }
    // "not_found": nothing of it is on disk, so there is nothing left to keep in the list.
    const gone = error === null || error === "not_found";
    if (gone) unstash(id);
    // The backend ended a live pane's session before moving anything, so the pane goes unless it ran another session.
    if (paneId && error !== "wrong_pane") await panes.closePane(paneId);
    return gone;
  };
  const confirmDelete = async (deleting: Deleting) => {
    setDeleting(null);
    if (await deleteOne(deleting)) setReloads((n) => n + 1);
    else showToast("Session could not be deleted");
  };

  const [deletingMany, setDeletingMany] = useState<Deleting[] | null>(null);
  const [deletingSelection, setDeletingSelection] = useState(false);
  const cancelDeleteMany = useCallback(() => setDeletingMany(null), []);
  const requestDeleteMany = (workspaceId: string, ids: string[]) => {
    // A delete already running would make its session count as not deleted.
    if (deletingSelection || inFlight.current.size > 0) return;
    const rows = sessionList.kind === "ready" ? mergeSessions(sessionList.listing.sessions, openSessions, workspaceId) : [];
    setDeletingMany(rows.filter((r) => ids.includes(r.id)).map((r) => target(workspaceId, r)));
  };
  // One at a time, so two deletes never close panes or move files at the same moment (SRS-FR-078).
  const confirmDeleteMany = async (targets: Deleting[]) => {
    setDeletingMany(null);
    setDeletingSelection(true);
    const kept: string[] = [];
    for (const t of targets) if (!(await deleteOne(t))) kept.push(t.id);
    setDeletingSelection(false);
    setReloads((n) => n + 1);
    setSelection(kept);
    if (kept.length > 0) showToast(`${targets.length - kept.length} of ${targets.length} sessions deleted`);
  };

  return (
    <div className={`flex-1 min-h-0 relative grid ${gridColumns(sidebar.shown, historyShown)}`}>
      <WorkspaceSidebar
        hidden={!sidebar.shown}
        workspaces={workspaces}
        folderHighlights={folderHighlights(panes.entries)}
        active={activeSessions(panes.entries)}
        focusedPaneId={panes.focusedId}
        onJump={panes.jumpTo}
        stashed={stash.items}
        onReopen={reopenStashed}
        onUnstash={stash.remove}
        covered={panes.maximizedId !== null}
      />
      {/* After the Sidebar, so Tab reaches its rows first; absolute, so it takes no grid column. */}
      <SidebarToggle shown={sidebar.shown} covered={panes.maximizedId !== null} onToggle={sidebar.toggle} />
      {historyShown && workspaces.selected && (
        <SessionHistoryPanel
          workspaceName={workspaces.selected.name}
          sessions={sessionList}
          openSessions={openSessions}
          covered={panes.maximizedId !== null}
          now={now}
          onNewSession={newSession}
          onClose={workspaces.closeHistory}
          onResume={resume}
          onDelete={requestDelete}
          selected={selection}
          onSelect={setSelection}
          onDeleteSelected={requestDeleteMany}
          deletingSelection={deletingSelection}
        />
      )}
      <main ref={paneArea} className="min-h-0 min-w-0">
        {panes.layout ? (
          <PaneGrid
            layout={panes.layout}
            maximizedId={panes.maximizedId}
            onResize={panes.resizeSplit}
            onMove={panes.movePane}
            panes={panes.entries.map((entry) => ({
              id: entry.pane.paneId,
              node: (
                <TerminalPane
                  entry={entry}
                  client={sessions}
                  focused={entry.pane.paneId === panes.focusedId}
                  maximized={entry.pane.paneId === panes.maximizedId}
                  textSize={textSize}
                  othersBadge={entry.pane.paneId === panes.maximizedId ? othersBadge : null}
                  onBadge={panes.restore}
                  onFocus={panes.focusPane}
                  onMaximize={panes.maximize}
                  onRestore={panes.restore}
                  canStash={hasHistory(entry)}
                  onStash={(paneId) => void requestStash(paneId)}
                  onClose={(paneId) => void requestClose(paneId)}
                  onToggleShell={(paneId) => void panes.toggleShell(paneId)}
                  onResizeShell={panes.resizeShell}
                  onDismissShellFailure={panes.dismissShellFailure}
                  onSetGoal={panes.setGoal}
                />
              ),
            }))}
          />
        ) : workspaces.items === null ? null : workspaces.items.length === 0 ? (
          <CenteredState
            title="No folders yet"
            hint="Add a folder you work in with Claude Code."
            action="+ Add Folder"
            onAction={() => void workspaces.addFolder()}
          />
        ) : (
          <CenteredState
            title="No open sessions"
            hint={
              workspaces.selected === null
                ? "Select a folder to see its sessions."
                : "Resume a session from its history, or start a new one."
            }
            action="New Session"
            disabled={workspaces.selected === null}
            onAction={newSession}
          />
        )}
      </main>
      {deleting && (
        <ConfirmDialog
          title={deleting.live ? `Close “${deleting.title}” and move it to Trash?` : `Move “${deleting.title}” to Trash?`}
          detail={deleting.live ? "The session will be ended and its pane closed." : "You can restore it from the Trash."}
          action={deleting.live ? "Close and move" : "Move to Trash"}
          onCancel={cancelDelete}
          onConfirm={() => void confirmDelete(deleting)}
        />
      )}
      {deletingMany && (
        <ConfirmDialog
          {...deleteManyText(deletingMany)}
          onCancel={cancelDeleteMany}
          onConfirm={() => void confirmDeleteMany(deletingMany)}
        />
      )}
      {stashing && stashingEntry && (
        <ConfirmDialog
          title={`Stash “${stashingEntry.title}”?`}
          detail={closeWarnings(!stashingEntry.ended && isBusy(stashingEntry), stashing.shell)}
          action="Stash"
          onConfirm={() => void stashPane(stashingEntry)}
          onCancel={cancelStash}
        />
      )}
      {closing && closingEntry && (
        <ConfirmDialog
          title={`Close “${closingEntry.title}”?`}
          detail={closeWarnings(!closingEntry.ended && isBusy(closingEntry), closing.shell)}
          {...(hasHistory(closingEntry)
            ? {
                action: "Close and move to Trash",
                extra: { label: "Close", onChoose: () => closeOnly(closingEntry.pane.paneId) },
                onConfirm: () => closeAndTrash(closingEntry),
              }
            : { action: "Close", onConfirm: () => closeOnly(closingEntry.pane.paneId) })}
          onCancel={cancelClose}
        />
      )}
    </div>
  );
}

/** `paneId`: the pane of this session, live or ended; `live`: its session still runs. */
type Deleting = { workspaceId: string; id: string; title: string; paneId: string | null; live: boolean };

// The SRS fixes the plural wording, also for one session (SRS-FR-077).
function deleteManyText(targets: Deleting[]) {
  const open = targets.filter((d) => d.live).length;
  const n = targets.length;
  return open > 0
    ? {
        title: `Close ${open} open sessions and move ${n} sessions to Trash?`,
        detail: "Their sessions will be ended and their panes closed.",
        action: "Close and move",
      }
    : { title: `Move ${n} sessions to Trash?`, detail: "You can restore them from the Trash.", action: "Move to Trash" };
}

type CenteredStateProps = { title: string; hint: string; action: string; disabled?: boolean; onAction(): void };

/** RULE-01: "(untitled)" means no prompt yet, so nothing of the session is on disk to trash. */
function hasHistory({ pane, title }: PaneEntry): boolean {
  return pane.started && title !== UNTITLED;
}

function closeWarnings(sessionBusy: boolean, shell: { command: string | null } | null) {
  if (!sessionBusy && !shell) return null;
  return (
    <>
      {sessionBusy && <p>Session is still running.</p>}
      {shell && <p>A command is still running in the shell.</p>}
      {shell && (
        <p>
          {shell.command ? (
            <>
              <span className="font-mono">{shell.command}</span> will be stopped.
            </>
          ) : (
            "The shell command will be stopped."
          )}
        </p>
      )}
    </>
  );
}

function isBusy({ status }: PaneEntry): boolean {
  return status.tracked && (status.state === "Running" || status.state === "Needs Approval");
}

function CenteredState({ title, hint, action, disabled = false, onAction }: CenteredStateProps) {
  return (
    <div className="h-full flex items-center justify-center p-2">
      <div className="text-center space-y-2 max-w-sm">
        <div className="text-base font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{hint}</div>
        <button
          onClick={onAction}
          disabled={disabled}
          className="mt-2 text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {action}
        </button>
      </div>
    </div>
  );
}

export default App;

function gridColumns(sidebarShown: boolean, historyShown: boolean): string {
  if (sidebarShown) return historyShown ? "grid-cols-[260px_280px_1fr]" : "grid-cols-[260px_1fr]";
  return historyShown ? "grid-cols-[280px_1fr]" : "grid-cols-[1fr]";
}

// Below the maximized pane's z-10, which covers it (SRS-FR-088).
function SidebarToggle({ shown, covered, onToggle }: { shown: boolean; covered: boolean; onToggle(): void }) {
  return (
    <button
      onClick={onToggle}
      inert={covered}
      aria-label={shown ? "Hide sidebar" : "Show sidebar"}
      aria-expanded={shown}
      className={`absolute top-1/2 -translate-y-1/2 z-[5] h-10 w-4 flex items-center justify-center rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground ${shown ? "left-[260px] -translate-x-1/2" : "left-0 rounded-l-none border-l-0"}`}
    >
      {shown ? "‹" : "›"}
    </button>
  );
}
