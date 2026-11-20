import { Archive, CircleHelp, Folder, FolderX, Hand, MessageSquare, Play, TriangleAlert, type LucideIcon } from "lucide-react";
import type { SessionState } from "../api/sessions";
import { ICON, ICON_SM } from "./icon";

// Class names are written out in full so Tailwind can see them.
export const tone: Record<SessionState, { dot: string; chip: string; text: string; edge: string; ring: string; fill: string }> = {
  "Needs Approval": {
    dot: "bg-approval shadow-[0_0_6px_var(--approval)]",
    chip: "bg-approval-bg text-approval-foreground border-approval-border",
    text: "text-approval-foreground",
    edge: "border-l-approval",
    ring: "border-approval",
    fill: "bg-approval-bg",
  },
  Running: {
    dot: "bg-running",
    chip: "bg-running-bg text-running-foreground border-running-border",
    text: "text-running-foreground",
    edge: "border-l-running",
    ring: "border-running",
    fill: "bg-running-bg",
  },
  Error: {
    dot: "bg-error shadow-[0_0_6px_var(--error)]",
    chip: "bg-error-bg text-error-foreground border-error-border",
    text: "text-error-foreground",
    edge: "border-l-error",
    ring: "border-error",
    fill: "bg-error-bg",
  },
  Idle: {
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    edge: "border-l-border",
    ring: "border-border",
    fill: "bg-muted",
  },
  Ended: {
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    edge: "border-l-border",
    ring: "border-border",
    fill: "bg-muted",
  },
};

export function StateMarker({ state }: { state: SessionState }) {
  return <span className={`inline-block size-2 rounded-[2px] ${tone[state].dot}`} />;
}

export type Mark =
  | { kind: "folder"; missing?: boolean }
  | { kind: "state"; state: SessionState }
  | { kind: "unavailable" }
  | { kind: "history" }
  | { kind: "stashed" };

const QUIET = "bg-surface text-muted-foreground";
const STATE_MARK: Partial<Record<SessionState, { Icon: LucideIcon; colours: string }>> = {
  "Needs Approval": { Icon: Hand, colours: "bg-approval text-black" },
  Error: { Icon: TriangleAlert, colours: "bg-error text-black" },
  Running: { Icon: Play, colours: "bg-running text-black" },
};

/** Icon and colours of the One UI round mark that leads a row or a pane header. */
export function markLook(mark: Mark): { Icon: LucideIcon; colours: string } {
  switch (mark.kind) {
    case "folder":
      return mark.missing ? { Icon: FolderX, colours: "bg-muted text-muted-foreground" } : { Icon: Folder, colours: "bg-accent text-accent-foreground" };
    case "state":
      return STATE_MARK[mark.state] ?? { Icon: MessageSquare, colours: QUIET };
    case "unavailable":
      return { Icon: CircleHelp, colours: "bg-muted-foreground text-background" };
    case "history":
      return { Icon: MessageSquare, colours: QUIET };
    case "stashed":
      return { Icon: Archive, colours: QUIET };
  }
}

/** 28px in sidebar and history rows, 24px (`small`) in pane headers and summary chips. Decorative: the row names the state. */
export function RoundMark({ mark, small = false }: { mark: Mark; small?: boolean }) {
  const { Icon, colours } = markLook(mark);
  return (
    <span aria-hidden="true" className={`inline-flex ${small ? "size-6" : "size-7"} shrink-0 items-center justify-center rounded-full ${colours}`}>
      <Icon {...(small ? ICON_SM : ICON)} />
    </span>
  );
}
