import { Archive, CircleHelp, MessageSquare, type LucideIcon } from "lucide-react";
import type { SessionState } from "../api/sessions";
import { ICON, ICON_SM } from "./icon";

// Class names are written out in full so Tailwind can see them.
// `word`: the status word on --card (SRS-NFR-014).
export const tone: Record<SessionState, { dot: string; chip: string; word: string }> = {
  "Needs Approval": {
    dot: "dot dot-app",
    chip: "chip chip-app",
    word: "w-app",
  },
  Running: {
    dot: "dot dot-busy",
    chip: "chip chip-idle",
    word: "w-busy",
  },
  Error: {
    dot: "dot dot-err",
    chip: "chip chip-err",
    word: "w-err",
  },
  Idle: {
    dot: "dot dot-ready",
    chip: "chip chip-idle",
    word: "w-ready",
  },
  Ended: {
    dot: "dot dot-ended",
    chip: "chip chip-idle",
    word: "sub",
  },
};

export type Mark =
  | { kind: "state"; state: SessionState }
  | { kind: "unavailable" }
  | { kind: "history" }
  | { kind: "stashed" };

/** A state is the remote 8px dot; anything else is a muted icon. */
export function markLook(mark: Mark): { dot: string } | { Icon: LucideIcon } {
  switch (mark.kind) {
    case "state":
      return { dot: tone[mark.state].dot };
    case "unavailable":
      return { Icon: CircleHelp };
    case "history":
      return { Icon: MessageSquare };
    case "stashed":
      return { Icon: Archive };
  }
}

/** The marker that leads a row or a pane header; `small` shrinks an icon to 12px. Decorative: the row names the state. */
export function RoundMark({ mark, small = false }: { mark: Mark; small?: boolean }) {
  const look = markLook(mark);
  if ("dot" in look) return <span aria-hidden="true" className={look.dot} />;
  const { Icon } = look;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center text-muted-foreground">
      <Icon {...(small ? ICON_SM : ICON)} />
    </span>
  );
}
