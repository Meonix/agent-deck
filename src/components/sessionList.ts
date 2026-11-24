import type { SessionRow } from "../api/sessions";
import { labels, UNTITLED_DATA } from "../labels";

export type ListedSession = SessionRow & { live: boolean };
export type OpenSession = { sessionId: string; workspaceId: string; title: string; openedAt: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Relative last-activity label, as in the design ("2 giờ trước", "hôm qua"). */
export function formatWhen(ms: number, now: number): string {
  const ago = Math.max(0, now - ms);
  if (ago < MINUTE) return labels.justNow;
  if (ago < HOUR) return labels.minutesAgo(Math.floor(ago / MINUTE));
  if (ago < 24 * HOUR) return labels.hoursAgo(Math.floor(ago / HOUR));
  const then = new Date(ms);
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(then)) / (24 * HOUR));
  // A 25-hour day (DST) can put a same-day time over 24 h ago.
  if (days <= 0) return labels.hoursAgo(Math.floor(ago / HOUR));
  if (days === 1) return labels.yesterday;
  if (days < 7) return labels.daysAgo(days);
  if (days < 14) return labels.lastWeek;
  const [day, month] = [then.getDate(), then.getMonth() + 1];
  return then.getFullYear() === new Date(now).getFullYear() ? labels.date(day, month) : labels.dateWithYear(day, month, then.getFullYear());
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * The scanned sessions plus the ones open in panes of this workspace: those are `Live`
 * (SRS-FR-012), and one Claude Code has not written to disk yet still gets its row (SRS-FR-019).
 */
export function mergeSessions(scanned: SessionRow[], open: OpenSession[], workspaceId: string): ListedSession[] {
  const here = new Map(open.filter((o) => o.workspaceId === workspaceId).map((o) => [o.sessionId, o]));
  const rows: ListedSession[] = scanned.map((row) => {
    const pane = here.get(row.id);
    const title = pane && pane.title !== UNTITLED_DATA ? pane.title : row.title;
    return { ...row, title, live: pane !== undefined };
  });
  const known = new Set(scanned.map((row) => row.id));
  for (const pane of here.values()) {
    if (!known.has(pane.sessionId)) {
      rows.push({ id: pane.sessionId, title: pane.title, lastActivity: pane.openedAt, live: true });
    }
  }
  return rows.sort((a, b) => b.lastActivity - a.lastActivity);
}
