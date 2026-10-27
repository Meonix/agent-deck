import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LatencyReport, SessionsClient } from "../api/sessions";
import { formatShare } from "./latencyReport";
import { ICON } from "./icon";

type Props = { client: SessionsClient; onClose(): void };

export function StatusLatencyReport({ client, onClose }: Props) {
  const [report, setReport] = useState<LatencyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLElement>(null);
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
    // Capture phase on the document, and focus held on the close button (the only control),
    // so no key — Escape, or an Enter or digit that would answer a permission prompt —
    // reaches a terminal behind the overlay.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") onClose();
    };
    const onFocus = (e: FocusEvent) => {
      if (!dialog.current?.contains(e.target as Node)) close.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-10 bg-black/50 flex items-start justify-center p-8">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-latency-title"
        className="w-full max-w-xl rounded-lg border border-border bg-card p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h1 id="status-latency-title" className="text-lg font-semibold text-foreground">
            Status Latency
          </h1>
          <span className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">Last 14 days</span>
            <button ref={close} aria-label="Close report" onClick={onClose} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X {...ICON} />
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
