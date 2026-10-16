import type { SessionState } from "../api/sessions";

// Class names are written out in full so Tailwind can see them.
export const tone: Record<SessionState, { dot: string; chip: string; text: string; edge: string; ring: string }> = {
  "Needs Approval": {
    dot: "bg-approval",
    chip: "bg-approval-bg text-approval-foreground border-approval-border",
    text: "text-approval-foreground",
    edge: "border-l-approval",
    ring: "border-approval",
  },
  Running: {
    dot: "bg-running",
    chip: "bg-running-bg text-running-foreground border-running-border",
    text: "text-running-foreground",
    edge: "border-l-running",
    ring: "border-running",
  },
  Error: {
    dot: "bg-error",
    chip: "bg-error-bg text-error-foreground border-error-border",
    text: "text-error-foreground",
    edge: "border-l-error",
    ring: "border-error",
  },
  Idle: {
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    edge: "border-l-border",
    ring: "border-border",
  },
  Ended: {
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    edge: "border-l-border",
    ring: "border-border",
  },
};

export function StateMarker({ state }: { state: SessionState }) {
  return <span className={`inline-block size-2 rounded-[2px] ${tone[state].dot}`} />;
}
