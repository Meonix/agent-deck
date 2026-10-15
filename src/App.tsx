import { useRef } from "react";
import type { SessionsClient } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import { PaneGrid } from "./components/PaneGrid";
import { TerminalPane, type TerminalAdapterFactory } from "./components/TerminalPane";
import { ToastProvider } from "./components/Toast";
import { useSessionPanes } from "./components/useSessionPanes";
import { useWorkspaces } from "./components/useWorkspaces";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";

type Deps = {
  workspaces: WorkspacesClient;
  sessions: SessionsClient;
  createTerminal: TerminalAdapterFactory;
};

function App(deps: Deps) {
  return (
    <div className="h-screen relative flex flex-col bg-background text-foreground font-sans">
      <ToastProvider>
        <div className="h-9 flex items-center px-4 border-b border-border bg-card">
          <span className="text-sm font-medium text-foreground">agent-deck</span>
        </div>
        <Workbench {...deps} />
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

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr]">
      <WorkspaceSidebar workspaces={workspaces} onNewSession={newSession} />
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
                onClose={(id) => void panes.closePane(id)}
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
    </div>
  );
}

type CenteredStateProps = { title: string; hint: string; action: string; disabled?: boolean; onAction(): void };

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
