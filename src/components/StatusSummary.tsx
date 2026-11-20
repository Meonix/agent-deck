import { ArrowRight, Gauge } from "lucide-react";
import { ICON, ICON_SM } from "./icon";
import type { HighlightState, StatusSummary as Summary } from "./statusHighlight";
import { RoundMark } from "./statusTone";
import type { SummaryMode } from "./useSummaryMode";

type Props = {
  summary: Summary;
  mode: Exclude<SummaryMode, "hidden">;
  onGoTo(paneId: string): void;
  onOpenLatency(): void;
};

function headlineText({ headline, need }: Summary): string {
  if (headline === "need") return `${need} need you`;
  return headline === "clear" ? "All clear" : "Agent Deck · No sessions running";
}

/** SRS-FR-133: only the states with sessions get a chip. */
function chips({ approval, error, running }: Summary) {
  const all: { count: number; label: string; state: HighlightState }[] = [
    { count: approval, label: "need approval", state: "Needs Approval" },
    { count: error, label: "error", state: "Error" },
    { count: running, label: "running", state: "Running" },
  ];
  return all.filter((c) => c.count > 0);
}

export function StatusSummary({ summary, mode, onGoTo, onOpenLatency }: Props) {
  const expanded = mode === "expanded";
  return (
    <section
      aria-label="Status Summary"
      data-mode={mode}
      className={`relative flex shrink-0 items-center px-4 ${expanded ? "h-[152px] flex-col justify-center gap-4" : "h-12 gap-3"}`}
    >
      <div className={`flex items-center ${expanded ? "flex-col gap-4" : "min-w-0 flex-1 gap-3"}`}>
        <h1 className={`${expanded ? "text-[40px] leading-none font-light" : "truncate text-[17px] font-normal"} font-sans text-foreground`}>
          {headlineText(summary)}
        </h1>
        <ul className="flex items-center gap-2">
          {chips(summary).map(({ count, label, state }) => (
            <li
              key={label}
              className={`inline-flex items-center gap-2 rounded-full bg-surface text-foreground ${expanded ? "h-9 pl-1.5 pr-3.5 text-[13px]" : "h-7 pl-0.5 pr-2.5 text-xs"}`}
            >
              <RoundMark mark={{ kind: "state", state }} small />
              <span>{`${count} ${label}`}</span>
            </li>
          ))}
        </ul>
      </div>
      {summary.goTo && (
        <button
          onClick={() => onGoTo(summary.goTo!.paneId)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Go to {summary.goTo.title}
          <ArrowRight {...ICON} />
        </button>
      )}
      <LatencyButton onOpen={onOpenLatency} className={expanded ? "absolute right-4 top-3" : ""} />
    </section>
  );
}

function LatencyButton({ onOpen, className }: { onOpen(): void; className: string }) {
  return (
    <button
      onClick={onOpen}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <Gauge {...ICON_SM} />
      Status Latency
    </button>
  );
}

/** SRS-FR-039: while a pane is maximized the summary is hidden (SRS-FR-139), but the report stays reachable; h-9 matches PaneGrid's top-9. */
export function LatencyBar({ onOpenLatency }: { onOpenLatency(): void }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-end px-4">
      <LatencyButton onOpen={onOpenLatency} className="" />
    </div>
  );
}
