import { Archive, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStatus, PaneStream, SessionsClient, ShellActivity, ShellStream } from "../api/sessions";
import { ICON } from "./icon";
import { ShellArea, ShellChip, ShellFailure } from "./PaneShell";
import type { MaximizedBadge } from "./statusHighlight";
import { type Mark, RoundMark, tone } from "./statusTone";

/** No --oneui-radius-* token is 16px; the terminal well sits between row (12) and group (18). */
const TERM_RADIUS = "rounded-[16px]";

const ICON_BTN_BASE =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-muted hover:text-foreground transition-colors";
const ICON_BTN = `${ICON_BTN_BASE} text-muted-foreground`;

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
  title: string;
  /** The wait for a first status is over; set once, never cleared. */
  graceOver: boolean;
  shell: ShellEntry | null;
  /** The last attempt to open the shell failed; cleared when the user dismisses it or a shell opens. */
  shellFailed: boolean;
  /** Resumed, or a prompt was sent: the session has a history to resume. */
  prompted: boolean;
  /** The Session Goal; null until a prompt sets one (SRS-FR-092). */
  goal: string | null;
};

// Like the session's, the shell's adapter outlives a hide: output keeps flowing into it (SRS-FR-057).
export type ShellEntry = {
  adapter: TerminalAdapter;
  stream: ShellStream;
  visible: boolean;
  /** Share of the pane body the shell takes. */
  ratio: number;
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
  onToggleShell(paneId: string): void;
  onResizeShell(paneId: string, ratio: number): void;
  onDismissShellFailure(paneId: string): void;
  onSetGoal(paneId: string, text: string): void;
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
  onToggleShell,
  onResizeShell,
  onDismissShellFailure,
  onSetGoal,
}: Props) {
  const { pane, workspaceName, adapter, openedSize, ended, status, title, graceOver, shell, shellFailed, goal } = entry;
  const paneId = pane.paneId;
  const body = useRef<HTMLDivElement>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;
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

  // The session body changes size with the shell area; fit on the commit rather than waiting for the observer.
  const shellLayout = shell === null ? "none" : shell.visible ? `shown ${shell.ratio}` : "hidden";
  const lastShellLayout = useRef(shellLayout);
  useEffect(() => {
    if (lastShellLayout.current === shellLayout) return;
    lastShellLayout.current = shellLayout;
    refit.current?.();
  }, [shellLayout]);

  // After an abnormal exit the header keeps the Error chip, matching the session row.
  const endedBadge = ended && !(status.tracked && status.state === "Error");
  const badge = !pane.started
    ? "Not started"
    : endedBadge
      ? "Ended"
      : !status.tracked && graceOver
        ? "Status unavailable"
        : null;
  const quiet =
    !pane.started || endedBadge || !status.tracked || status.state === "Idle" || status.state === "Ended";
  const mark: Mark =
    badge === "Status unavailable" ? { kind: "unavailable" } : quiet ? { kind: "history" } : { kind: "state", state: status.state };
  const border = quiet ? "border-border" : tone[status.state].ring;
  const attention = !quiet && (status.state === "Needs Approval" || status.state === "Error");
  // On an overlay: an inset shadow on the section itself is hidden under its opaque children.
  const glow =
    !quiet && status.state === "Needs Approval"
      ? "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:shadow-approval-glow"
      : "";
  const dim = focused || maximized || attention ? "" : "opacity-pane-dim";
  // A box-shadow outside the status border, so focus never hides the state colour (SRS-FR-087).
  const outline = focused ? "ring-2 ring-ring ring-offset-1 ring-offset-canvas" : "";
  const toggleMaximized = () => (maximized ? onRestore() : onMaximize(paneId));
  const headerPressed = useRef(false);

  return (
    <section
      aria-label={`${workspaceName} · ${title}`}
      onFocus={() => onFocus(paneId)}
      className={`relative flex flex-col min-h-0 min-w-0 rounded-card border ${border} ${attention ? "border-2" : ""} ${glow} ${outline} ${dim} bg-surface overflow-hidden transition-opacity`}
    >
      <header
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
        className="flex h-11 shrink-0 items-center justify-between gap-2 pl-3 pr-2 font-sans select-none"
      >
        <span className="flex min-w-0 items-center gap-2">
          <RoundMark mark={mark} small />
          <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
            <span className="font-normal text-muted-foreground">{workspaceName} ·</span> {title}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[11px] whitespace-nowrap">
          {othersBadge && (
            <button
              aria-label={`${othersBadge.count} ${othersBadge.count === 1 ? "session needs" : "sessions need"} you`}
              onClick={() => onBadge(othersBadge.paneId)}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border pl-0.5 pr-3 font-medium ${tone[othersBadge.state].chip}`}
            >
              <RoundMark mark={{ kind: "state", state: othersBadge.state }} small />
              {othersBadge.count} need you
            </button>
          )}
          {badge ? (
            <span className="min-w-0 shrink-[10] truncate border border-border rounded-full px-2 text-muted-foreground">
              {badge}
            </span>
          ) : (
            <span className={`min-w-0 shrink-[10] truncate border rounded-full px-2 ${tone[status.state].chip}`}>
              {status.state}
            </span>
          )}
          <ShellChip shell={shell} onToggle={() => onToggleShell(paneId)} />
          <button
            aria-label="Stash session"
            title="Stash session"
            disabled={!canStash}
            onClick={() => onStash(paneId)}
            className={`${ICON_BTN} disabled:opacity-40 disabled:hover:bg-transparent`}
          >
            <Archive {...ICON} />
          </button>
          <button
            aria-label={maximized ? "Restore pane" : "Maximize pane"}
            title={maximized ? "Restore pane" : "Maximize pane"}
            onClick={toggleMaximized}
            className={ICON_BTN}
          >
            {maximized ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}
          </button>
          <button
            aria-label="Close pane"
            title="Close pane"
            onClick={() => onClose(paneId)}
            className={ICON_BTN}
          >
            <X {...ICON} />
          </button>
        </span>
      </header>
      <TargetBox goal={goal} onSave={(text) => onSetGoal(paneId, text)} />
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {pane.started ? (
          // FitAddon sizes from the parent of the terminal and ignores that parent's padding,
          // so the padding sits on a wrapper and xterm gets an unpadded container.
          <div className={`flex-1 min-h-0 min-w-0 flex mx-2 mb-2 ${TERM_RADIUS} bg-term p-2`}>
            <div ref={body} data-pane-body={paneId} className="flex-1 min-h-0 min-w-0" />
          </div>
        ) : (
          <div className={`flex-1 mx-2 mb-2 ${TERM_RADIUS} bg-term p-3 font-mono text-xs leading-5 text-foreground`}>
            <div>Claude Code could not be started</div>
            <div className="mt-5">Check that Claude Code is installed and on your PATH.</div>
          </div>
        )}
        {ended && (
          <div className="mx-2 mb-2 rounded-row bg-muted px-3 py-1.5 text-xs text-muted-foreground">Session ended</div>
        )}
        {shell && (
          <ShellArea
            paneId={paneId}
            shell={shell}
            client={client}
            maximized={maximized}
            textSize={textSize}
            onResize={(ratio) => onResizeShell(paneId, ratio)}
          />
        )}
      </div>
      {shellFailed && <ShellFailure onDismiss={() => onDismissShellFailure(paneId)} />}
    </section>
  );
}

// Outside the header, which owns double-click and drag (SRS-FR-092).
function TargetBox({ goal, onSave }: { goal: string | null; onSave(text: string): void }) {
  const [draft, setDraft] = useState(goal ?? "");
  const box = useRef<HTMLTextAreaElement>(null);
  // Only a typed change is saved, so a goal that arrives while the box is focused is not overwritten.
  const edited = useRef(false);

  useEffect(() => {
    if (document.activeElement !== box.current) setDraft(goal ?? "");
  }, [goal]);

  // Grows with its text, border included; the max-height class caps it at 3 lines, then it scrolls.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [draft]);

  return (
    <textarea
      ref={box}
      aria-label="Session target"
      placeholder="Target — filled from your first prompt"
      rows={1}
      value={draft}
      onChange={(e) => {
        edited.current = true;
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || e.nativeEvent.isComposing) return;
        edited.current = false;
        setDraft(goal ?? "");
        e.currentTarget.blur();
      }}
      onBlur={() => {
        if (!edited.current) return setDraft(goal ?? "");
        edited.current = false;
        const text = draft.trim();
        if (text !== (goal ?? "")) onSave(text);
        setDraft(text);
      }}
      className="block w-full resize-none max-h-[calc(4.25rem+1px)] overflow-y-auto px-3 py-1 border-b border-border bg-card font-mono text-xs leading-5 text-goal placeholder:text-goal/50 outline-none"
    />
  );
}

function onButton(target: EventTarget) {
  return target instanceof Element && target.closest("button") !== null;
}
