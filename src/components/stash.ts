const STORAGE_KEY = "adStashedSessions";
const VERSION = 1;

/** `workspaceName` is kept so a row still reads right once its folder is removed. */
export type StashedSession = {
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  stashedAt: number;
};

/** Newest first, so the stored order is the shown order (SRS-FR-106). */
export function addStashed(list: StashedSession[], item: StashedSession): StashedSession[] {
  return [item, ...list.filter((x) => x.sessionId !== item.sessionId)];
}

export function removeStashed(list: StashedSession[], sessionId: string): StashedSession[] {
  return list.some((x) => x.sessionId === sessionId) ? list.filter((x) => x.sessionId !== sessionId) : list;
}

/** Drops the rows of `workspaceId` whose session is not among `presentIds` (SRS-FR-112). */
export function pruneStashed(list: StashedSession[], workspaceId: string, presentIds: string[]): StashedSession[] {
  const present = new Set(presentIds);
  const kept = list.filter((x) => x.workspaceId !== workspaceId || present.has(x.sessionId));
  return kept.length === list.length ? list : kept;
}

export function readStash(): StashedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const value = JSON.parse(raw) as { version?: unknown; sessions?: unknown };
    if (value?.version !== VERSION || !Array.isArray(value.sessions)) return [];
    return value.sessions.every(isStashed) ? value.sessions : [];
  } catch {
    return [];
  }
}

export function writeStash(list: StashedSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, sessions: list }));
  } catch {
    // Not kept for the next launch; this one still shows the list.
  }
}

function isStashed(x: unknown): x is StashedSession {
  const v = x as StashedSession;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.sessionId === "string" &&
    typeof v.workspaceId === "string" &&
    typeof v.workspaceName === "string" &&
    typeof v.title === "string" &&
    typeof v.stashedAt === "number"
  );
}
