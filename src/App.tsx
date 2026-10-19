import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionsClient } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import type { ZoomClient } from "./api/zoom";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { StatusLatencyReport } from "./components/StatusLatencyReport";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type PaneEntry, type TerminalAdapterFactory } from "./components/TerminalPane";
import { ToastProvider, useToast } from "./components/Toast";
import { SessionHistoryPanel } from "./components/SessionHistoryPanel";
import { activeSessions, folderHighlights, maximizedBadge } from "./components/statusHighlight";
import { useSessionPanes } from "./components/useSessionPanes";
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
        <Workbench {...deps} textSize={textSize} />
        {reportOpen && <StatusLatencyReport client={deps.sessions} onClose={closeReport} />}
      </ToastProvider>
    </div>
  );
}

function Workbench({ workspaces: workspacesClient, sessions, createTerminal: makeTerminal, diag, textSize }: Deps & { textSize: number }) {
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

  // `shellBusy`: what the shell answered when Close was clicked.
  const [confirming, setConfirming] = useState<{ paneId: string; shellBusy: boolean } | null>(null);
  const confirmed = panes.entries.find((e) => e.pane.paneId === confirming?.paneId);
  const stillBusy = confirmed !== undefined && !confirmed.ended && isBusy(confirmed);
  useEffect(() => {
    if (confirming !== null && !stillBusy) setConfirming(null);
  }, [confirming, stillBusy]);
  const cancelConfirm = useCallback(() => setConfirming(null), []);
  // Kept apart from `confirming`, which is dropped as soon as the session stops being busy.
  const [confirmingShell, setConfirmingShell] = useState<{ paneId: string; command: string | null } | null>(null);
  const cancelShellConfirm = useCallback(() => setConfirmingShell(null), []);
  const requestClose = async (paneId: string) => {
    const entry = panes.entries.find((e) => e.pane.paneId === paneId);
    // "not_found": the shell is already gone. Any other failure asks, the safer side.
    const activity = entry?.shell
      ? await sessions.shellActivity(paneId).catch((e) => (e === "not_found" ? null : { busy: true, command: null }))
      : null;
    if (entry && !entry.ended && isBusy(entry)) {
      setConfirming({ paneId, shellBusy: activity?.busy ?? false });
      return;
    }
    if (activity?.busy) {
      setConfirmingShell({ paneId, command: activity.command });
      return;
    }
    void panes.closePane(paneId);
  };

  const showToast = useToast();
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
    <div className={`flex-1 min-h-0 grid ${historyShown ? "grid-cols-[260px_280px_1fr]" : "grid-cols-[260px_1fr]"}`}>
      <WorkspaceSidebar
        workspaces={workspaces}
        folderHighlights={folderHighlights(panes.entries)}
        active={activeSessions(panes.entries)}
        onJump={panes.jumpTo}
        covered={panes.maximizedId !== null}
      />
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
                  onClose={(paneId) => void requestClose(paneId)}
                  onToggleShell={(paneId) => void panes.toggleShell(paneId)}
                  onResizeShell={panes.resizeShell}
                  onDismissShellFailure={panes.dismissShellFailure}
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
      {confirming && confirmed && stillBusy && (
        <ConfirmDialog
          title="Session is still running. Close anyway?"
          detail={
            confirming.shellBusy
              ? `${confirmed.workspaceName} · ${confirmed.title} will be ended and the shell command will be stopped.`
              : `${confirmed.workspaceName} · ${confirmed.title} will be ended.`
          }
          action="Close"
          onCancel={cancelConfirm}
          onConfirm={() => {
            setConfirming(null);
            void panes.closePane(confirmed.pane.paneId);
          }}
        />
      )}
      {confirmingShell && (
        <ConfirmDialog
          title="A command is still running in the shell. Close anyway?"
          detail={
            confirmingShell.command ? (
              <>
                <span className="font-mono">{confirmingShell.command}</span> will be stopped.
              </>
            ) : (
              "The shell command will be stopped."
            )
          }
          action="Close"
          onCancel={cancelShellConfirm}
          onConfirm={() => {
            setConfirmingShell(null);
            void panes.closePane(confirmingShell.paneId);
          }}
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
