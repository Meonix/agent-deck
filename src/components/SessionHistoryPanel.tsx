import { X } from "lucide-react";
import { useState } from "react";
import { labels } from "../labels";
import { ICON } from "./icon";
import { RoundMark } from "./statusTone";
import { formatWhen, type ListedSession, mergeSessions, type OpenSession } from "./sessionList";
import type { SessionListState } from "./useSessionList";

const PILL = "inline-flex h-7 shrink-0 items-center px-3 text-[12px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50";

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
    <div className="min-h-0 overflow-hidden border-r border-border bg-card">
      <section
        aria-label={labels.sessionHistory}
        inert={covered}
        className="h-full overflow-auto"
      >
        <div className="flex items-center justify-between gap-2 pb-2 pl-4 pr-2 pt-3">
          <h2 className="truncate text-[14px] font-semibold text-foreground">{workspaceName}</h2>
          <span className="flex shrink-0 items-center gap-1">
            <button onClick={onNewSession} className={`${PILL} send`}>
              {labels.newSession}
            </button>
            <button
              aria-label={labels.closeHistory}
              onClick={onClose}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
      return <div className="px-4 py-2 text-[13px] text-muted-foreground">{labels.folderGone}</div>;
    case "failed":
      return <Notice text={labels.sessionsFailed} />;
    case "loading":
      return (
        <ul aria-label={labels.loadingSessions} className="px-2 space-y-1.5 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="px-3 py-2 space-y-1.5">
              <div className="skel h-3 w-3/4 rounded animate-pulse" />
              <div className="skel h-2.5 w-1/3 rounded animate-pulse" />
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
            <Notice text={labels.unreadable(unreadable)} />
          )}
          {rows.length === 0 ? (
            <div className="px-4 py-2 text-[13px] text-muted-foreground">{labels.noSessions}</div>
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
            <div className="sticky bottom-0 px-3 py-2 flex justify-end gap-2 border-t border-border bg-card">
              <button
                onClick={() => onSelect(rows.map((r) => r.id))}
                className={`${PILL} outline-btn text-foreground`}
              >
                {labels.selectAll}
              </button>
              <button
                disabled={deletingSelection}
                onClick={() => onDeleteSelected(workspaceId, ticked)}
                className={`${PILL} btn-danger`}
              >
                {labels.deleteSelected(ticked.length)}
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
    <ul aria-label={labels.sessionHistory} className="pb-2">
      {rows.map((row) => (
        <li key={row.id} className={`px-4 py-2 transition-colors ${row === picked ? "bg-section-active" : "hover:bg-muted"}`}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label={labels.select(labels.title(row.title))}
              checked={ticked.includes(row.id)}
              onChange={(e) => onTick(row.id, e.target.checked)}
              className="shrink-0 accent-primary"
            />
            <button
              aria-pressed={row === picked}
              onClick={() => setPickedId(row.id)}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded text-left text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${row === picked ? "font-medium" : ""}`}
            >
              <RoundMark mark={{ kind: "history" }} />
              <span className="min-w-0 flex-1 truncate">{labels.title(row.title)}</span>
              {row.live ? (
                <span className="chip chip-idle shrink-0">
                  {labels.live}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(row.lastActivity, now)}</span>
              )}
            </button>
          </div>
          {row === picked && (
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => onResume(workspaceId, { id: row.id, title: row.title })}
                className={`${PILL} allow`}
              >
                {labels.resume}
              </button>
              <button
                onClick={() => onDelete(workspaceId, { id: row.id, title: row.title })}
                className={`${PILL} outline-btn text-error-foreground`}
              >
                {labels.delete}
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
    <div role="status" className="callout-err mx-3 mb-2 px-3 py-2 text-xs">
      {text}
    </div>
  );
}
