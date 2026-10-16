import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStatus, SessionState, SessionsClient } from "../api/sessions";
import type { Workspace } from "../api/workspaces";
import { latencyLogEnabled, withLatencyLog } from "./latencyLog";
import { type Layout, type SplitDir, type SplitPath, paneOrder, removePane, setRatio, splitPane } from "./paneTree";
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

// Pixel sizes of the classes in PaneGrid (p-1 container, p-1 around each pane) and
// TerminalPane (border, header, p-1 around the terminal); keep them in step.
const GRID_PADDING = 8;
const PANE_GAP = 8;
const PANE_BORDER = 1;
const PANE_HEADER = 29;
const BODY_PADDING = 4;
const CHROME_WIDTH = 2 * PANE_BORDER + 2 * BODY_PADDING;
const CHROME_HEIGHT = CHROME_WIDTH + PANE_HEADER;

type PanesState = { entries: PaneEntry[]; layout: Layout | null; focusedId: string | null };

export type SessionPanes = PanesState & {
  newSession(workspace: Workspace): Promise<void>;
  resume(workspace: Workspace, session: { id: string; title: string }): Promise<void>;
  splitFrom(paneId: string, dir: SplitDir): Promise<void>;
  closePane(paneId: string): Promise<void>;
  focusPane(paneId: string): void;
  resizeSplit(path: SplitPath, ratio: number): void;
};

export function useSessionPanes(
  client: SessionsClient,
  createTerminal: TerminalAdapterFactory,
  onFolderMissing: () => void,
  paneArea: RefObject<HTMLElement | null>,
  workspaces: Workspace[] | null,
): SessionPanes {
  const [layout, setLayout] = useState<PanesState>({ entries: [], layout: null, focusedId: null });
  const showToast = useToast();
  const opening = useRef(false);
  const entries = useRef(layout.entries);
  entries.current = layout.entries;
  const current = useRef(layout);
  current.current = layout;

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

  const focusPane = useCallback(
    (paneId: string) => setLayout((l) => (l.focusedId === paneId ? l : { ...l, focusedId: paneId })),
    [],
  );

  // The terminal needs real keyboard focus too: the pane may already be the focused one.
  const focusHolder = useCallback(
    (holder: PaneEntry) => {
      focusPane(holder.pane.paneId);
      holder.adapter?.focus();
    },
    [focusPane],
  );

  const openPane = useCallback(
    async (workspace: Workspace, target: string | null, dir: SplitDir, resumed?: { id: string; title: string }) => {
      if (workspace.missing) {
        showToast(FOLDER_NOT_FOUND);
        return;
      }
      if (resumed) {
        const open = openHolder(entries.current, resumed.id);
        if (open) {
          focusHolder(open);
          return;
        }
      }
      if (opening.current) return;
      opening.current = true;
      // Made before the session so the session starts at the size the pane will have.
      const measuring = terminal(createTerminal);
      let kept = false;
      try {
        const openedSize = measureOpenSize(measuring, paneArea.current, current.current.layout, target, dir);
        const { pane, stream } = await client.open(workspace.id, openedSize.cols, openedSize.rows, resumed?.id);
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
          title: resumed?.title ?? UNTITLED,
          graceOver: false,
        };
        setLayout((l) => {
          return {
            entries: [...l.entries, entry],
            layout: splitPane(l.layout, target, pane.paneId, dir),
            focusedId: pane.paneId,
          };
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
        const holder = e === "already_open" && resumed ? openHolder(entries.current, resumed.id) : undefined;
        if (e === "folder_missing") {
          showToast(FOLDER_NOT_FOUND);
          onFolderMissing();
        } else if (holder) {
          focusHolder(holder);
        } else {
          const detail = e === "already_open" || e === "invalid_session" ? "" : errorDetail(e);
          showToast(detail ? `Could not open session: ${detail}` : "Could not open session");
        }
      } finally {
        if (!kept) measuring.dispose();
        opening.current = false;
      }
    },
    [client, createTerminal, focusHolder, onFolderMissing, paneArea, showToast, update],
  );

  const newSession = useCallback(
    (workspace: Workspace) => openPane(workspace, current.current.focusedId, "right"),
    [openPane],
  );
  const resume = useCallback(
    (workspace: Workspace, session: { id: string; title: string }) =>
      openPane(workspace, current.current.focusedId, "right", session),
    [openPane],
  );
  const splitFrom = useCallback(
    async (paneId: string, dir: SplitDir) => {
      const entry = entries.current.find((e) => e.pane.paneId === paneId);
      if (!entry) return;
      const workspace = workspaces?.find((w) => w.id === entry.workspaceId);
      if (!workspace) {
        showToast(FOLDER_NOT_FOUND);
        return;
      }
      await openPane(workspace, paneId, dir);
    },
    [openPane, showToast, workspaces],
  );
  const resizeSplit = useCallback(
    (path: SplitPath, ratio: number) =>
      setLayout((l) => (l.layout ? { ...l, layout: setRatio(l.layout, path, ratio) } : l)),
    [],
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
        layout: l.layout && removePane(l.layout, paneId),
        focusedId: l.focusedId === paneId ? null : l.focusedId,
      }));
    },
    [client, showToast],
  );

  return { ...layout, newSession, resume, splitFrom, closePane, focusPane, resizeSplit };
}

function openHolder(entries: PaneEntry[], sessionId: string): PaneEntry | undefined {
  return entries.find((e) => e.pane.sessionId === sessionId && e.pane.started && !e.ended);
}

function terminal(createTerminal: TerminalAdapterFactory) {
  const adapter = createTerminal();
  return latencyLogEnabled() ? withLatencyLog(adapter) : adapter;
}

/** Fits the terminal inside an offscreen box as large as the new pane's terminal area. */
function measureOpenSize(
  adapter: TerminalAdapter,
  area: HTMLElement | null,
  layout: Layout | null,
  target: string | null,
  dir: SplitDir,
): TerminalSize {
  const body = newBodySize(area, layout, target, dir);
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

/** The new pane's terminal box: the whole area for the first pane, else half of the target's. */
function newBodySize(area: HTMLElement | null, layout: Layout | null, target: string | null, dir: SplitDir) {
  const none = { width: 0, height: 0 };
  if (!area) return none;
  if (layout === null) {
    const { width, height } = area.getBoundingClientRect();
    return {
      width: Math.max(0, Math.floor(width - 2 * GRID_PADDING - CHROME_WIDTH)),
      height: Math.max(0, Math.floor(height - 2 * GRID_PADDING - CHROME_HEIGHT)),
    };
  }
  const order = paneOrder(layout);
  const id = target !== null && order.includes(target) ? target : order[order.length - 1];
  const box = [...area.querySelectorAll("[data-pane-body]")].find((e) => e.getAttribute("data-pane-body") === id);
  if (!box) return none;
  const { width, height } = box.getBoundingClientRect();
  if (width === 0 || height === 0) return none;
  const half = (size: number, chrome: number) => Math.max(0, Math.floor((size + chrome - PANE_GAP) / 2 - chrome));
  return dir === "right"
    ? { width: half(width, CHROME_WIDTH), height }
    : { width, height: half(height, CHROME_HEIGHT) };
}
