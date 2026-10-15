import type { WorkspacesState } from "./useWorkspaces";

type Props = {
  workspaces: WorkspacesState;
  onNewSession(): void;
};

export function WorkspaceSidebar({ workspaces, onNewSession }: Props) {
  const { items, selected, select, addFolder, removeFolder } = workspaces;
  return (
    <aside className="bg-card overflow-auto border-r border-border">
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
    </aside>
  );
}
