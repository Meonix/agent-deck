import { useEffect, useRef, useState } from "react";
import type { SessionListing, SessionsClient } from "../api/sessions";
import type { Workspace } from "../api/workspaces";

export type SessionListState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; workspaceId: string; listing: SessionListing };

const NONE: SessionListState = { kind: "none" };
const LOADING: SessionListState = { kind: "loading" };

/**
 * Reads the sessions of the Session Chooser's workspace on every open (`opens`, SRS-FR-007) and again
 * when a pane of that workspace opens or closes, so a new session's file and a closed pane's label are
 * picked up, and on each `reloads` bump (a deleted session). `workspace` is null while the chooser is closed.
 */
export function useSessionList(
  client: SessionsClient,
  workspace: Workspace | null,
  opens: number,
  openSessions: string,
  reloads: number,
): SessionListState {
  const [state, setState] = useState<{ id: string; list: SessionListState } | null>(null);
  const seq = useRef(0);
  const id = workspace?.id ?? null;
  const missing = workspace?.missing ?? false;

  useEffect(() => {
    const mine = ++seq.current;
    // Closed: the last rows stay, so reopening the same folder shows them while it reads again.
    if (id === null) return;
    if (missing) return setState({ id, list: { kind: "missing" } });
    setState((s) => (s?.id === id && s.list.kind === "ready" ? s : { id, list: LOADING }));
    client.list(id).then(
      (listing) => mine === seq.current && setState({ id, list: { kind: "ready", workspaceId: id, listing } }),
      (e) => mine === seq.current && setState({ id, list: { kind: e === "folder_missing" ? "missing" : "failed" } }),
    );
  }, [client, id, missing, opens, openSessions, reloads]);

  if (id === null) return NONE;
  // Another folder's rows must not show under this one's header before its read starts.
  if (state?.id !== id) return missing ? { kind: "missing" } : LOADING;
  return state.list;
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
