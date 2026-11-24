import { FolderPlus, X } from "lucide-react";
import { labels } from "../labels";
import { ICON, ICON_SM } from "./icon";
import type { StashedSession } from "./stash";
import type { ActiveSession, FolderHighlight } from "./statusHighlight";
import { RoundMark, tone } from "./statusTone";
import type { WorkspacesState } from "./useWorkspaces";

// Sections share the sidebar's --card, where --section-label is measured; only their labels set them apart.
const SECTION = "py-1";
const SECTION_LABEL = "side-label text-[10px] uppercase";
const SECTION_HEAD = "px-3 pt-2 pb-1";
const CHIP = "max-w-[45%] shrink-0 truncate text-[11px] text-muted-foreground";
const ROW = "py-2 pl-3 pr-3";
const EMPTY = "px-3 pb-2 text-[13px] text-muted-foreground";

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
    <aside aria-label={labels.sidebar} hidden={hidden} inert={covered} className="side flex min-h-0 flex-col overflow-hidden">
      {/* SRS-FR-088: this list area keeps its scroll position while the sidebar is hidden. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto py-1">
        <section className={SECTION}>
          <div className={SECTION_HEAD}>
            <span className={SECTION_LABEL}>{labels.folders}</span>
          </div>
          <ul aria-label={labels.folders}>
            {(items ?? []).map((w) => {
              const highlight = folderHighlights.get(w.id);
              return (
                <li
                  key={w.id}
                  aria-current={w.id === selected?.id ? "true" : undefined}
                  className={`group flex min-h-9 items-center justify-between gap-2 border-l-2 py-1 pl-[10px] pr-2 text-[13px] transition-colors ${folderLook(highlight, w.id === selected?.id)}`}
                >
                  <button
                    onClick={() => select(w.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <RoundMark mark={{ kind: "folder", missing: w.missing }} />
                      <span className="flex min-w-0 flex-col">
                        <span className={`truncate ${w.missing ? "text-muted-foreground" : ""}`}>{w.name}</span>
                        {w.missing && <span className="text-[11px] text-error-foreground">{labels.missing}</span>}
                      </span>
                    </span>
                    {highlight && (
                      <span
                        role="img"
                        aria-label={labels.folderStatus(highlight.count, highlight.state)}
                        className={`shrink-0 ${tone[highlight.state].chip}`}
                      >
                        {highlight.count}
                      </span>
                    )}
                  </button>
                  {/* Shown on hover, and kept reachable by keyboard like the stash ×. */}
                  <button
                    aria-label={labels.removeFolder(w.name)}
                    title={labels.removeFolder(w.name)}
                    onClick={() => void removeFolder(w.id)}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 transition-opacity"
                  >
                    <X {...ICON_SM} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className={SECTION}>
          <div className={SECTION_HEAD}>
            <span className={SECTION_LABEL}>
              {labels.activeCount(active.length)}
            </span>
          </div>
          <ul aria-label={labels.activeSessions}>
            {active.length === 0 ? (
              <li className={EMPTY}>{labels.noActiveSessions}</li>
            ) : (
              active.map((row) => <ActiveRow key={row.paneId} row={row} focused={row.paneId === focusedPaneId} onJump={onJump} />)
            )}
          </ul>
        </section>
        <section className={SECTION}>
          <div className={SECTION_HEAD}>
            <span className={SECTION_LABEL}>
              {labels.stashedCount(stashed.length)}
            </span>
          </div>
          <ul aria-label={labels.stashedSessions}>
            {stashed.length === 0 ? (
              <li className={EMPTY}>{labels.noStashedSessions}</li>
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
      </div>
      <div className="shrink-0 border-t border-border">
        <button
          aria-label={labels.addFolder}
          title={labels.addFolder}
          onClick={() => void addFolder()}
          className="flex h-10 w-full items-center gap-2 px-3 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <FolderPlus {...ICON} />
          {labels.addFolder}
        </button>
      </div>
    </aside>
  );
}

function ActiveRow({ row, focused, onJump }: { row: ActiveSession; focused: boolean; onJump(paneId: string): void }) {
  const detail = row.state === "Needs Approval" || row.state === "Error";
  // Inset, so the sidebar's overflow and the next row's fill cannot hide it; it sits over the status fill.
  const mark = focused ? "ring-2 ring-inset ring-row-focus" : "";
  return (
    <li
      aria-current={focused ? "true" : undefined}
      className={`${ROW} ${row.highlighted ? tone[row.state].fill : ""} ${mark}`}
    >
      <button
        onClick={() => onJump(row.paneId)}
        onKeyDown={(e) => {
          // Activating on Enter's keydown, with the default stopped, keeps the rest of that Enter out of the terminal it focuses.
          if (e.key !== "Enter") return;
          e.preventDefault();
          onJump(row.paneId);
        }}
        className="flex w-full items-center gap-3 rounded text-left text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span role="img" aria-label={labels.state[row.state]} className="inline-flex shrink-0">
          <RoundMark mark={{ kind: "state", state: row.state }} />
        </span>
        <span className="min-w-0 flex-1 truncate">{labels.title(row.title)}</span>
        <span className={CHIP}>
          {row.workspaceName}
        </span>
      </button>
      {detail && (
        <div className={`pl-10 text-[11px] truncate ${tone[row.state].text}`}>
          {clock(row.since) + (row.reason ? ` · ${labels.reason(row.reason)}` : "")}
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
    <li className={`group flex items-center gap-1 ${ROW} hover:bg-muted transition-colors`}>
      <button
        onClick={() => onReopen(row)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded text-left text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RoundMark mark={{ kind: "stashed" }} />
        <span className="min-w-0 flex-1 truncate">{labels.title(row.title)}</span>
        <span className={CHIP}>
          {workspaceName}
        </span>
      </button>
      {/* Shown on hover, and kept reachable by keyboard (SRS-FR-110). */}
      <button
        aria-label={labels.unstash(labels.title(row.title))}
        title={labels.unstashTip}
        onClick={() => onUnstash(row.sessionId)}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
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

// A highlighted folder keeps its status colour; the left bar marks it selected instead of the accent fill.
function folderLook(highlight: FolderHighlight | undefined, selected: boolean): string {
  const bar = selected ? "border-l-row-focus font-medium" : "border-l-transparent";
  if (highlight) return `${tone[highlight.state].fill} text-foreground ${bar}`;
  return selected ? `${bar} bg-section-active text-foreground` : `${bar} text-foreground hover:bg-muted`;
}
