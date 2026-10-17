import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionsClient } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import { ConfirmClose } from "./components/ConfirmClose";
import { StatusLatencyReport } from "./components/StatusLatencyReport";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type PaneEntry, type TerminalAdapterFactory } from "./components/TerminalPane";
import { ToastProvider } from "./components/Toast";
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
  const sessionList = useSessionList(sessions, workspaces.selected, workspaces.selections, openHere);
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

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr]">
      <WorkspaceSidebar
        workspaces={workspaces}
        onNewSession={newSession}
        onResume={resume}
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
      {confirmed && stillBusy && (
        <ConfirmClose
          workspaceName={confirmed.workspaceName}
          title={confirmed.title}
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
