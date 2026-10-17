import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionsClient } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { StatusLatencyReport } from "./components/StatusLatencyReport";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type PaneEntry, type TerminalAdapterFactory } from "./components/TerminalPane";
import { ToastProvider, useToast } from "./components/Toast";
import { folderHighlights, maximizedBadge, sessionHighlights } from "./components/statusHighlight";
import { useSessionPanes } from "./components/useSessionPanes";
import { useWorkspaces } from "./components/useWorkspaces";
import type { OpenSession } from "./components/sessionList";
import { useMinuteClock, useSessionList } from "./components/useSessionList";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { countTerminals, type DiagClient } from "./diagnostics";

type Deps = {
  workspaces: WorkspacesClient;
  sessions: SessionsClient;
  createTerminal: TerminalAdapterFactory;
  diag?: DiagClient;
};

const REPORT_MS = 60_000;

function App(deps: Deps) {
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);
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
        <Workbench {...deps} />
        {reportOpen && <StatusLatencyReport client={deps.sessions} onClose={closeReport} />}
      </ToastProvider>
    </div>
  );
}

function Workbench({ workspaces: workspacesClient, sessions, createTerminal: makeTerminal, diag }: Deps) {
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
    workspaces.items,
  );
  const { diagnostics } = panes;
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
  const highlights = { sessions: sessionHighlights(panes.entries), folders: folderHighlights(panes.entries) };
  const othersBadge = panes.maximizedId === null ? null : maximizedBadge(panes.entries, panes.maximizedId);

  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmed = panes.entries.find((e) => e.pane.paneId === confirming);
  const stillBusy = confirmed !== undefined && !confirmed.ended && isBusy(confirmed);
  useEffect(() => {
    if (confirming !== null && !stillBusy) setConfirming(null);
  }, [confirming, stillBusy]);
  const cancelConfirm = useCallback(() => setConfirming(null), []);
  const requestClose = (paneId: string) => {
    const entry = panes.entries.find((e) => e.pane.paneId === paneId);
    if (entry && !entry.ended && isBusy(entry)) setConfirming(paneId);
    else void panes.closePane(paneId);
  };

  const showToast = useToast();
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  // A second Delete while the first still waits for its session to end would move files Claude Code may still write.
  const inFlight = useRef(new Set<string>());
  const cancelDelete = useCallback(() => setDeleting(null), []);
  const requestDelete = (workspaceId: string, row: { id: string; title: string }) => {
    if (inFlight.current.has(row.id)) return;
    const pane = panes.entries.find((e) => e.pane.sessionId === row.id && e.pane.started);
    setDeleting({ workspaceId, ...row, paneId: pane?.pane.paneId ?? null, live: pane !== undefined && !pane.ended });
  };
  const confirmDelete = async ({ workspaceId, id, paneId, live }: Deleting) => {
    setDeleting(null);
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
    if (gone) setReloads((n) => n + 1);
    else showToast("Session could not be deleted");
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr]">
      <WorkspaceSidebar
        workspaces={workspaces}
        onNewSession={newSession}
        onResume={resume}
        onDelete={requestDelete}
        onJump={panes.jumpTo}
        sessions={sessionList}
        openSessions={openSessions}
        highlights={highlights}
        covered={panes.maximizedId !== null}
        now={now}
      />
      <main ref={paneArea} className="min-h-0 min-w-0">
        {panes.layout ? (
          <PaneGrid
            layout={panes.layout}
            maximizedId={panes.maximizedId}
            onResize={panes.resizeSplit}
            panes={panes.entries.map((entry) => ({
              id: entry.pane.paneId,
              node: (
                <TerminalPane
                  entry={entry}
                  client={sessions}
                  focused={entry.pane.paneId === panes.focusedId}
                  maximized={entry.pane.paneId === panes.maximizedId}
                  othersBadge={entry.pane.paneId === panes.maximizedId ? othersBadge : null}
                  onBadge={panes.restore}
                  onFocus={panes.focusPane}
                  onMaximize={panes.maximize}
                  onRestore={panes.restore}
                  onSplit={(paneId, dir) => void panes.splitFrom(paneId, dir)}
                  onClose={requestClose}
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
            hint="Resume a session from the list, or start a new one."
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
      {confirmed && stillBusy && (
        <ConfirmDialog
          title="Session is still running. Close anyway?"
          detail={`${confirmed.workspaceName} · ${confirmed.title} will be ended.`}
          action="Close"
          onCancel={cancelConfirm}
          onConfirm={() => {
            setConfirming(null);
            void panes.closePane(confirmed.pane.paneId);
          }}
        />
      )}
    </div>
  );
}

/** `paneId`: the pane of this session, live or ended; `live`: its session still runs. */
type Deleting = { workspaceId: string; id: string; title: string; paneId: string | null; live: boolean };

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
