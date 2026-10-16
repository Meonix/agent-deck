import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStatus, SessionState, SessionsClient } from "../api/sessions";
import type { Workspace } from "../api/workspaces";
import { latencyLogEnabled, withLatencyLog } from "./latencyLog";
import { insertRight, paneBodySize } from "./paneLayout";
import { type PaneEntry, type TerminalAdapter, type TerminalAdapterFactory, type TerminalSize, UNTITLED } from "./TerminalPane";
import { useToast } from "./Toast";
import { errorDetail } from "./useWorkspaces";

const TITLE_REFRESH_MS = 10_000;
// How long a pane may stay untracked before the UI says its status is unavailable.
const STATUS_GRACE_MS = 5_000;
const FOLDER_NOT_FOUND = "Folder not found";
// Used when the pane area cannot be measured; the pane fits itself right after
// mounting and resizes the session to match.
const FALLBACK_SIZE: TerminalSize = { cols: 80, rows: 24 };

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
  paneArea: RefObject<HTMLElement | null>,
): SessionPanes {
  const [layout, setLayout] = useState<Layout>({ entries: [], focusedId: null });
  const showToast = useToast();
  const opening = useRef(false);
  const entries = useRef(layout.entries);
  entries.current = layout.entries;

  const update = useCallback(
    (paneId: string, change: (e: PaneEntry) => Partial<PaneEntry>) =>
      setLayout((l) => ({
        ...l,
        entries: l.entries.map((e) => (e.pane.paneId === paneId ? { ...e, ...change(e) } : e)),
      })),
    [],
  );

  // SRS-FR-038: a change counts as shown once its commit has reached the board. Passive
  // effects run after the browser paints, and unlike requestAnimationFrame they are not held
  // back while the window is hidden, so time the user spends away is not counted as latency.
  const unrecorded = useRef<{ pane: OpenedPane; state: SessionState; reportedAt: number }[]>([]);
  useEffect(() => {
    if (unrecorded.current.length === 0) return;
    const changes = unrecorded.current;
    unrecorded.current = [];
    const shownAt = Date.now();
    for (const { pane, state, reportedAt } of changes) {
      // A lost record must never disturb the panes.
      client.recordStatusShown(pane.sessionId, state, reportedAt, Math.max(shownAt, reportedAt)).catch(() => {});
    }
  }, [client, layout]);

  // One interval per live pane, started once and stopped when the pane ends or closes,
  // so other panes opening never restart it. A failed lookup keeps the last title.
  const titleTimers = useRef(new Map<string, () => void>());

  const graceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const polled = layout.entries
    .filter((e) => e.pane.started && !e.ended)
    .map((e) => e.pane.paneId)
    .join(",");
  useEffect(() => {
    const wanted = new Set(polled ? polled.split(",") : []);
    for (const [paneId, stop] of titleTimers.current) {
      if (wanted.has(paneId)) continue;
      stop();
      titleTimers.current.delete(paneId);
    }
    for (const paneId of wanted) {
      if (titleTimers.current.has(paneId)) continue;
      let live = true;
      const load = () =>
        client.title(paneId).then(
          (title) => live && update(paneId, () => ({ title })),
          () => {},
        );
      void load();
      const timer = setInterval(load, TITLE_REFRESH_MS);
      titleTimers.current.set(paneId, () => {
        live = false;
        clearInterval(timer);
      });
    }
  }, [client, polled, update]);
  useEffect(() => {
    const titles = titleTimers.current;
    const graces = graceTimers.current;
    return () => {
      titles.forEach((stop) => stop());
      titles.clear();
      graces.forEach(clearTimeout);
      graces.clear();
    };
  }, []);

  const newSession = useCallback(
    async (workspace: Workspace) => {
      if (workspace.missing) {
        showToast(FOLDER_NOT_FOUND);
        return;
      }
      if (opening.current) return;
      opening.current = true;
      // Made before the session so the session starts at the size the pane will have.
      const measuring = terminal(createTerminal);
      let kept = false;
      try {
        const openedSize = measureOpenSize(measuring, paneArea.current, entries.current.length + 1);
        const { pane, stream } = await client.open(workspace.id, openedSize.cols, openedSize.rows);
        kept = pane.started;
        const adapter = pane.started ? measuring : null;
        const status: PaneStatus = { state: "Idle", since: Date.now(), reason: null, tracked: false, reportedAt: null };
        const entry: PaneEntry = {
          pane,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          openedAt: Date.now(),
          adapter,
          stream,
          openedSize,
          ended: false,
          status,
          title: UNTITLED,
          graceOver: false,
        };
        setLayout((l) => {
          const order = insertRight(l.entries.map((e) => e.pane.paneId), l.focusedId, pane.paneId);
          const byId = new Map([...l.entries, entry].map((e) => [e.pane.paneId, e]));
          return { entries: order.map((id) => byId.get(id)!), focusedId: pane.paneId };
        });
        // Registered after the insert so an exit already queued finds the entry.
        if (adapter) stream.onOutput((bytes) => adapter.write(bytes));
        stream.onStatus((next) => {
          if (next.tracked && next.reportedAt !== null) {
            unrecorded.current.push({ pane, state: next.state, reportedAt: next.reportedAt });
          }
          update(pane.paneId, () => ({ status: next }));
        });
        stream.onExit(() => update(pane.paneId, () => ({ ended: true })));
        graceTimers.current.set(
          pane.paneId,
          setTimeout(() => update(pane.paneId, () => ({ graceOver: true })), STATUS_GRACE_MS),
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
        if (!kept) measuring.dispose();
        opening.current = false;
      }
    },
    [client, createTerminal, onFolderMissing, paneArea, showToast, update],
  );

  const closePane = useCallback(
    async (paneId: string) => {
      try {
        await client.close(paneId);
      } catch (e) {
        showToast(`Could not close session: ${errorDetail(e)}`);
        return;
      }
      clearTimeout(graceTimers.current.get(paneId));
      graceTimers.current.delete(paneId);
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

/** Fits the terminal inside an offscreen box as large as the new pane's terminal area. */
function measureOpenSize(adapter: TerminalAdapter, area: HTMLElement | null, columns: number): TerminalSize {
  if (!area) return FALLBACK_SIZE;
  const body = paneBodySize(area.getBoundingClientRect(), columns);
  if (body.width === 0 || body.height === 0) return FALLBACK_SIZE;
  const probe = document.createElement("div");
  Object.assign(probe.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    width: `${body.width}px`,
    height: `${body.height}px`,
  });
  document.body.appendChild(probe);
  try {
    adapter.open(probe);
    return adapter.fit();
  } finally {
    probe.remove();
  }
}
