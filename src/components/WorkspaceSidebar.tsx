import { formatWhen, mergeSessions, type OpenSession } from "./sessionList";
import type { SessionListState } from "./useSessionList";
import type { WorkspacesState } from "./useWorkspaces";

type Props = {
  workspaces: WorkspacesState;
  onNewSession(): void;
  sessions: SessionListState;
  openSessions: OpenSession[];
  now: number;
};

export function WorkspaceSidebar({ workspaces, onNewSession, sessions, openSessions, now }: Props) {
  const { items, selected, select, addFolder, removeFolder } = workspaces;
  return (
    <aside aria-label="Workspaces" className="bg-card overflow-auto border-r border-border">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folders</span>
        <button onClick={() => void addFolder()} className="text-xs text-foreground border border-border rounded-md px-2 py-0.5">
          + Add Folder
        </button>
      </div>
      <ul className="px-2 space-y-0.5">
        {(items ?? []).map((w) => (
          <li
            key={w.id}
            aria-current={w.id === selected?.id ? "true" : undefined}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${w.id === selected?.id ? "bg-accent text-accent-foreground font-medium" : "text-foreground"}`}
          >
            <button
              onClick={() => select(w.id)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            >
              <span className={`truncate ${w.missing ? "line-through text-muted-foreground" : ""}`}>{w.name}</span>
              {w.missing && <span className="text-xs text-error-foreground">Missing</span>}
            </button>
            <button
              aria-label={`Remove ${w.name}`}
              onClick={() => void removeFolder(w.id)}
              className="shrink-0 text-xs text-muted-foreground border border-border rounded px-1.5"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="px-3 pt-4 pb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions</span>
        <button
          onClick={onNewSession}
          disabled={selected === null}
          className="text-xs bg-primary text-primary-foreground rounded-md px-2 py-1 disabled:opacity-50"
        >
          New Session
        </button>
      </div>
      <SessionList state={sessions} openSessions={openSessions} now={now} />
    </aside>
  );
}

function SessionList({ state, openSessions, now }: { state: SessionListState; openSessions: OpenSession[]; now: number }) {
  switch (state.kind) {
    case "none":
      return <div className="px-4 py-2 text-xs text-muted-foreground">Select a folder to see its sessions.</div>;
    case "missing":
      return <div className="px-4 py-2 text-sm text-muted-foreground">This folder no longer exists on disk.</div>;
    case "failed":
      return <Notice text="Sessions could not be read" />;
    case "loading":
      return (
        <ul aria-label="Loading sessions" className="px-2 space-y-1.5 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="rounded-md px-2 py-1.5 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-muted animate-pulse" />
            </li>
          ))}
        </ul>
      );
    case "ready": {
      const rows = mergeSessions(state.listing.sessions, openSessions, state.workspaceId);
      const { unreadable } = state.listing;
      return (
        <>
          {unreadable > 0 && (
            <Notice text={`${unreadable} ${unreadable === 1 ? "session" : "sessions"} could not be read`} />
          )}
          {rows.length === 0 ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">No sessions yet</div>
          ) : (
            <ul aria-label="Sessions" className="px-2 space-y-0.5">
              {rows.map((row) => (
                <li key={row.id} className="rounded-md px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm text-foreground">
                    <span className="truncate">{row.title}</span>
                    {row.live ? (
                      <span className="shrink-0 text-[10px] uppercase font-medium text-accent-foreground bg-accent rounded px-1">
                        Live
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(row.lastActivity, now)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }
}

function Notice({ text }: { text: string }) {
  return (
    <div role="status" className="mx-2 mb-1 rounded-md border border-error-border bg-error-bg px-2 py-1.5 text-xs text-error-foreground">
      {text}
    </div>
  );
}
