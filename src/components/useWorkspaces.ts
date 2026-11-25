import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace, WorkspacesClient } from "../api/workspaces";
import { labels } from "../labels";
import { useToast } from "./Toast";

export type WorkspacesState = {
  items: Workspace[] | null;
  /** The row marked aria-current: the folder whose Session Chooser opened last, or one added twice (SRS-FR-003). */
  selected: Workspace | null;
  select(id: string): void;
  addFolder(): Promise<void>;
  /** Resolves true once the folder is gone from the list. */
  removeFolder(id: string): Promise<boolean>;
  refresh(): Promise<void>;
};

export function errorDetail(e: unknown): string {
  return e instanceof Error ? e.message : e == null ? "" : String(e);
}

export function useWorkspaces(client: WorkspacesClient): WorkspacesState {
  const [items, setItems] = useState<Workspace[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const select = useCallback((id: string) => setSelectedId(id), []);
  const showToast = useToast();

  const busy = useRef(false);
  const refreshSeq = useRef(0);

  // Only the most recent refresh may write, so out-of-order responses cannot leave a stale list.
  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const list = await client.list();
    if (seq === refreshSeq.current) setItems(list);
  }, [client]);

  const fail = useCallback(
    (prefix: string, e: unknown) => {
      const detail = errorDetail(e);
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
        fail(labels.loadFoldersFailed, e);
      },
    );
    return () => {
      live = false;
    };
  }, [client, fail]);

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
      fail(labels.addFolderFailed, e);
    } finally {
      busy.current = false;
    }
  }, [client, refresh, fail]);

  const removeFolder = useCallback(
    async (id: string) => {
      if (busy.current) return false;
      busy.current = true;
      try {
        const result = await client.remove(id);
        if (result.ok) {
          setSelectedId((cur) => (cur === id ? null : cur));
          await refresh();
          return true;
        } else if (result.reason === "has_open_panes") {
          showToast(labels.closeOpenSessionsFirst);
        } else {
          fail(labels.removeFolderFailed, result.message);
        }
      } catch (e) {
        fail(labels.removeFolderFailed, e);
      } finally {
        busy.current = false;
      }
      return false;
    },
    [client, refresh, fail, showToast],
  );

  const selected = items?.find((w) => w.id === selectedId) ?? null;
  return { items, selected, select, addFolder, removeFolder, refresh };
}
