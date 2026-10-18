import { type PointerEvent, useEffect, useRef } from "react";
import type { SessionsClient } from "../api/sessions";
import type { ShellEntry, TerminalSize } from "./TerminalPane";

/** What a shell starts at; the area fits it right after mounting and resizes the shell to match. */
export const SHELL_OPEN_SIZE: TerminalSize = { cols: 80, rows: 24 };
const MIN_HEIGHT = 80;

const CHIP = "inline-flex min-w-0 max-w-[150px] items-center gap-1 rounded-md border px-1.5 text-[11px]";

export function ShellChip({ shell, onToggle }: { shell: ShellEntry | null; onToggle(): void }) {
  const label = shell === null ? "Open shell" : shell.visible ? "Hide shell" : "Show shell";
  if (shell && !shell.visible) {
    const command = shell.activity?.busy ? shell.activity.command : null;
    return (
      <button
        aria-label={label}
        title={label}
        onClick={onToggle}
        className={`${CHIP} border-primary text-accent-foreground`}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
        <span className={command ? "font-mono truncate" : "truncate"}>{command ?? "Shell"}</span>
      </button>
    );
  }
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`${CHIP} ${shell ? "border-ring bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
    >
      <span className="font-mono">&gt;_</span>Shell
    </button>
  );
}

type AreaProps = {
  paneId: string;
  shell: ShellEntry;
  client: SessionsClient;
  maximized: boolean;
  textSize: number;
  onResize(ratio: number): void;
};

export function ShellArea({ paneId, shell, client, maximized, textSize, onResize }: AreaProps) {
  const { adapter, visible, ratio } = shell;
  const area = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const refit = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = box.current;
    if (!container) return;
    adapter.open(container);
    adapter.focus();
    let lastSize = SHELL_OPEN_SIZE;
    // Write and resize failures mean the shell is gone; its exit closes the area.
    // A hidden terminal has no size to fit to; it fits again when shown.
    const fit = () => {
      if (!visibleRef.current) return;
      const size = adapter.fit();
      if (size.cols === lastSize.cols && size.rows === lastSize.rows) return;
      lastSize = size;
      client.shellResize(paneId, size.cols, size.rows).catch(() => {});
    };
    fit();
    refit.current = fit;
    const send = (data: string) => void client.shellWrite(paneId, data).catch(() => {});
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

  // Fit on the commit rather than waiting for the observer, as the session does on maximize.
  useEffect(() => {
    refit.current?.();
  }, [visible, ratio, maximized, textSize]);

  // Showing gives the shell the keyboard, as opening does; after the commit, as a hidden element cannot take focus.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current) adapter.focus();
    wasVisible.current = visible;
  }, [adapter, visible]);

  const dragging = useRef(false);
  const move = (e: PointerEvent) => {
    const body = area.current?.parentElement;
    if (!dragging.current || !body) return;
    const { bottom, height } = body.getBoundingClientRect();
    // Both parts cannot fit: keep the ratio rather than jump.
    if (2 * MIN_HEIGHT > height) return;
    const min = MIN_HEIGHT / height;
    onResize(Math.max(min, Math.min(1 - min, (bottom - e.clientY) / height)));
  };

  return (
    <div
      ref={area}
      className={`${visible ? "flex" : "hidden"} shrink-0 flex-col border-t border-border bg-card`}
      style={{ height: `${ratio * 100}%` }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        className="h-1.5 -mt-1 flex justify-center cursor-row-resize touch-none select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }}
        onPointerCancel={() => (dragging.current = false)}
        onLostPointerCapture={() => (dragging.current = false)}
      >
        <span className="mt-0.5 w-8 h-1 rounded-full bg-border" />
      </div>
      {/* Padding on a wrapper, as for the session: FitAddon ignores the padding of the terminal's parent. */}
      <div className="flex-1 min-h-0 min-w-0 flex px-3 pb-2">
        <div ref={box} className="flex-1 min-h-0 min-w-0" />
      </div>
    </div>
  );
}

export function ShellFailure({ onDismiss }: { onDismiss(): void }) {
  return (
    <div className="mx-2 mb-2 flex items-center justify-between rounded-md border border-error-border bg-error-bg px-3 py-1.5 text-xs text-error-foreground">
      <span>Shell could not start</span>
      <button aria-label="Dismiss" title="Dismiss" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
