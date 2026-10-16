import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionsClient } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import { ConfirmClose } from "./components/ConfirmClose";
import { StatusLatencyReport } from "./components/StatusLatencyReport";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type PaneEntry, type TerminalAdapterFactory } from "./components/TerminalPane";
import { StatusBoard } from "./components/BoardColumn";
import { ToastProvider } from "./components/Toast";
import { useSessionPanes } from "./components/useSessionPanes";
import { useWorkspaces } from "./components/useWorkspaces";
import type { OpenSession } from "./components/sessionList";
import { useMinuteClock, useSessionList } from "./components/useSessionList";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";

type Deps = {
  workspaces: WorkspacesClient;
  sessions: SessionsClient;
  createTerminal: TerminalAdapterFactory;
};

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

function Workbench({ workspaces: workspacesClient, sessions, createTerminal }: Deps) {
  const workspaces = useWorkspaces(workspacesClient);
  const { refresh } = workspaces;
  const paneArea = useRef<HTMLElement>(null);
  const panes = useSessionPanes(sessions, createTerminal, () => void refresh().catch(() => {}), paneArea);
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
    <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr_280px]">
      <WorkspaceSidebar
        workspaces={workspaces}
        onNewSession={newSession}
        onResume={resume}
        sessions={sessionList}
        openSessions={openSessions}
        now={now}
      />
      <main ref={paneArea} className="min-h-0 min-w-0">
        {panes.entries.length > 0 ? (
          <PaneGrid>
            {panes.entries.map((entry) => (
              <TerminalPane
                key={entry.pane.paneId}
                entry={entry}
                client={sessions}
                focused={entry.pane.paneId === panes.focusedId}
                onFocus={panes.focusPane}
                onClose={requestClose}
              />
            ))}
          </PaneGrid>
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
      <StatusBoard entries={panes.entries} />
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
