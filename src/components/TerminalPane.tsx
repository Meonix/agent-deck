import { useEffect, useRef, useState } from "react";
import type { OpenedPane, PaneStream, SessionsClient } from "../api/sessions";

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
  workspaceName: string;
  adapter: TerminalAdapter | null;
  stream: PaneStream;
  openedSize: TerminalSize;
  ended: boolean;
};

export const UNTITLED = "(untitled)";
const TITLE_REFRESH_MS = 10_000;

type Props = {
  entry: PaneEntry;
  client: SessionsClient;
  focused: boolean;
  onFocus(paneId: string): void;
  onClose(paneId: string): void;
};

export function TerminalPane({ entry, client, focused, onFocus, onClose }: Props) {
  const { pane, workspaceName, adapter, openedSize, ended } = entry;
  const paneId = pane.paneId;
  const body = useRef<HTMLDivElement>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;
  const lastSize = useRef(openedSize);
  const title = useTitle(client, paneId, pane.started && !ended);

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

  const badge = !pane.started ? "Not started" : ended ? "Ended" : null;

  return (
    <section
      aria-label={`${workspaceName} · ${title}`}
      onFocus={() => onFocus(paneId)}
      className={`flex flex-col min-h-0 min-w-0 rounded-lg border ${focused ? "border-ring" : "border-border"} bg-background overflow-hidden`}
    >
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card">
        <span className="min-w-0 text-xs text-foreground truncate">
          <span className="text-muted-foreground">{workspaceName} ·</span> {title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs whitespace-nowrap">
          {badge && <span className="border border-border rounded-md px-1.5 text-muted-foreground">{badge}</span>}
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

/** Polls only while `polling`: a session that never started or has ended gets no new title. */
function useTitle(client: SessionsClient, paneId: string, polling: boolean): string {
  const [title, setTitle] = useState(UNTITLED);
  useEffect(() => {
    if (!polling) return;
    let live = true;
    // A failed lookup keeps the last title; the next tick tries again.
    const load = () =>
      client.title(paneId).then(
        (t) => live && setTitle(t),
        () => {},
      );
    void load();
    const timer = setInterval(load, TITLE_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [client, paneId, polling]);
  return title;
}
