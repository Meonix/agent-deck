import type { ActiveSession, FolderHighlight } from "./statusHighlight";
import { StateMarker, tone } from "./statusTone";
import type { WorkspacesState } from "./useWorkspaces";

type Props = {
  workspaces: WorkspacesState;
  folderHighlights: Map<string, FolderHighlight>;
  active: ActiveSession[];
  onJump(paneId: string): void;
  /** A maximized pane is drawn over the sidebar; keep keyboard focus out of it. */
  covered: boolean;
  /** SRS-FR-088: kept mounted, so its scroll and state survive a hide. */
  hidden: boolean;
};

export function WorkspaceSidebar({ workspaces, folderHighlights, active, onJump, covered, hidden }: Props) {
  const { items, selected, select, addFolder, removeFolder } = workspaces;
  return (
    <aside aria-label="Workspaces" hidden={hidden} inert={covered} className="flex flex-col bg-card overflow-auto border-r border-border">
      <section className="bg-section-folders pb-2">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folders</span>
          <button onClick={() => void addFolder()} className="text-xs text-foreground border border-border rounded-md px-2 py-0.5">
            + Add Folder
          </button>
        </div>
        <ul aria-label="Folders" className="px-2 space-y-0.5">
          {(items ?? []).map((w) => {
            const highlight = folderHighlights.get(w.id);
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
      </section>
      <section className="flex-1 bg-section-active border-t border-border pb-2">
        <div className="px-3 pt-3 pb-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active Sessions · {active.length}
          </span>
        </div>
        <ul aria-label="Active sessions" className="px-2 space-y-0.5">
          {active.length === 0 ? (
            <li className="px-2 py-1 text-sm text-muted-foreground">No active sessions</li>
          ) : (
            active.map((row) => <ActiveRow key={row.paneId} row={row} onJump={onJump} />)
          )}
        </ul>
      </section>
    </aside>
  );
}

function ActiveRow({ row, onJump }: { row: ActiveSession; onJump(paneId: string): void }) {
  const detail = row.state === "Needs Approval" || row.state === "Error";
  return (
    <li className={`rounded-md px-2 py-1 ${row.highlighted ? tone[row.state].fill : ""}`}>
      <button
        onClick={() => onJump(row.paneId)}
        onKeyDown={(e) => {
          // Activating on Enter's keydown, with the default stopped, keeps the rest of that Enter out of the terminal it focuses.
          if (e.key !== "Enter") return;
          e.preventDefault();
          onJump(row.paneId);
        }}
        className="flex w-full items-center gap-1.5 rounded-sm text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span role="img" aria-label={row.state} className="inline-flex shrink-0">
          {row.highlighted ? (
            <StateMarker state={row.state} />
          ) : (
            <span className="inline-block size-2 rounded-[2px] border border-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{row.title}</span>
        <span className="max-w-[45%] shrink-0 truncate rounded border border-border px-1 text-[10px] text-muted-foreground">
          {row.workspaceName}
        </span>
      </button>
      {detail && (
        <div className={`pl-3.5 text-xs truncate ${tone[row.state].text}`}>
          {clock(row.since) + (row.reason ? ` · ${row.reason}` : "")}
        </div>
      )}
    </li>
  );
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// A highlighted folder keeps its status colour; the ring marks it selected instead of the accent fill.
function folderLook(highlight: FolderHighlight | undefined, selected: boolean): string {
  if (highlight) return `${tone[highlight.state].fill} text-foreground ${selected ? "ring-1 ring-ring font-medium" : ""}`;
  return selected ? "bg-accent text-accent-foreground font-medium" : "text-foreground";
}
