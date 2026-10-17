import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace, WorkspacesClient } from "../api/workspaces";
import { useToast } from "./Toast";

const BLOCKED_REMOVE_MESSAGE = "Close the open sessions of this folder first";

export type WorkspacesState = {
  items: Workspace[] | null;
  selected: Workspace | null;
  selections: number;
  /** The Session History Panel of the selected folder is shown (SRS-FR-054). */
  historyOpen: boolean;
  /** Selects a folder and opens its history; on the selected folder with the history open, closes it. */
  select(id: string): void;
  closeHistory(): void;
  addFolder(): Promise<void>;
  removeFolder(id: string): Promise<void>;
  refresh(): Promise<void>;
};

export function errorDetail(e: unknown): string {
  return e instanceof Error ? e.message : e == null ? "" : String(e);
}

export function useWorkspaces(client: WorkspacesClient): WorkspacesState {
  const [items, setItems] = useState<Workspace[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bumped on every selection that opens the history, also of the folder already selected, so its sessions are read again.
  const [selections, setSelections] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const select = useCallback(
    (id: string) => {
      if (id === selectedId && historyOpen) {
        setHistoryOpen(false);
        return;
      }
      setSelectedId(id);
      setHistoryOpen(true);
      setSelections((n) => n + 1);
    },
    [selectedId, historyOpen],
  );
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
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
        fail("Could not load folders", e);
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
      setHistoryOpen(true);
      setSelections((n) => n + 1);
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

  const selected = items?.find((w) => w.id === selectedId) ?? null;
  return { items, selected, selections, historyOpen, select, closeHistory, addFolder, removeFolder, refresh };
}
