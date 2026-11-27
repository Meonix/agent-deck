import { ChevronDown, ChevronRight, FolderPlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../api/workspaces";
import { labels } from "../labels";
import { FolderMenu } from "./FolderMenu";
import { ICON, ICON_SM } from "./icon";
import type { StashedSession } from "./stash";
import { type FolderTree, needsUser, type SessionRow, type WaitingState, type WorkspaceNode } from "./statusHighlight";
import { RoundMark, tone } from "./statusTone";
import type { WorkspacesState } from "./useWorkspaces";

const GROUP_LABEL = "side-label min-w-0 flex-1 truncate text-left";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
const ROW_TINT: Record<WaitingState, string> = { "Needs Approval": "row-app", Error: "row-err" };
/** Every top-level row and group header: a lead box (chevron, mark or blank), then its text, so all names start in one column. */
export const TREE_ROW = "flex items-center gap-2 px-2";
export const LEAD_BOX = "inline-flex size-5 shrink-0 items-center justify-center";

type Props = {
  workspaces: WorkspacesState;
  tree: FolderTree;
  /** The pane with the Focus Outline; its row gets the Row Focus Mark (SRS-FR-099). */
  focusedPaneId: string | null;
  onJump(paneId: string): void;
  onReopen(row: StashedSession): void;
  onUnstash(sessionId: string): void;
  /** + on a workspace row, or its name: opens that workspace's Session Chooser (SRS-FR-007). */
  onOpenChooser(workspace: Workspace, opener: HTMLElement): void;
  /** A maximized pane is drawn over the sidebar; keep keyboard focus out of it. */
  covered: boolean;
  /** SRS-FR-088: kept mounted, so its scroll and state survive a hide. */
  hidden: boolean;
};

export function WorkspaceSidebar({ workspaces, tree, focusedPaneId, onJump, onReopen, onUnstash, onOpenChooser, covered, hidden }: Props) {
  const { items, selected, addFolder, removeFolder } = workspaces;
  // Fold state lives only as long as the app runs: a fresh launch shows every Session Row (SRS-FR-142).
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  // SRS-FR-141 (CR-017): with no pane open "Folder khác" holds every folder, so it starts open;
  // it re-opens or folds only when that changes, keeping the user's own toggle in between.
  const anyOpen = tree.open.length > 0;
  const [otherOpen, setOtherOpen] = useState(!anyOpen);
  const wasAnyOpen = useRef(anyOpen);
  useEffect(() => {
    if (wasAnyOpen.current === anyOpen) return;
    wasAnyOpen.current = anyOpen;
    setOtherOpen(!anyOpen);
  }, [anyOpen]);
  const openIds = tree.open.map((n) => n.workspace.id).join(",");
  // A workspace that left the tree comes back unfolded when it opens a session again.
  useEffect(() => {
    const ids = new Set(openIds.split(","));
    setFolded((prev) => ([...prev].every((id) => ids.has(id)) ? prev : new Set([...prev].filter((id) => ids.has(id)))));
  }, [openIds]);
  const toggle = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const addButton = useRef<HTMLButtonElement>(null);
  // The removed row takes its ⋯ with it; Thêm folder is the one target always there.
  const remove = (id: string) => void removeFolder(id).then((gone) => gone && addButton.current?.focus());

  return (
    <aside aria-label={labels.sidebar} hidden={hidden} inert={covered} className="side flex min-h-0 flex-col overflow-hidden rounded-card bg-surface">
      <h1 className="shrink-0 px-4 pt-5 pb-3 text-[22px] font-semibold">{labels.appTitle}</h1>
      {/* SRS-FR-088: this list area keeps its scroll position while the sidebar is hidden. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto py-1 text-[13px]">
        <ul>
          {tree.open.map((node) => (
            <WorkspaceItem
              key={node.workspace.id}
              node={node}
              selected={node.workspace.id === selected?.id}
              folded={folded.has(node.workspace.id)}
              focusedPaneId={focusedPaneId}
              onToggle={() => toggle(node.workspace.id)}
              onOpenChooser={onOpenChooser}
              onJump={onJump}
              onRemove={remove}
              hidden={hidden}
            />
          ))}
        </ul>
        {tree.other.length > 0 && (
          <div>
            <button
              aria-expanded={otherOpen}
              onClick={() => setOtherOpen((v) => !v)}
              className={`${TREE_ROW} h-9 w-full text-muted-foreground hover:bg-muted ${FOCUS}`}
            >
              <span className={LEAD_BOX}>{otherOpen ? <ChevronDown {...ICON} /> : <ChevronRight {...ICON} />}</span>
              <span className={GROUP_LABEL}>{labels.otherFolders(tree.other.length)}</span>
            </button>
            {otherOpen && (
              <ul>
                {tree.other.map((w) => (
                  <li key={w.id} aria-current={w.id === selected?.id ? "true" : undefined}>
                    <div className={`${TREE_ROW} h-9 ${rowLook(w.id === selected?.id)}`}>
                      <span className={LEAD_BOX} />
                      <NameButton workspace={w} onOpenChooser={onOpenChooser} />
                      <PlusButton workspace={w} onOpenChooser={onOpenChooser} />
                      <FolderMenu workspace={w} onRemove={remove} hidden={hidden} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tree.stash.length > 0 && (
          <div>
            <div className={`${TREE_ROW} h-9`}>
              <span className={LEAD_BOX} />
              <span className={GROUP_LABEL}>{labels.stashedCount(tree.stash.length)}</span>
            </div>
            <ul aria-label={labels.stashedSessions}>
              {tree.stash.map((row) => (
                <StashedRow
                  key={row.sessionId}
                  row={row}
                  workspaceName={items?.find((w) => w.id === row.workspaceId)?.name ?? row.workspaceName}
                  onReopen={onReopen}
                  onUnstash={onUnstash}
                />
              ))}
            </ul>
          </div>
        )}
        <button
          ref={addButton}
          title={labels.addFolder}
          onClick={() => void addFolder()}
          className={`flex h-9 w-full shrink-0 items-center gap-2 px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
        >
          <FolderPlus {...ICON} />
          {labels.addFolder}
        </button>
      </div>
    </aside>
  );
}

// The selected workspace keeps the active fill only; the row is never status-tinted (SRS-FR-040).
function rowLook(selected: boolean): string {
  return selected ? "bg-accent" : "hover:bg-muted";
}

type OpenChooser = { workspace: Workspace; onOpenChooser(workspace: Workspace, opener: HTMLElement): void };

// PO decision at GATE 1: the name opens the chooser as + does.
function NameButton({ workspace: w, onOpenChooser }: OpenChooser) {
  return (
    <button onClick={(e) => onOpenChooser(w, e.currentTarget)} className={`flex min-w-0 flex-1 items-center gap-2 rounded text-left ${FOCUS}`}>
      <span className={`truncate ${w.missing ? "text-muted-foreground line-through" : "text-foreground"}`}>{w.name}</span>
      {w.missing && <span className="chip chip-idle">{labels.missing}</span>}
    </button>
  );
}

function PlusButton({ workspace: w, onOpenChooser }: OpenChooser) {
  return (
    <button
      aria-label={labels.openChooser(w.name)}
      onClick={(e) => onOpenChooser(w, e.currentTarget)}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
    >
      <Plus {...ICON} />
    </button>
  );
}

function WorkspaceItem({ node, selected, folded, focusedPaneId, onToggle, onOpenChooser, onJump, onRemove, hidden }: {
  node: WorkspaceNode;
  selected: boolean;
  folded: boolean;
  focusedPaneId: string | null;
  onToggle(): void;
  onOpenChooser(workspace: Workspace, opener: HTMLElement): void;
  onJump(paneId: string): void;
  onRemove(id: string): void;
  hidden: boolean;
}) {
  const { workspace: w, rows, count } = node;
  return (
    <li aria-current={selected ? "true" : undefined}>
      <div className={`${TREE_ROW} h-9 ${rowLook(selected)}`}>
        <button
          aria-label={folded ? labels.expand(w.name) : labels.collapse(w.name)}
          aria-expanded={!folded}
          onClick={onToggle}
          className={`${LEAD_BOX} rounded text-muted-foreground hover:text-foreground ${FOCUS}`}
        >
          {folded ? <ChevronRight {...ICON} /> : <ChevronDown {...ICON} />}
        </button>
        <NameButton workspace={w} onOpenChooser={onOpenChooser} />
        <span
          role="img"
          aria-label={labels.folderCount(count.n, count.tone)}
          className={`shrink-0 ${tone[count.tone === "grey" ? "Idle" : count.tone].chip}`}
        >
          {count.n}
        </span>
        <PlusButton workspace={w} onOpenChooser={onOpenChooser} />
        <FolderMenu workspace={w} onRemove={onRemove} hidden={hidden} />
      </div>
      {!folded && (
        <ul>
          {rows.map((row) => (
            <SessionRowItem key={row.paneId} row={row} focused={row.paneId === focusedPaneId} onJump={onJump} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SessionRowItem({ row, focused, onJump }: { row: SessionRow; focused: boolean; onJump(paneId: string): void }) {
  const tint = needsUser(row.state) ? ROW_TINT[row.state] : "";
  return (
    <li
      aria-current={focused ? "location" : undefined}
      className={`${tint} ${focused ? "side-on" : tint ? "" : "hover:bg-muted"}`}
    >
      <button
        onClick={() => onJump(row.paneId)}
        onKeyDown={(e) => {
          // Activating on Enter's keydown, with the default stopped, keeps the rest of that Enter out of the terminal it focuses.
          if (e.key !== "Enter") return;
          e.preventDefault();
          onJump(row.paneId);
        }}
        className={`flex h-8 w-full items-center gap-2 pl-8 pr-2 text-left ${FOCUS}`}
      >
        <RoundMark mark={{ kind: "state", state: row.state }} />
        <span className="min-w-0 flex-1 truncate">{labels.title(row.title)}</span>
        <span className={`shrink-0 whitespace-nowrap text-[11px] font-medium ${tone[row.state].word}`}>{labels.state[row.state]}</span>
      </button>
      {row.highlighted && (
        <div className="sub -mt-0.5 truncate pb-1.5 pl-12 pr-2 text-[11px]">
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
    <li className={`group ${TREE_ROW} h-9 hover:bg-muted transition-colors`}>
      <button onClick={() => onReopen(row)} className={`flex min-w-0 flex-1 items-center gap-2 rounded text-left ${FOCUS}`}>
        <span className={LEAD_BOX}>
          <RoundMark mark={{ kind: "stashed" }} />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {labels.title(row.title)}{" "}
          <span className="sub">
            · <span>{workspaceName}</span>
          </span>
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
