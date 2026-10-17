import { useState } from "react";
import { formatWhen, type ListedSession, mergeSessions, type OpenSession } from "./sessionList";
import type { SessionListState } from "./useSessionList";

type RowAction = (workspaceId: string, row: { id: string; title: string }) => void;

type Props = {
  workspaceName: string;
  sessions: SessionListState;
  openSessions: OpenSession[];
  /** A maximized pane is drawn over the panel; keep keyboard focus out of it. */
  covered: boolean;
  now: number;
  onNewSession(): void;
  onClose(): void;
  onResume: RowAction;
  onDelete: RowAction;
};

/** The selected folder's sessions, between the left column and the panes (SRS-FR-007, SRS-FR-054). */
export function SessionHistoryPanel({ workspaceName, sessions, openSessions, covered, now, onNewSession, onClose, onResume, onDelete }: Props) {
  return (
    <div className="min-h-0 p-2 pr-0">
      <section
        aria-label="Session history"
        inert={covered}
        className="h-full overflow-auto rounded-lg border border-border bg-background"
      >
        <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-medium text-foreground">{workspaceName}</h2>
          <span className="flex shrink-0 items-center gap-1.5">
            <button onClick={onNewSession} className="text-xs bg-primary text-primary-foreground rounded-md px-2 py-1">
              New Session
            </button>
            <button
              aria-label="Close session history"
              onClick={onClose}
              className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5"
            >
              ✕
            </button>
          </span>
        </div>
        <SessionList state={sessions} openSessions={openSessions} now={now} onResume={onResume} onDelete={onDelete} />
      </section>
    </div>
  );
}

type ListProps = {
  state: SessionListState;
  openSessions: OpenSession[];
  now: number;
  onResume: RowAction;
  onDelete: RowAction;
};

function SessionList({ state, openSessions, now, onResume, onDelete }: ListProps) {
  switch (state.kind) {
    case "none":
      return null;
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
            <SessionRows
              key={state.workspaceId}
              workspaceId={state.workspaceId}
              rows={rows}
              now={now}
              onResume={onResume}
              onDelete={onDelete}
            />
          )}
        </>
      );
    }
  }
}

type RowsProps = { workspaceId: string; rows: ListedSession[]; now: number; onResume: RowAction; onDelete: RowAction };

function SessionRows({ workspaceId, rows, now, onResume, onDelete }: RowsProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = rows.find((r) => r.id === pickedId) ?? null;
  return (
    <ul aria-label="Session history" className="px-2 space-y-0.5">
      {rows.map((row) => (
        <li key={row.id} className={`rounded-md px-2 py-1.5 ${row === picked ? "bg-muted" : ""}`}>
          <button
            aria-pressed={row === picked}
            onClick={() => setPickedId(row.id)}
            className="flex w-full items-center justify-between gap-2 rounded-sm text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{row.title}</span>
            {row.live ? (
              <span className="shrink-0 text-[10px] uppercase font-medium text-accent-foreground bg-accent rounded px-1">
                Live
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(row.lastActivity, now)}</span>
            )}
          </button>
          {row === picked && (
            <div className="mt-1 flex justify-end gap-1">
              <button
                onClick={() => onResume(workspaceId, { id: row.id, title: row.title })}
                className="text-xs text-foreground border border-border rounded px-1.5"
              >
                Resume
              </button>
              <button
                onClick={() => onDelete(workspaceId, { id: row.id, title: row.title })}
                className="text-xs text-muted-foreground border border-border rounded px-1.5"
              >
                Delete
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div role="status" className="mx-2 mb-1 rounded-md border border-error-border bg-error-bg px-2 py-1.5 text-xs text-error-foreground">
      {text}
    </div>
  );
}
