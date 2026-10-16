import { useEffect, useRef, useState } from "react";
import type { LatencyReport, SessionsClient } from "../api/sessions";
import { formatShare } from "./latencyReport";

type Props = { client: SessionsClient; onClose(): void };

export function StatusLatencyReport({ client, onClose }: Props) {
  const [report, setReport] = useState<LatencyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    client.latencyReport().then(
      (r) => live && setReport(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => {
    close.current?.focus();
    // Capture phase, so the Escape that closes the report never reaches a terminal behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-10 bg-black/50 flex items-start justify-center p-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-latency-title"
        className="w-full max-w-xl rounded-lg border border-border bg-card p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h1 id="status-latency-title" className="text-lg font-medium text-foreground">
            Status Latency
          </h1>
          <span className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Last 14 days</span>
            <button ref={close} aria-label="Close report" onClick={onClose} className="text-xs text-muted-foreground">
              ✕
            </button>
          </span>
        </div>
        {failed ? (
          <div className="text-sm text-muted-foreground">The report could not be loaded.</div>
        ) : report === null ? null : report.total === 0 ? (
          <div className="text-sm text-muted-foreground">No data yet</div>
        ) : (
          <div>
            <div className="text-4xl font-semibold text-running-foreground">{formatShare(report.within, report.total)}</div>
            <div className="text-sm text-muted-foreground">
              {report.within} of {report.total} state changes appeared within 3 s
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
