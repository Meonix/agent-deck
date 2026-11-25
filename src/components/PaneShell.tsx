import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { labels } from "../labels";
import { ICON_SM } from "./icon";
import { mayTakeFocus } from "./paneFocus";
import { ViewLayer } from "./ViewLayer";
import type { SessionsClient } from "../api/sessions";
import type { ShellEntry, TerminalSize } from "./TerminalPane";

/** What a shell starts at; the Shell view fits it right after mounting and resizes the shell to match. */
export const SHELL_OPEN_SIZE: TerminalSize = { cols: 80, rows: 24 };

type ViewProps = {
  paneId: string;
  shell: ShellEntry;
  client: SessionsClient;
  shown: boolean;
  maximized: boolean;
  textSize: number;
};

/** The Shell view: the Pane Shell over the whole pane body (SRS-FR-055). */
export function ShellArea({ paneId, shell, client, shown, maximized, textSize }: ViewProps) {
  const { adapter } = shell;
  const box = useRef<HTMLDivElement>(null);
  const refit = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = box.current;
    if (!container) return;
    adapter.open(container);
    // A slow start may finish after the user went on to another pane.
    if (mayTakeFocus(container)) adapter.focus();
    let lastSize = SHELL_OPEN_SIZE;
    // Write and resize failures mean the shell is gone; its exit closes the view.
    // A hidden layer keeps its size, so the shell follows the pane while hidden too (SRS-FR-148).
    const fit = () => {
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
  }, [maximized, textSize]);

  // Showing gives the shell the keyboard; after the commit, as a hidden element cannot take focus.
  const wasShown = useRef(shown);
  useEffect(() => {
    if (shown && !wasShown.current) {
      refit.current?.();
      if (mayTakeFocus(box.current)) adapter.focus();
    }
    wasShown.current = shown;
  }, [adapter, shown]);

  return (
    // Padding on a wrapper, as for the session: FitAddon ignores the padding of the terminal's parent.
    <ViewLayer view="shell" shown={shown} className="flex bg-background p-2">
      <div ref={box} className="flex-1 min-h-0 min-w-0" />
    </ViewLayer>
  );
}

export function ShellFailure({ onDismiss }: { onDismiss(): void }) {
  return (
    <div className="mx-2 mb-2 flex items-center justify-between callout-err px-3 py-1.5 text-xs">
      <span>{labels.shellFailed}</span>
      <button aria-label={labels.dismiss} title={labels.dismiss} onClick={onDismiss} className="rounded-sm p-0.5 hover:bg-error-border/40">
        <X {...ICON_SM} />
      </button>
    </div>
  );
}
