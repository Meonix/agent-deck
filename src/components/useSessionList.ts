import { useEffect, useRef, useState } from "react";
import type { SessionListing, SessionsClient } from "../api/sessions";
import type { Workspace } from "../api/workspaces";

export type SessionListState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; workspaceId: string; listing: SessionListing };

/**
 * Reads the selected workspace's sessions on every selection (SRS-FR-007) and again when a pane of
 * that workspace opens or closes, so a new session's file and a closed pane's label are picked up,
 * and on each `reloads` bump (a deleted session).
 */
export function useSessionList(
  client: SessionsClient,
  selected: Workspace | null,
  selections: number,
  openSessions: string,
  reloads: number,
): SessionListState {
  const [state, setState] = useState<SessionListState>({ kind: "none" });
  const seq = useRef(0);
  const id = selected?.id ?? null;
  const missing = selected?.missing ?? false;

  useEffect(() => {
    const mine = ++seq.current;
    if (id === null) return setState({ kind: "none" });
    if (missing) return setState({ kind: "missing" });
    // Keep the rows on screen while the same folder is read again; skeleton only for a new folder.
    setState((s) => (s.kind === "ready" && s.workspaceId === id ? s : { kind: "loading" }));
    client.list(id).then(
      (listing) => mine === seq.current && setState({ kind: "ready", workspaceId: id, listing }),
      (e) => mine === seq.current && setState({ kind: e === "folder_missing" ? "missing" : "failed" }),
    );
  }, [client, id, missing, selections, openSessions, reloads]);

  return state;
}

/** The current time, refreshed every minute so "2 min ago" labels move on. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
