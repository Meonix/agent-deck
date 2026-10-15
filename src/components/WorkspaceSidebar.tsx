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

  const busy = useRef(false);
  const refreshSeq = useRef(0);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // Only the most recent refresh may write, so out-of-order responses cannot leave a stale list.
  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const list = await client.list();
    if (seq === refreshSeq.current) setItems(list);
  }, [client]);

  const fail = useCallback(
    (prefix: string, e: unknown) => {
      const detail = e instanceof Error ? e.message : e == null ? "" : String(e);
      showToast(detail ? `${prefix}: ${detail}` : prefix);
    },
    [showToast],
  );

  useEffect(() => {
    let live = true;
    client.list().then(
      (list) => live && setItems(list),
      (e) => {
        if (!live) return;
        setItems([]);
        fail("Could not load folders", e);
      },
    );
    return () => {
      live = false;
    };
  }, [client, fail]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const addFolder = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const path = await client.pickFolder();
      if (path === null) return;
      const result = await client.add(path);
      setSelectedId(result.id);
      await refresh();
    } catch (e) {
      fail("Could not add folder", e);
    } finally {
      busy.current = false;
    }
  }, [client, refresh, fail]);

  const removeFolder = useCallback(
    async (id: string) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const result = await client.remove(id);
        if (result.ok) {
          setSelectedId((cur) => (cur === id ? null : cur));
          await refresh();
        } else if (result.reason === "has_open_panes") {
          showToast(BLOCKED_REMOVE_MESSAGE);
        } else {
          fail("Could not remove folder", result.message);
        }
      } catch (e) {
        fail("Could not remove folder", e);
      } finally {
        busy.current = false;
      }
    },
    [client, refresh, fail, showToast],
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
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${w.id === selectedId ? "bg-accent text-accent-foreground font-medium" : "text-foreground"}`}
            >
              <button
                onClick={() => setSelectedId(w.id)}
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
