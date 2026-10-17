import { useState } from "react";
import { formatWhen, type ListedSession, mergeSessions, type OpenSession } from "./sessionList";
import type { FolderHighlight, HighlightState, SessionHighlight } from "./statusHighlight";
import { StateMarker, tone } from "./statusTone";
import type { SessionListState } from "./useSessionList";
import type { WorkspacesState } from "./useWorkspaces";

type Props = {
  workspaces: WorkspacesState;
  onNewSession(): void;
  onResume(workspaceId: string, row: { id: string; title: string }): void;
  onJump(paneId: string): void;
  sessions: SessionListState;
  openSessions: OpenSession[];
  highlights: Highlights;
  now: number;
};

export type Highlights = { sessions: Map<string, SessionHighlight>; folders: Map<string, FolderHighlight> };

export function WorkspaceSidebar({ workspaces, onNewSession, onResume, onJump, sessions, openSessions, highlights, now }: Props) {
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
        {(items ?? []).map((w) => {
          const highlight = highlights.folders.get(w.id);
          return (
            <li
              key={w.id}
              aria-current={w.id === selected?.id ? "true" : undefined}
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${folderLook(highlight, w.id === selected?.id)}`}
            >
              <button
                onClick={() => select(w.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
              >
                <span className={`truncate ${w.missing ? "line-through text-muted-foreground" : ""}`}>{w.name}</span>
                {w.missing && <span className="text-xs text-error-foreground">Missing</span>}
                {highlight && (
                  <span
                    role="img"
                    aria-label={`${highlight.count} ${highlight.state}`}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] ${tone[highlight.state].chip}`}
                  >
                    <StateMarker state={highlight.state} />
                    {highlight.count}
                  </span>
                )}
              </button>
              <button
                aria-label={`Remove ${w.name}`}
                onClick={() => void removeFolder(w.id)}
                className="shrink-0 text-xs text-muted-foreground border border-border rounded px-1.5"
              >
                Remove
              </button>
            </li>
          );
        })}
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
      <SessionList
        state={sessions}
        openSessions={openSessions}
        highlights={highlights.sessions}
        now={now}
        onResume={onResume}
        onJump={onJump}
      />
    </aside>
  );
}

type ListProps = {
  state: SessionListState;
  openSessions: OpenSession[];
  highlights: Map<string, SessionHighlight>;
  now: number;
  onResume(workspaceId: string, row: { id: string; title: string }): void;
  onJump(paneId: string): void;
};

function SessionList({ state, openSessions, highlights, now, onResume, onJump }: ListProps) {
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
            <SessionRows
              key={state.workspaceId}
              workspaceId={state.workspaceId}
              rows={rows}
              highlights={highlights}
              now={now}
              onResume={onResume}
              onJump={onJump}
            />
          )}
        </>
      );
    }
  }
}

function SessionRows({
  workspaceId,
  rows,
  highlights,
  now,
  onResume,
  onJump,
}: {
  workspaceId: string;
  rows: ListedSession[];
  highlights: Map<string, SessionHighlight>;
  now: number;
  onResume: ListProps["onResume"];
  onJump: ListProps["onJump"];
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = rows.find((r) => r.id === pickedId) ?? null;
  return (
    <ul aria-label="Sessions" className="px-2 space-y-0.5">
      {rows.map((row) => {
        const highlight = highlights.get(row.id);
        const when = formatWhen(row.lastActivity, now);
        return (
          <li
            key={row.id}
            className={`rounded-md px-2 py-1.5 ${highlight ? tone[highlight.state].fill : row === picked ? "bg-muted" : ""}`}
          >
            <button
              aria-pressed={row === picked}
              onClick={() => {
                setPickedId(row.id);
                if (highlight) onJump(highlight.paneId);
              }}
              onKeyDown={(e) => {
                // Activating on Enter's keydown, with the default stopped, keeps the rest of that Enter out of the terminal it focuses.
                if (e.key !== "Enter" || !highlight) return;
                e.preventDefault();
                setPickedId(row.id);
                onJump(highlight.paneId);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-sm text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{row.title}</span>
              {highlight ? (
                <StateChip state={highlight.state} />
              ) : row.live ? (
                <span className="shrink-0 text-[10px] uppercase font-medium text-accent-foreground bg-accent rounded px-1">
                  Live
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
              )}
            </button>
            {highlight && highlight.state !== "Running" && (
              <div className={`text-xs truncate ${tone[highlight.state].text}`}>
                {clock(highlight.since) + (highlight.reason ? ` · ${highlight.reason}` : "")}
              </div>
            )}
            {highlight && <div className="text-xs text-muted-foreground">{row.live ? `Live · ${when}` : when}</div>}
            {row === picked && (
              <div className="mt-1 flex justify-end">
                <button
                  onClick={() => onResume(workspaceId, { id: row.id, title: row.title })}
                  className="text-xs text-foreground border border-border rounded px-1.5"
                >
                  Resume
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// A highlighted folder keeps its status colour; the ring marks it selected instead of the accent fill.
function folderLook(highlight: FolderHighlight | undefined, selected: boolean): string {
  if (highlight) return `${tone[highlight.state].fill} text-foreground ${selected ? "ring-1 ring-ring font-medium" : ""}`;
  return selected ? "bg-accent text-accent-foreground font-medium" : "text-foreground";
}

function StateChip({ state }: { state: HighlightState }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[11px] ${tone[state].chip}`}>
      <StateMarker state={state} />
      {state}
    </span>
  );
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Notice({ text }: { text: string }) {
  return (
    <div role="status" className="mx-2 mb-1 rounded-md border border-error-border bg-error-bg px-2 py-1.5 text-xs text-error-foreground">
      {text}
    </div>
  );
}
