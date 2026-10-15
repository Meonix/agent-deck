import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace, WorkspacesClient } from "../api/workspaces";

const BLOCKED_REMOVE_MESSAGE = "Close the open sessions of this folder first";
const TOAST_MS = 4000;

// Renders the sidebar and the main-area empty state as siblings so the parent
// grid owns the layout; both share the same add flow.
export function WorkspaceSidebar({ client }: { client: WorkspacesClient }) {
  const [items, setItems] = useState<Workspace[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void client.list().then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const addFolder = useCallback(async () => {
    const path = await client.pickFolder();
    if (path === null) return;
    const result = await client.add(path);
    setItems(await client.list());
    setSelectedId(result.id);
  }, [client]);

  const removeFolder = useCallback(
    async (id: string) => {
      const result = await client.remove(id);
      if (result.ok) {
        setItems(await client.list());
        setSelectedId((cur) => (cur === id ? null : cur));
      } else if (result.reason === "has_open_panes") {
        showToast(BLOCKED_REMOVE_MESSAGE);
      } else {
        showToast(result.message ?? "Could not remove the folder");
      }
    },
    [client, showToast],
  );

  return (
    <>
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
              aria-current={w.id === selectedId ? "true" : undefined}
              onClick={() => setSelectedId(w.id)}
              className={`group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${w.id === selectedId ? "bg-accent text-accent-foreground font-medium" : "text-foreground"}`}
            >
              <span className={`truncate ${w.missing ? "line-through text-muted-foreground" : ""}`}>{w.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {w.missing && <span className="text-xs text-error-foreground">Missing</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeFolder(w.id);
                  }}
                  className="text-xs text-muted-foreground border border-border rounded px-1.5"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <main className="min-h-0 flex items-center justify-center p-2">
        {items !== null && items.length === 0 && (
          <div className="text-center space-y-2 max-w-sm">
            <div className="text-base font-medium text-foreground">No folders yet</div>
            <div className="text-sm text-muted-foreground">Add a folder you work in with Claude Code.</div>
            <button
              onClick={() => void addFolder()}
              className="mt-2 text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5"
            >
              + Add Folder
            </button>
          </div>
        )}
      </main>
      {toast && (
        <div
          role="alert"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-error-border bg-error-bg text-error-foreground text-sm px-4 py-2"
        >
          {toast}
        </div>
      )}
    </>
  );
}
