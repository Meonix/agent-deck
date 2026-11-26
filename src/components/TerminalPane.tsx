import { Archive, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStatus, PaneStream, SessionsClient, ShellActivity, ShellStream } from "../api/sessions";
import { labels } from "../labels";
import type { Activity, ChatState } from "./chatState";
import { ActivityBar } from "./ActivityBar";
import { ChatView } from "./ChatView";
import { ICON } from "./icon";
import { mayTakeFocus } from "./paneFocus";
import { ShellArea, ShellFailure } from "./PaneShell";
import { type MaximizedBadge, needsUser } from "./statusHighlight";
import { type Mark, RoundMark, tone } from "./statusTone";
import { ViewLayer } from "./ViewLayer";
import { type PaneView, ViewSwitch } from "./ViewSwitch";

const ICON_BTN_BASE =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-muted hover:text-foreground transition-colors";
const ICON_BTN = `${ICON_BTN_BASE} text-muted-foreground`;
// Below this header width the full View Switch would push Phóng to and × out of a pane at the grid's minimum.
const COMPACT_HEADER_PX = 360;

export type TerminalSize = { cols: number; rows: number };

export interface TerminalAdapter {
  open(container: HTMLElement): void;
  write(bytes: Uint8Array): void;
  /** Typed and composed (IME) text. Returns a function that removes the listener. */
  onData(cb: (data: string) => void): () => void;
  /** Input that is not text, such as some mouse reports. Returns a function that removes the listener. */
  onBinary(cb: (data: string) => void): () => void;
  focus(): void;
  fit(): TerminalSize;
  dispose(): void;
}

export type TerminalAdapterFactory = () => TerminalAdapter;

// The adapter and stream belong to the entry, not to a mount: output keeps
// flowing into the terminal even while React remounts the pane.
export type PaneEntry = {
  pane: OpenedPane;
  workspaceId: string;
  workspaceName: string;
  openedAt: number;
  adapter: TerminalAdapter | null;
  stream: PaneStream;
  openedSize: TerminalSize;
  ended: boolean;
  status: PaneStatus;
  chat: ChatState;
  /** Last activity snapshot; null until the first one. */
  activity: Activity | null;
  title: string;
  /** The wait for a first status is over; set once, never cleared. */
  graceOver: boolean;
  shell: ShellEntry | null;
  /** The last attempt to open the shell failed; cleared when the user dismisses it or a shell opens. */
  shellFailed: boolean;
  /** Resumed, or a prompt was sent: the session has a history to resume. */
  prompted: boolean;
  /** Per pane and never saved: reopened panes show Term. */
  view: PaneView;
  /** Where the pane goes back to when its shell exits (SRS-FR-061). */
  returnView: PaneView;
};

// Like the session's, the shell's adapter outlives a hide: output keeps flowing into it (SRS-FR-057).
export type ShellEntry = {
  adapter: TerminalAdapter;
  stream: ShellStream;
  /** Last answer of the activity poll; null until the first one. */
  activity: ShellActivity | null;
};

export const UNTITLED = "(untitled)";

type Props = {
  entry: PaneEntry;
  client: SessionsClient;
  focused: boolean;
  maximized: boolean;
  textSize: number;
  /** Other sessions that need the user, shown while this pane is maximized (SRS-FR-044). */
  othersBadge: MaximizedBadge | null;
  onBadge(target: string): void;
  onFocus(paneId: string): void;
  onMaximize(paneId: string): void;
  onRestore(): void;
  /** False while the session has nothing on disk to reopen (SRS-FR-103). */
  canStash: boolean;
  onStash(paneId: string): void;
  onClose(paneId: string): void;
  onChooseView(paneId: string, view: PaneView): void;
  onDismissShellFailure(paneId: string): void;
};

export function TerminalPane({
  entry,
  client,
  focused,
  maximized,
  textSize,
  othersBadge,
  onBadge,
  onFocus,
  onMaximize,
  onRestore,
  canStash,
  onStash,
  onClose,
  onChooseView,
  onDismissShellFailure,
}: Props) {
  const { pane, workspaceName, adapter, openedSize, ended, status, title, graceOver, shell, shellFailed, view, chat, activity } = entry;
  const paneId = pane.paneId;
  const body = useRef<HTMLDivElement>(null);
  const chatBox = useRef<HTMLDivElement>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;
  const header = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const lastSize = useRef(openedSize);
  const refit = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = body.current;
    if (!adapter || !container) return;
    adapter.open(container);
    adapter.focus();

    // Write and resize failures mean the session is gone; the pane shows that on exit.
    const fit = () => {
      const size = adapter.fit();
      if (size.cols === lastSize.current.cols && size.rows === lastSize.current.rows) return;
      lastSize.current = size;
      if (!endedRef.current) client.resize(paneId, size.cols, size.rows).catch(() => {});
    };
    fit();
    refit.current = fit;
    const send = (data: string) => {
      if (!endedRef.current) client.write(paneId, data).catch(() => {});
    };
    const stopData = adapter.onData(send);
    const stopBinary = adapter.onBinary(send);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(container);
    return () => {
      refit.current = null;
      stopData();
      stopBinary();
      observer?.disconnect();
    };
  }, [adapter, client, paneId]);

  useEffect(() => {
    const bar = header.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    // A width of 0 means not laid out yet, not narrow.
    const measure = () => {
      const { width } = bar.getBoundingClientRect();
      setCompact(width > 0 && width < COMPACT_HEADER_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // SRS-FR-043: fit as soon as the maximized class is committed rather than waiting for the observer.
  const wasMaximized = useRef(maximized);
  useEffect(() => {
    if (wasMaximized.current === maximized) return;
    wasMaximized.current = maximized;
    refit.current?.();
  }, [maximized]);

  // SRS-FR-072: the zoom has landed when the size arrives, and the same pane holds more or fewer cells.
  const lastTextSize = useRef(textSize);
  useEffect(() => {
    if (lastTextSize.current === textSize) return;
    lastTextSize.current = textSize;
    refit.current?.();
  }, [textSize]);

  // Showing Term refits it, as it may have missed an observation while hidden, and gives it the keyboard;
  // showing Chat gives the keyboard to its log. After the commit, as a hidden element cannot take focus.
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (view === "chat") {
      if (mayTakeFocus(chatBox.current)) chatBox.current?.focus();
      return;
    }
    if (view !== "term") return;
    refit.current?.();
    if (mayTakeFocus(body.current)) adapter?.focus();
  }, [adapter, view]);

  // After an abnormal exit the header keeps the Error chip, matching the session row.
  const endedBadge = ended && !(status.tracked && status.state === "Error");
  const badge = !pane.started
    ? labels.notStarted
    : endedBadge
      ? labels.state.Ended
      : !status.tracked && graceOver
        ? labels.statusUnavailable
        : null;
  const mark: Mark =
    badge === labels.statusUnavailable
      ? { kind: "unavailable" }
      : !pane.started || !status.tracked
        ? { kind: "history" }
        : { kind: "state", state: endedBadge ? "Ended" : status.state };
  const attention = pane.started && !endedBadge && status.tracked && needsUser(status.state);
  const frame = !attention ? "" : status.state === "Error" ? "pane-err" : "pane-app";
  const dim = focused || maximized || attention ? "" : "opacity-pane-dim";
  const outline = focused ? "pane-focus" : "";
  const chip = needsUser(status.state);
  const toggleMaximized = () => (maximized ? onRestore() : onMaximize(paneId));
  const headerPressed = useRef(false);

  return (
    <section
      data-pane={paneId}
      aria-label={`${workspaceName} · ${labels.title(title)}`}
      onFocus={() => onFocus(paneId)}
      className={`pane-frame ${frame} ${outline} ${dim} relative flex flex-col min-h-0 min-w-0 bg-background overflow-hidden transition-opacity`}
    >
      <header
        ref={header}
        data-drag-handle
        // dblclick lands on whatever is under the second press, which the first click may have moved there,
        // so both presses must hit this header outside its buttons (SRS-FR-066).
        onMouseDown={(e) => {
          if (e.detail === 1) headerPressed.current = !onButton(e.target);
        }}
        onMouseLeave={() => (headerPressed.current = false)}
        onDoubleClick={(e) => {
          if (headerPressed.current && !onButton(e.target)) toggleMaximized();
        }}
        className="bar flex h-10 shrink-0 items-center gap-2 pl-3 pr-2 font-sans select-none"
      >
        <RoundMark mark={mark} small />
        {/* Basis 0: the title takes only the room the controls leave, so it gives way first. */}
        <span className="flex-1 basis-0 min-w-0 truncate text-[13px] font-medium text-foreground">
          <span className="font-normal text-muted-foreground">{workspaceName} ·</span> {labels.title(title)}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[11px] whitespace-nowrap">
          {othersBadge && (
            <button
              aria-label={labels.othersBadge(othersBadge.count)}
              onClick={() => onBadge(othersBadge.paneId)}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-2 pr-3 font-medium ${othersBadge.state === "Error" ? "chip-err" : "chip-app"}`}
            >
              <RoundMark mark={{ kind: "state", state: othersBadge.state }} small />
              {labels.othersBadgeText(othersBadge.count)}
            </button>
          )}
          {badge ? (
            <span className="chip chip-idle min-w-0 shrink-[10] truncate">{badge}</span>
          ) : (
            <span className={`min-w-0 shrink-[10] truncate ${chip ? tone[status.state].chip : `font-medium ${tone[status.state].word}`}`}>
              {labels.state[status.state]}
            </span>
          )}
          <ViewSwitch
            view={view}
            shellCommand={shell && view !== "shell" && shell.activity?.busy ? shell.activity.command : null}
            compact={compact}
            onChoose={(v) => onChooseView(paneId, v)}
          />
          <button
            aria-label={labels.stashSession}
            title={labels.stashSession}
            disabled={!canStash}
            onClick={() => onStash(paneId)}
            className={`${ICON_BTN} disabled:opacity-40 disabled:hover:bg-transparent`}
          >
            <Archive {...ICON} />
          </button>
          <button
            aria-label={maximized ? labels.restorePane : labels.maximizePane}
            title={maximized ? labels.restorePane : labels.maximizePane}
            onClick={toggleMaximized}
            className={ICON_BTN}
          >
            {maximized ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}
          </button>
          <button
            aria-label={labels.closePane}
            title={labels.closePane}
            onClick={() => onClose(paneId)}
            className={ICON_BTN}
          >
            <X {...ICON} />
          </button>
        </span>
      </header>
      {/* Every view stays laid out while hidden, so each terminal keeps its size and output (SRS-FR-148),
          and Chat its scroll and open cards. */}
      <div className="relative flex-1 min-h-0 min-w-0">
        <ViewLayer view="chat" shown={view === "chat"} className="flex flex-col bg-background">
          <ChatView chat={chat} paneId={paneId} boxRef={chatBox} started={pane.started} />
          <ActivityBar state={ended ? "Ended" : status.state} activity={activity} />
        </ViewLayer>
        <ViewLayer view="term" shown={view === "term"} className="flex flex-col">
          {pane.started ? (
            // FitAddon sizes from the parent of the terminal and ignores that parent's padding,
            // so the padding sits on a wrapper and xterm gets an unpadded container.
            <div className="flex-1 min-h-0 min-w-0 flex bg-background p-2">
              <div ref={body} data-pane-body={paneId} className="flex-1 min-h-0 min-w-0" />
            </div>
          ) : (
            <div className="flex-1 bg-background p-3 font-mono text-xs leading-5 text-foreground">
              <div>{labels.startFailed}</div>
              <div className="mt-5">{labels.startFailedHint}</div>
            </div>
          )}
          {ended && (
            <div className="border-t border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">{labels.sessionEnded}</div>
          )}
        </ViewLayer>
        {shell && (
          <ShellArea paneId={paneId} shell={shell} client={client} shown={view === "shell"} maximized={maximized} textSize={textSize} />
        )}
      </div>
      {shellFailed && <ShellFailure onDismiss={() => onDismissShellFailure(paneId)} />}
    </section>
  );
}

function onButton(target: EventTarget) {
  return target instanceof Element && target.closest("button") !== null;
}
