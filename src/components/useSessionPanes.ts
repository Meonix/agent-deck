import { useCallback, useRef, useState } from "react";
import type { SessionsClient } from "../api/sessions";
import type { Workspace } from "../api/workspaces";
import { latencyLogEnabled, withLatencyLog } from "./latencyLog";
import { insertRight } from "./paneLayout";
import type { PaneEntry, TerminalAdapterFactory, TerminalSize } from "./TerminalPane";
import { useToast } from "./Toast";
import { errorDetail } from "./useWorkspaces";

const FOLDER_NOT_FOUND = "Folder not found";
// The pane fits itself right after mounting and resizes the session to match.
const OPEN_SIZE: TerminalSize = { cols: 80, rows: 24 };

type Layout = { entries: PaneEntry[]; focusedId: string | null };

export type SessionPanes = Layout & {
  newSession(workspace: Workspace): Promise<void>;
  closePane(paneId: string): Promise<void>;
  focusPane(paneId: string): void;
};

export function useSessionPanes(
  client: SessionsClient,
  createTerminal: TerminalAdapterFactory,
  onFolderMissing: () => void,
): SessionPanes {
  const [layout, setLayout] = useState<Layout>({ entries: [], focusedId: null });
  const showToast = useToast();
  const opening = useRef(false);
  const entries = useRef(layout.entries);
  entries.current = layout.entries;

  const newSession = useCallback(
    async (workspace: Workspace) => {
      if (workspace.missing) {
        showToast(FOLDER_NOT_FOUND);
        return;
      }
      if (opening.current) return;
      opening.current = true;
      try {
        const { pane, stream } = await client.open(workspace.id, OPEN_SIZE.cols, OPEN_SIZE.rows);
        const adapter = pane.started ? terminal(createTerminal) : null;
        const entry: PaneEntry = { pane, workspaceName: workspace.name, adapter, stream, openedSize: OPEN_SIZE, ended: false };
        setLayout((l) => {
          const order = insertRight(l.entries.map((e) => e.pane.paneId), l.focusedId, pane.paneId);
          const byId = new Map([...l.entries, entry].map((e) => [e.pane.paneId, e]));
          return { entries: order.map((id) => byId.get(id)!), focusedId: pane.paneId };
        });
        // Registered after the insert so an exit already queued finds the entry.
        if (adapter) stream.onOutput((bytes) => adapter.write(bytes));
        stream.onExit(() =>
          setLayout((l) => ({
            ...l,
            entries: l.entries.map((e) => (e.pane.paneId === pane.paneId ? { ...e, ended: true } : e)),
          })),
        );
      } catch (e) {
        if (e === "folder_missing") {
          showToast(FOLDER_NOT_FOUND);
          onFolderMissing();
        } else {
          const detail = errorDetail(e);
          showToast(detail ? `Could not open session: ${detail}` : "Could not open session");
        }
      } finally {
        opening.current = false;
      }
    },
    [client, createTerminal, onFolderMissing, showToast],
  );

  const closePane = useCallback(
    async (paneId: string) => {
      try {
        await client.close(paneId);
      } catch (e) {
        showToast(`Could not close session: ${errorDetail(e)}`);
        return;
      }
      const closing = entries.current.find((e) => e.pane.paneId === paneId);
      closing?.stream.dispose();
      closing?.adapter?.dispose();
      setLayout((l) => ({
        entries: l.entries.filter((e) => e.pane.paneId !== paneId),
        focusedId: l.focusedId === paneId ? null : l.focusedId,
      }));
    },
    [client, showToast],
  );

  const focusPane = useCallback(
    (paneId: string) => setLayout((l) => (l.focusedId === paneId ? l : { ...l, focusedId: paneId })),
    [],
  );

  return { ...layout, newSession, closePane, focusPane };
}

function terminal(createTerminal: TerminalAdapterFactory) {
  const adapter = createTerminal();
  return latencyLogEnabled() ? withLatencyLog(adapter) : adapter;
}
