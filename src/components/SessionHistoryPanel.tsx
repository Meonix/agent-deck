import { X } from "lucide-react";
import { useState } from "react";
import { ICON } from "./icon";
import { formatWhen, type ListedSession, mergeSessions, type OpenSession } from "./sessionList";
import type { SessionListState } from "./useSessionList";

type RowAction = (workspaceId: string, row: { id: string; title: string }) => void;
type SelectionProps = {
  /** Session Selection: ids of the ticked rows (SRS-FR-073). */
  selected: string[];
  onSelect(ids: string[]): void;
  onDeleteSelected(workspaceId: string, ids: string[]): void;
  /** A Delete selected is still running (SRS-FR-078). */
  deletingSelection: boolean;
};

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
} & SelectionProps;

/** The selected folder's sessions, between the left column and the panes (SRS-FR-007, SRS-FR-054). */
export function SessionHistoryPanel({ workspaceName, covered, onNewSession, onClose, ...list }: Props) {
  return (
    <div className="min-h-0 border-r border-border">
      <section
        aria-label="Session history"
        inert={covered}
        className="h-full overflow-auto bg-background"
      >
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-border bg-card">
          <h2 className="truncate font-mono text-xs font-medium text-foreground">{workspaceName}</h2>
          <span className="flex shrink-0 items-center gap-1.5">
            <button onClick={onNewSession} className="font-mono text-[11px] bg-primary text-primary-foreground rounded-md px-2 py-1 hover:opacity-90 transition-opacity">
              New Session
            </button>
            <button
              aria-label="Close session history"
              onClick={onClose}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X {...ICON} />
            </button>
          </span>
        </div>
        <SessionList {...list} />
      </section>
    </div>
  );
}

type ListProps = {
  sessions: SessionListState;
  openSessions: OpenSession[];
  now: number;
  onResume: RowAction;
  onDelete: RowAction;
} & SelectionProps;

function SessionList({ sessions: state, openSessions, now, onResume, onDelete, selected, onSelect, onDeleteSelected, deletingSelection }: ListProps) {
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
              <div className="h-3 w-3/4 rounded-md bg-muted animate-pulse" />
              <div className="h-2.5 w-1/3 rounded-md bg-muted animate-pulse" />
            </li>
          ))}
        </ul>
      );
    case "ready": {
      const rows = mergeSessions(state.listing.sessions, openSessions, state.workspaceId);
      const { unreadable } = state.listing;
      // Only listed rows count: an id whose session went away since it was ticked is not deleted again.
      const ticked = rows.filter((r) => selected.includes(r.id)).map((r) => r.id);
      const workspaceId = state.workspaceId;
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
              ticked={ticked}
              onTick={(id, on) => onSelect(on ? [...ticked, id] : ticked.filter((t) => t !== id))}
            />
          )}
          {ticked.length > 0 && (
            // Below the rows and pinned to the bottom: it shows next to old rows ticked far down, and moves no row.
            <div className="sticky bottom-0 px-4 py-2 flex justify-end gap-1 border-t border-border bg-background">
              <button
                onClick={() => onSelect(rows.map((r) => r.id))}
                className="font-mono text-[11px] text-foreground bg-muted border border-border rounded-md px-1.5 hover:border-muted-foreground transition-colors"
              >
                Select all
              </button>
              <button
                disabled={deletingSelection}
                onClick={() => onDeleteSelected(workspaceId, ticked)}
                className="font-mono text-[11px] text-muted-foreground border border-border rounded-md px-1.5 hover:text-foreground hover:border-muted-foreground transition-colors disabled:opacity-50"
              >
                Delete selected ({ticked.length})
              </button>
            </div>
          )}
        </>
      );
    }
  }
}

type RowsProps = {
  workspaceId: string;
  rows: ListedSession[];
  now: number;
  onResume: RowAction;
  onDelete: RowAction;
  ticked: string[];
  onTick(id: string, on: boolean): void;
};

function SessionRows({ workspaceId, rows, now, onResume, onDelete, ticked, onTick }: RowsProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = rows.find((r) => r.id === pickedId) ?? null;
  return (
    <ul aria-label="Session history" className="px-2 space-y-0.5">
      {rows.map((row) => (
        <li key={row.id} className={`rounded-md px-2 py-1.5 transition-colors ${row === picked ? "bg-muted" : "hover:bg-muted/60"}`}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Select ${row.title}`}
              checked={ticked.includes(row.id)}
              onChange={(e) => onTick(row.id, e.target.checked)}
              className="shrink-0 accent-primary"
            />
            <button
              aria-pressed={row === picked}
              onClick={() => setPickedId(row.id)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-sm text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{row.title}</span>
              {row.live ? (
                <span className="shrink-0 font-mono text-[10px] font-medium text-accent-foreground bg-accent rounded-md px-1">
                  Live
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(row.lastActivity, now)}</span>
              )}
            </button>
          </div>
          {row === picked && (
            <div className="mt-1 flex justify-end gap-1">
              <button
                onClick={() => onResume(workspaceId, { id: row.id, title: row.title })}
                className="font-mono text-[11px] text-foreground bg-muted border border-border rounded-md px-1.5 hover:border-muted-foreground transition-colors"
              >
                Resume
              </button>
              <button
                onClick={() => onDelete(workspaceId, { id: row.id, title: row.title })}
                className="font-mono text-[11px] text-muted-foreground border border-border rounded-md px-1.5 hover:text-foreground hover:border-muted-foreground transition-colors"
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
