import { Archive, Check, CircleHelp, Hand, MessageSquare, Play, TriangleAlert, type LucideIcon } from "lucide-react";
import type { SessionState } from "../api/sessions";
import { ICON, ICON_SM } from "./icon";

// Class names are written out in full so Tailwind can see them.
// `dot`: the 8px dot of the small mark; `round` and `glyph`: the 28px round icon (CR-020);
// `chip`: the count on a workspace row; `pill`: the state chip of the pane header; `word`: the status word on --card (SRS-NFR-014).
export const tone: Record<SessionState, { dot: string; round: string; glyph?: LucideIcon; chip: string; pill: string; word: string }> = {
  "Needs Approval": {
    dot: "dot dot-app",
    round: "state-icon state-icon-app",
    glyph: Hand,
    chip: "chip chip-app",
    pill: "chip chip-app",
    word: "w-app",
  },
  Running: {
    dot: "dot dot-busy",
    round: "state-icon state-icon-busy",
    glyph: Play,
    chip: "chip chip-idle",
    pill: "chip chip-busy",
    word: "w-busy",
  },
  Error: {
    dot: "dot dot-err",
    round: "state-icon state-icon-err",
    glyph: TriangleAlert,
    chip: "chip chip-err",
    pill: "chip chip-err",
    word: "w-err",
  },
  Idle: {
    dot: "dot dot-ready",
    round: "state-icon state-icon-ready",
    glyph: Check,
    chip: "chip chip-idle",
    pill: "chip chip-ready",
    word: "w-ready",
  },
  Ended: {
    dot: "dot dot-ended",
    round: "state-icon state-icon-ring",
    chip: "chip chip-idle",
    pill: "chip chip-idle",
    word: "sub",
  },
};

const RING = "state-icon state-icon-ring";
const GLYPH = { size: 14, strokeWidth: 2.25, "aria-hidden": true } as const;

export type Mark =
  | { kind: "state"; state: SessionState }
  | { kind: "unavailable" }
  | { kind: "history" }
  | { kind: "stashed" };

/** A state, or a status that cannot be read, is the 28px round icon; history and stash are a muted icon. */
export function markLook(mark: Mark): { round: string; Glyph?: LucideIcon } | { Icon: LucideIcon } {
  switch (mark.kind) {
    case "state": {
      const { round, glyph } = tone[mark.state];
      return glyph ? { round, Glyph: glyph } : { round };
    }
    case "unavailable":
      return { round: RING };
    case "history":
      return { Icon: MessageSquare };
    case "stashed":
      return { Icon: Archive };
  }
}

/**
 * The marker that leads a row or a pane header. `small` is the compact form for a badge: a state is the 8px dot,
 * an icon 12px. Decorative: the row names the state.
 */
export function RoundMark({ mark, small = false }: { mark: Mark; small?: boolean }) {
  if (small && mark.kind === "state") return <span aria-hidden="true" className={tone[mark.state].dot} />;
  const look = small && mark.kind === "unavailable" ? { Icon: CircleHelp } : markLook(mark);
  if ("round" in look) {
    const { Glyph } = look;
    return (
      <span aria-hidden="true" className={look.round}>
        {Glyph && <Glyph {...GLYPH} />}
      </span>
    );
  }
  const { Icon } = look;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center text-muted-foreground">
      <Icon {...(small ? ICON_SM : ICON)} />
    </span>
  );
}
