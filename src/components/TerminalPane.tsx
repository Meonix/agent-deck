import { useEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStatus, PaneStream, SessionsClient, ShellActivity, ShellStream } from "../api/sessions";
import { ShellArea, ShellChip, ShellFailure } from "./PaneShell";
import type { MaximizedBadge } from "./statusHighlight";
import { StateMarker, tone } from "./statusTone";

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
  const border = quiet ? "border-border" : tone[status.state].ring;
  // A box-shadow outside the status border, so focus never hides the state colour (SRS-FR-087).
  const outline = focused ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "";
  const toggleMaximized = () => (maximized ? onRestore() : onMaximize(paneId));
  const headerPressed = useRef(false);

  return (
    <section
      aria-label={`${workspaceName} · ${title}`}
      onFocus={() => onFocus(paneId)}
      className={`flex flex-col min-h-0 min-w-0 rounded-lg border ${border} ${!quiet && status.state === "Needs Approval" ? "border-2" : ""} ${outline} bg-background overflow-hidden`}
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
        className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card select-none"
      >
        <span className="min-w-0 text-xs text-foreground truncate">
          <span className="text-muted-foreground">{workspaceName} ·</span> {title}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs whitespace-nowrap">
          {othersBadge && (
            <button
              aria-label={`${othersBadge.count} ${othersBadge.count === 1 ? "session needs" : "sessions need"} you`}
              onClick={() => onBadge(othersBadge.paneId)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 font-medium ${tone[othersBadge.state].chip}`}
            >
              <StateMarker state={othersBadge.state} />
              {othersBadge.count} need you
            </button>
          )}
          {badge ? (
            <span className="min-w-0 shrink-[10] truncate border border-border rounded-md px-1.5 text-muted-foreground">
              {badge}
            </span>
          ) : (
            <span className={`min-w-0 shrink-[10] truncate border rounded-md px-1.5 ${tone[status.state].chip}`}>
              <span className="mr-1 align-middle">
                <StateMarker state={status.state} />
              </span>
              {status.state}
            </span>
          )}
          <ShellChip shell={shell} onToggle={() => onToggleShell(paneId)} />
          <button
            aria-label={maximized ? "Restore pane" : "Maximize pane"}
            title={maximized ? "Restore pane" : "Maximize pane"}
            onClick={toggleMaximized}
            className="shrink-0 text-muted-foreground"
          >
            {maximized ? "⤡" : "⤢"}
          </button>
          <button
            aria-label="Close pane"
            title="Close pane"
            onClick={() => onClose(paneId)}
            className="shrink-0 text-muted-foreground"
          >
            ✕
          </button>
        </span>
      </header>
      {goal && <GoalLine goal={goal} onSave={(text) => onSetGoal(paneId, text)} />}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {pane.started ? (
          // FitAddon sizes from the parent of the terminal and ignores that parent's padding,
          // so the padding sits on a wrapper and xterm gets an unpadded container.
          <div className="flex-1 min-h-0 min-w-0 flex p-1">
            <div ref={body} data-pane-body={paneId} className="flex-1 min-h-0 min-w-0" />
          </div>
        ) : (
          <div className="flex-1 p-3 font-mono text-xs leading-5 text-foreground">
            <div>Claude Code could not be started</div>
            <div className="mt-5">Check that Claude Code is installed and on your PATH.</div>
          </div>
        )}
        {ended && (
          <div className="border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">Session ended</div>
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

const GOAL_SHOWN = 80;

// Outside the header, which owns double-click and drag, so the row needs no handling of its own (SRS-FR-092).
function GoalLine({ goal, onSave }: { goal: string; onSave(text: string): void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal);
  const chars = [...goal];
  const shown = chars.length > GOAL_SHOWN ? `${chars.slice(0, GOAL_SHOWN - 1).join("")}…` : goal;

  return (
    <div
      role="group"
      aria-label="Session goal"
      className="flex items-center gap-2 px-3 py-1 border-b border-border text-xs text-muted-foreground"
    >
      <span aria-hidden="true">📌</span>
      {editing ? (
        <input
          autoFocus
          aria-label="Goal text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              const text = draft.trim();
              if (text === "") return;
              onSave(text);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 bg-background text-foreground border border-border rounded px-1"
        />
      ) : (
        <>
          <span title={goal} className="min-w-0 flex-1 truncate">
            {shown}
          </span>
          <button
            aria-label="Edit goal"
            title="Edit goal"
            onClick={() => {
              setDraft(goal);
              setEditing(true);
            }}
            className="shrink-0"
          >
            ✎
          </button>
        </>
      )}
    </div>
  );
}

function onButton(target: EventTarget) {
  return target instanceof Element && target.closest("button") !== null;
}
