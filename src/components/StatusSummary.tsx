import { ArrowRight, Gauge, Hand, Play, TriangleAlert, type LucideIcon } from "lucide-react";
import { ICON, ICON_SM } from "./icon";
import type { StatusSummary as Summary } from "./statusHighlight";
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
  const all: { count: number; label: string; Icon: LucideIcon; mark: string; chip: string }[] = [
    { count: approval, label: "need approval", Icon: Hand, mark: "bg-approval", chip: "bg-approval-bg text-approval-foreground border-approval-border" },
    { count: error, label: "error", Icon: TriangleAlert, mark: "bg-error", chip: "bg-error-bg text-error-foreground border-error-border" },
    { count: running, label: "running", Icon: Play, mark: "bg-running", chip: "bg-running-bg text-running-foreground border-running-border" },
  ];
  return all.filter((c) => c.count > 0);
}

export function StatusSummary({ summary, mode, onGoTo, onOpenLatency }: Props) {
  const expanded = mode === "expanded";
  const mark = expanded ? "size-6" : "size-4";
  return (
    <section
      aria-label="Status Summary"
      data-mode={mode}
      className={`relative flex shrink-0 items-center border-b border-border bg-card px-4 ${expanded ? "h-[152px] flex-col justify-center gap-4" : "h-12 gap-3"}`}
    >
      <div className={`flex items-center ${expanded ? "flex-col gap-4" : "min-w-0 flex-1 gap-3"}`}>
        <h1 className={`${expanded ? "text-[40px] leading-none font-light" : "truncate text-[17px] font-normal"} font-sans text-foreground`}>
          {headlineText(summary)}
        </h1>
        <ul className="flex items-center gap-2">
          {chips(summary).map(({ count, label, Icon, mark: markColor, chip }) => (
            <li
              key={label}
              className={`inline-flex items-center gap-2 rounded-full border text-sm ${expanded ? "py-1 pl-1 pr-3" : "py-0.5 pl-0.5 pr-2 text-xs"} ${chip}`}
            >
              <span className={`inline-flex ${mark} items-center justify-center rounded-full text-black ${markColor}`}>
                <Icon {...(expanded ? ICON : ICON_SM)} color="#000" />
              </span>
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
      className={`inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground bg-muted border border-border rounded-md px-2 py-0.5 hover:text-foreground hover:border-muted-foreground transition-colors ${className}`}
    >
      <Gauge {...ICON_SM} />
      Status Latency
    </button>
  );
}

/** SRS-FR-039: while a pane is maximized the summary is hidden (SRS-FR-139), but the report stays reachable; h-9 matches PaneGrid's top-9. */
export function LatencyBar({ onOpenLatency }: { onOpenLatency(): void }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-end border-b border-border bg-card px-4">
      <LatencyButton onOpen={onOpenLatency} className="" />
    </div>
  );
}
