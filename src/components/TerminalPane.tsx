import { useEffect, useRef } from "react";
import type { OpenedPane, PaneStatus, PaneStream, SessionsClient } from "../api/sessions";
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
};

export const UNTITLED = "(untitled)";

type Props = {
  entry: PaneEntry;
  client: SessionsClient;
  focused: boolean;
  onFocus(paneId: string): void;
  onClose(paneId: string): void;
};

export function TerminalPane({ entry, client, focused, onFocus, onClose }: Props) {
  const { pane, workspaceName, adapter, openedSize, ended, status, title, graceOver } = entry;
  const paneId = pane.paneId;
  const body = useRef<HTMLDivElement>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;
  const lastSize = useRef(openedSize);

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
    const send = (data: string) => {
      if (!endedRef.current) client.write(paneId, data).catch(() => {});
    };
    const stopData = adapter.onData(send);
    const stopBinary = adapter.onBinary(send);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(container);
    return () => {
      stopData();
      stopBinary();
      observer?.disconnect();
    };
  }, [adapter, client, paneId]);

  // After an abnormal exit the header keeps the Error chip, matching the board card.
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
  const border = quiet ? (focused ? "border-ring" : "border-border") : tone[status.state].ring;

  return (
    <section
      aria-label={`${workspaceName} · ${title}`}
      onFocus={() => onFocus(paneId)}
      className={`flex flex-col min-h-0 min-w-0 rounded-lg border ${border} ${!quiet && status.state === "Needs Approval" ? "border-2" : ""} bg-background overflow-hidden`}
    >
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card">
        <span className="min-w-0 text-xs text-foreground truncate">
          <span className="text-muted-foreground">{workspaceName} ·</span> {title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs whitespace-nowrap">
          {badge ? (
            <span className="border border-border rounded-md px-1.5 text-muted-foreground">{badge}</span>
          ) : (
            <span className={`flex items-center gap-1 border rounded-md px-1.5 ${tone[status.state].chip}`}>
              <StateMarker state={status.state} />
              {status.state}
            </span>
          )}
          <button aria-label="Close pane" onClick={() => onClose(paneId)} className="text-muted-foreground">
            ✕
          </button>
        </span>
      </header>
      {pane.started ? (
        // FitAddon sizes from the parent of the terminal and ignores that parent's padding,
        // so the padding sits on a wrapper and xterm gets an unpadded container.
        <div className="flex-1 min-h-0 min-w-0 flex p-1">
          <div ref={body} className="flex-1 min-h-0 min-w-0" />
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
    </section>
  );
}
