import { Folder, X } from "lucide-react";
import { ICON, ICON_SM } from "./icon";
import type { StashedSession } from "./stash";
import type { ActiveSession, FolderHighlight } from "./statusHighlight";
import { StateMarker, tone } from "./statusTone";
import type { WorkspacesState } from "./useWorkspaces";

const SECTION_LABEL = "font-mono text-[11px] font-medium text-muted-foreground before:content-['//_'] before:opacity-60";

type Props = {
  workspaces: WorkspacesState;
  folderHighlights: Map<string, FolderHighlight>;
  active: ActiveSession[];
  /** The pane with the Focus Outline; its row gets the Row Focus Mark (SRS-FR-099). */
  focusedPaneId: string | null;
  onJump(paneId: string): void;
  stashed: StashedSession[];
  onReopen(row: StashedSession): void;
  onUnstash(sessionId: string): void;
  /** A maximized pane is drawn over the sidebar; keep keyboard focus out of it. */
  covered: boolean;
  /** SRS-FR-088: kept mounted, so its scroll and state survive a hide. */
  hidden: boolean;
};

export function WorkspaceSidebar({
  workspaces,
  folderHighlights,
  active,
  focusedPaneId,
  onJump,
  stashed,
  onReopen,
  onUnstash,
  covered,
  hidden,
}: Props) {
  const { items, selected, select, addFolder, removeFolder } = workspaces;
  return (
    <aside aria-label="Workspaces" hidden={hidden} inert={covered} className="flex flex-col bg-card overflow-auto border-r border-border">
      <section className="bg-section-folders pb-2">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className={SECTION_LABEL}>Folders</span>
          <button onClick={() => void addFolder()} className="font-mono text-[11px] text-foreground bg-muted border border-border rounded-md px-2 py-0.5 hover:border-muted-foreground transition-colors">
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
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder {...ICON} className="shrink-0 opacity-70" />
                    <span className={`truncate ${w.missing ? "line-through text-muted-foreground" : ""}`}>{w.name}</span>
                  </span>
                  {w.missing && <span className="font-mono text-[11px] text-error-foreground">Missing</span>}
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
                  className="shrink-0 font-mono text-[11px] text-muted-foreground border border-border rounded-md px-1.5 hover:text-foreground hover:border-muted-foreground transition-colors"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="bg-section-active border-t border-border pb-2">
        <div className="px-3 pt-3 pb-1">
          <span className={SECTION_LABEL}>
            Active Sessions · {active.length}
          </span>
        </div>
        <ul aria-label="Active sessions" className="px-2 space-y-0.5">
          {active.length === 0 ? (
            <li className="px-2 py-1 text-sm text-muted-foreground">No active sessions</li>
          ) : (
            active.map((row) => <ActiveRow key={row.paneId} row={row} focused={row.paneId === focusedPaneId} onJump={onJump} />)
          )}
        </ul>
      </section>
      <section className="flex-1 bg-section-stash border-t border-border pb-2">
        <div className="px-3 pt-3 pb-1">
          <span className={SECTION_LABEL}>
            Stashed Sessions · {stashed.length}
          </span>
        </div>
        <ul aria-label="Stashed sessions" className="px-2 space-y-0.5">
          {stashed.length === 0 ? (
            <li className="px-2 py-1 text-sm text-muted-foreground">No stashed sessions</li>
          ) : (
            stashed.map((row) => (
              <StashedRow
                key={row.sessionId}
                row={row}
                workspaceName={items?.find((w) => w.id === row.workspaceId)?.name ?? row.workspaceName}
                onReopen={onReopen}
                onUnstash={onUnstash}
              />
            ))
          )}
        </ul>
      </section>
    </aside>
  );
}

function ActiveRow({ row, focused, onJump }: { row: ActiveSession; focused: boolean; onJump(paneId: string): void }) {
  const detail = row.state === "Needs Approval" || row.state === "Error";
  // Inset, so the sidebar's overflow and the next row's fill cannot hide it; it sits over the status fill.
  const mark = focused ? "ring-2 ring-inset ring-ring" : "";
  return (
    <li
      aria-current={focused ? "true" : undefined}
      className={`rounded-md px-2 py-1 ${row.highlighted ? tone[row.state].fill : ""} ${mark}`}
    >
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
        <span className="max-w-[45%] shrink-0 truncate rounded-md border border-border px-1 font-mono text-[10px] text-muted-foreground">
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

function StashedRow({ row, workspaceName, onReopen, onUnstash }: {
  row: StashedSession;
  workspaceName: string;
  onReopen(row: StashedSession): void;
  onUnstash(sessionId: string): void;
}) {
  return (
    <li className="group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted transition-colors">
      <button
        onClick={() => onReopen(row)}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 truncate">{row.title}</span>
        <span className="max-w-[45%] shrink-0 truncate rounded-md border border-border px-1 font-mono text-[10px] text-muted-foreground">
          {workspaceName}
        </span>
      </button>
      {/* Shown on hover, and kept reachable by keyboard (SRS-FR-110). */}
      <button
        aria-label={`Remove ${row.title} from stash`}
        title="Remove from stash"
        onClick={() => onUnstash(row.sessionId)}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X {...ICON_SM} />
      </button>
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
