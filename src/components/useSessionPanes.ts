import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStatus, SessionState, SessionsClient } from "../api/sessions";
import type { Workspace } from "../api/workspaces";
import { latencyLogEnabled, withLatencyLog } from "./latencyLog";
import { SHELL_OPEN_SIZE } from "./PaneShell";
import { type Layout, type SplitDir, type SplitPath, paneOrder, removePane, setRatio, splitPane } from "./paneTree";
import { type PaneEntry, type ShellEntry, type TerminalAdapter, type TerminalAdapterFactory, type TerminalSize, UNTITLED } from "./TerminalPane";
import { useToast } from "./Toast";
import { errorDetail } from "./useWorkspaces";

const TITLE_REFRESH_MS = 10_000;
const SHELL_ACTIVITY_MS = 1_000;
const SHELL_RATIO = 0.3;
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

type PanesState = { entries: PaneEntry[]; layout: Layout | null; focusedId: string | null; maximizedId: string | null };

export type SessionPanes = PanesState & {
  newSession(workspace: Workspace): Promise<void>;
  resume(workspace: Workspace, session: { id: string; title: string }): Promise<void>;
  splitFrom(paneId: string, dir: SplitDir): Promise<void>;
  /** False when the session could not be closed; the pane then stays. */
  closePane(paneId: string): Promise<boolean>;
  focusPane(paneId: string): void;
  jumpTo(paneId: string): void;
  maximize(paneId: string): void;
  /** Back to the layout; with a pane id, that pane gets the keyboard once it is no longer inert. */
  restore(jumpToPaneId?: string): void;
  resizeSplit(path: SplitPath, ratio: number): void;
  /** Opens the pane's shell when it has none, else hides or shows it. */
  toggleShell(paneId: string): Promise<void>;
  resizeShell(paneId: string, ratio: number): void;
  dismissShellFailure(paneId: string): void;
  /** Counts for the diagnostic report. */
  diagnostics(): { expectedTerminals: number; titleTimers: number; livePanes: number };
};

export function useSessionPanes(
  client: SessionsClient,
  createTerminal: TerminalAdapterFactory,
  onFolderMissing: () => void,
  paneArea: RefObject<HTMLElement | null>,
  workspaces: Workspace[] | null,
): SessionPanes {
  const [layout, setLayout] = useState<PanesState>({ entries: [], layout: null, focusedId: null, maximizedId: null });
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

  // SRS-FR-038: a change counts as shown once its commit has reached the Status Highlight. Passive
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

  const jumpTo = useCallback(
    (paneId: string) => {
      const entry = entries.current.find((e) => e.pane.paneId === paneId);
      if (entry) focusHolder(entry);
    },
    [focusHolder],
  );

  const closePane = useCallback(
    async (paneId: string) => {
      try {
        await client.close(paneId);
      } catch (e) {
        showToast(`Could not close session: ${errorDetail(e)}`);
        return false;
      }
      clearTimeout(graceTimers.current.get(paneId));
      graceTimers.current.delete(paneId);
      const closing = entries.current.find((e) => e.pane.paneId === paneId);
      closing?.stream.dispose();
      closing?.adapter?.dispose();
      closing?.shell?.stream.dispose();
      closing?.shell?.adapter.dispose();
      setLayout((l) => ({
        entries: l.entries.filter((e) => e.pane.paneId !== paneId),
        layout: l.layout && removePane(l.layout, paneId),
        focusedId: l.focusedId === paneId ? null : l.focusedId,
        maximizedId: l.maximizedId === paneId ? null : l.maximizedId,
      }));
      return true;
    },
    [client, showToast],
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
          shell: null,
          shellFailed: false,
        };
        setLayout((l) => {
          return {
            entries: [...l.entries, entry],
            layout: splitPane(l.layout, target, pane.paneId, dir),
            focusedId: pane.paneId,
            // SRS-FR-046: the new pane takes its place in the restored layout.
            maximizedId: null,
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
        // SRS-FR-083: a normal exit takes its pane along; any other exit, or a failed close, leaves
        // "Session ended" (SRS-FR-028).
        const markEnded = () => update(pane.paneId, () => ({ ended: true }));
        stream.onExit((code) => {
          if (code !== 0) markEnded();
          else void closePane(pane.paneId).then((closed) => closed || markEnded());
        });
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
    [client, closePane, createTerminal, focusHolder, onFolderMissing, paneArea, showToast, update],
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
  const maximize = useCallback(
    (paneId: string) => {
      const entry = entries.current.find((e) => e.pane.paneId === paneId);
      if (!entry) return;
      setLayout((l) => ({ ...l, maximizedId: paneId }));
      // A click on a header button need not focus it, so the keyboard could stay in a pane that is now covered.
      focusHolder(entry);
    },
    [focusHolder],
  );
  const pendingJump = useRef<string | null>(null);
  const restore = useCallback((jumpToPaneId?: string) => {
    pendingJump.current = jumpToPaneId ?? null;
    setLayout((l) => (l.maximizedId === null ? l : { ...l, maximizedId: null }));
  }, []);
  // A covered pane is inert, and focusing inside an inert subtree does nothing, so the jump waits for the commit.
  useEffect(() => {
    if (layout.maximizedId !== null || pendingJump.current === null) return;
    const paneId = pendingJump.current;
    pendingJump.current = null;
    jumpTo(paneId);
  }, [layout.maximizedId, jumpTo]);
  const resizeSplit = useCallback(
    (path: SplitPath, ratio: number) =>
      setLayout((l) => (l.layout ? { ...l, layout: setRatio(l.layout, path, ratio) } : l)),
    [],
  );

  const shellOpening = useRef(new Set<string>());
  const toggleShell = useCallback(
    async (paneId: string) => {
      const entry = entries.current.find((e) => e.pane.paneId === paneId);
      if (!entry) return;
      if (entry.shell) {
        update(paneId, (e) => (e.shell ? { shell: { ...e.shell, visible: !e.shell.visible } } : {}));
        return;
      }
      if (shellOpening.current.has(paneId)) return;
      shellOpening.current.add(paneId);
      const adapter = createTerminal();
      try {
        const { stream } = await client.openShell(paneId, SHELL_OPEN_SIZE.cols, SHELL_OPEN_SIZE.rows);
        // The pane closed while the shell was starting; closing it ended the shell too.
        if (!entries.current.some((e) => e.pane.paneId === paneId)) {
          stream.dispose();
          adapter.dispose();
          return;
        }
        const shell: ShellEntry = { adapter, stream, visible: true, ratio: SHELL_RATIO, activity: null };
        update(paneId, () => ({ shell, shellFailed: false }));
        // Registered after the insert so an exit already queued finds the shell.
        stream.onOutput((bytes) => adapter.write(bytes));
        stream.onExit(() => {
          stream.dispose();
          adapter.dispose();
          update(paneId, (e) => (e.shell?.stream === stream ? { shell: null } : {}));
        });
      } catch (e) {
        adapter.dispose();
        // "already_open": a second click got in before the first shell was rendered; that shell stays.
        if (e !== "already_open") update(paneId, () => ({ shellFailed: true }));
      } finally {
        shellOpening.current.delete(paneId);
      }
    },
    [client, createTerminal, update],
  );

  const resizeShell = useCallback(
    (paneId: string, ratio: number) => update(paneId, (e) => (e.shell ? { shell: { ...e.shell, ratio } } : {})),
    [update],
  );

  const dismissShellFailure = useCallback((paneId: string) => update(paneId, () => ({ shellFailed: false })), [update]);

  // SRS-FR-058: one interval asks for every hidden shell; a failed call keeps the last answer.
  const hiddenShells = layout.entries
    .filter((e) => e.shell && !e.shell.visible)
    .map((e) => e.pane.paneId)
    .join(",");
  useEffect(() => {
    if (!hiddenShells) return;
    let live = true;
    const ask = () => {
      for (const paneId of hiddenShells.split(",")) {
        client.shellActivity(paneId).then(
          (activity) => live && update(paneId, (e) => (e.shell ? { shell: { ...e.shell, activity } } : {})),
          () => {},
        );
      }
    };
    ask();
    const timer = setInterval(ask, SHELL_ACTIVITY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [client, hiddenShells, update]);

  const diagnostics = useCallback(
    () => ({
      expectedTerminals:
        entries.current.filter((e) => e.adapter !== null).length + entries.current.filter((e) => e.shell !== null).length,
      titleTimers: titleTimers.current.size,
      livePanes: entries.current.filter((e) => e.pane.started && !e.ended).length,
    }),
    [],
  );

  return {
    ...layout,
    newSession,
    resume,
    splitFrom,
    closePane,
    focusPane,
    jumpTo,
    maximize,
    restore,
    resizeSplit,
    toggleShell,
    resizeShell,
    dismissShellFailure,
    diagnostics,
  };
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
