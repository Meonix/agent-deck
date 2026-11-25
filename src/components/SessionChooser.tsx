import { Plus, Trash2, X } from "lucide-react";
import { type FocusEvent as ReactFocusEvent, type KeyboardEvent, type RefObject, useLayoutEffect, useRef } from "react";
import { labels } from "../labels";
import { ICON, ICON_SM } from "./icon";
import { formatWhen, type ListedSession, mergeSessions, type OpenSession } from "./sessionList";
import { useModalFocus } from "./useModalFocus";
import type { SessionListState } from "./useSessionList";

const ROW = "li[data-session-row]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

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
  now: number;
  /** A confirm dialog is stacked above: the chooser stands down, keys and focus included. */
  blocked: boolean;
  /** Gets focus once the chooser goes; null when a pane takes it instead. */
  returnFocusTo: RefObject<HTMLElement | null>;
  onNewSession(): void;
  onResume: RowAction;
  onDelete: RowAction;
  /** ×, Esc or a click outside: closed without opening a pane. */
  onClose(): void;
} & SelectionProps;

/** A workspace's sessions in a dialog over the workbench, opened from + on its row (SRS-FR-007, SRS-FR-054). */
export function SessionChooser({ workspaceName, blocked, returnFocusTo, onNewSession, onClose, ...list }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const newSession = useRef<HTMLButtonElement>(null);
  // Off while blocked: its listeners sit on the document, where a stacked confirm's stopPropagation cannot reach them.
  useModalFocus(dialog, newSession, onClose, { active: !blocked, returnTo: returnFocusTo });
  // The row last holding focus, so a delete that removes it can hand focus on instead of dropping it on body.
  const lastRow = useRef<{ row: HTMLElement; index: number } | null>(null);
  const rowsNow = () => [...(dialog.current?.querySelectorAll<HTMLElement>(ROW) ?? [])];
  const onFocusIn = (e: ReactFocusEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(ROW);
    lastRow.current = row ? { row, index: rowsNow().indexOf(row) } : null;
  };
  // No deps: the render that removes the row is the one to act on.
  useLayoutEffect(() => {
    const last = lastRow.current;
    if (blocked || !last || last.row.isConnected || document.activeElement !== document.body) return;
    lastRow.current = null;
    // The row now at its place is the next one; past the end, the previous one.
    const rows = rowsNow();
    (rows[Math.min(last.index, rows.length - 1)]?.querySelector("button") ?? newSession.current)?.focus();
  });
  return (
    <div
      inert={blocked}
      className="scrim absolute inset-0 z-10 flex items-center justify-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-chooser-title"
        onFocus={onFocusIn}
        className="dlg flex max-h-[calc(100%-2rem)] w-[440px] max-w-[calc(100%-2rem)] flex-col overflow-hidden"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <h2 id="session-chooser-title" className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
            {workspaceName}
          </h2>
          <button
            aria-label={labels.close}
            onClick={onClose}
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
          >
            <X {...ICON} />
          </button>
        </div>
        <div className="shrink-0 p-3">
          <button
            ref={newSession}
            onClick={onNewSession}
            onKeyDown={onEnter(onNewSession)}
            className="send flex h-10 w-full items-center justify-center gap-2 text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus {...ICON} />
            {labels.newSession}
          </button>
        </div>
        <div className="side-label shrink-0 px-4 py-1 text-[11px]">{labels.oldSessions}</div>
        <SessionList {...list} />
        <div className="h-2 shrink-0" />
      </div>
    </div>
  );
}

type ListProps = Omit<Props, "workspaceName" | "blocked" | "returnFocusTo" | "onNewSession" | "onClose">;

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
        <ul aria-label={labels.loadingSessions}>
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="flex h-10 items-center gap-2 px-4">
              <span className="skel size-4 rounded-sm animate-pulse" />
              <span className="skel h-3 flex-1 rounded animate-pulse" />
              <span className="skel h-3 w-12 rounded animate-pulse" />
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
          {unreadable > 0 && <Notice text={labels.unreadable(unreadable)} />}
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">{labels.noSessions}</div>
          ) : (
            <SessionRows
              workspaceId={workspaceId}
              rows={rows}
              now={now}
              onResume={onResume}
              onDelete={onDelete}
              ticked={ticked}
              onTick={(id, on) => onSelect(on ? [...ticked, id] : ticked.filter((t) => t !== id))}
            />
          )}
          {ticked.length > 0 && (
            // Below the scrolling rows, so it stays in view and moves no row.
            <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2">
              <button
                onClick={() => onSelect(rows.map((r) => r.id))}
                className={`flex-1 rounded text-left text-[12px] text-muted-foreground hover:text-foreground ${FOCUS}`}
              >
                {labels.selectAll}
              </button>
              <button
                disabled={deletingSelection}
                onClick={() => onDeleteSelected(workspaceId, ticked)}
                className="btn-danger shrink-0 px-3 py-1 text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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

function SessionRows({ workspaceId, rows, now, onResume, onDelete, ticked, onTick }: {
  workspaceId: string;
  rows: ListedSession[];
  now: number;
  onResume: RowAction;
  onDelete: RowAction;
  ticked: string[];
  onTick(id: string, on: boolean): void;
}) {
  return (
    <ul aria-label={labels.oldSessions} className="min-h-0 overflow-auto">
      {rows.map((row) => (
        <li key={row.id} data-session-row className="group flex h-10 items-center gap-2 px-4 hover:bg-muted transition-colors">
          <input
            type="checkbox"
            aria-label={labels.select(labels.title(row.title))}
            checked={ticked.includes(row.id)}
            onChange={(e) => onTick(row.id, e.target.checked)}
            className="size-4 shrink-0 accent-primary"
          />
          <button
            onClick={() => onResume(workspaceId, { id: row.id, title: row.title })}
            onKeyDown={onEnter(() => onResume(workspaceId, { id: row.id, title: row.title }))}
            className={`flex h-full min-w-0 flex-1 items-center gap-2 rounded text-left text-[13px] text-foreground ${FOCUS}`}
          >
            <span className="min-w-0 flex-1 truncate">{labels.title(row.title)}</span>
            {row.live ? (
              <span className="chip chip-idle shrink-0">{labels.live}</span>
            ) : (
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(row.lastActivity, now)}</span>
            )}
          </button>
          <button
            aria-label={labels.deleteSession(labels.title(row.title))}
            onClick={() => onDelete(workspaceId, { id: row.id, title: row.title })}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:text-error-foreground group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 {...ICON_SM} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// Acting on keydown, with the default stopped, keeps the rest of that Enter out of the terminal the pane focuses.
function onEnter(act: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    act();
  };
}

function Notice({ text }: { text: string }) {
  return (
    <div role="status" className="callout-err mx-4 my-2 shrink-0 px-3 py-2 text-xs">
      {text}
    </div>
  );
}
