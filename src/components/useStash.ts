import { useCallback, useEffect, useState } from "react";
import { type StashedSession, addStashed, pruneStashed, readStash, removeStashed, writeStash } from "./stash";

export type Stash = {
  items: StashedSession[];
  add(item: StashedSession): void;
  remove(sessionId: string): void;
  prune(workspaceId: string, presentIds: string[]): void;
};

/** Stashed Sessions, kept between launches (SRS-FR-111). */
export function useStash(): Stash {
  const [items, setItems] = useState(readStash);
  useEffect(() => writeStash(items), [items]);
  const add = useCallback((item: StashedSession) => setItems((l) => addStashed(l, item)), []);
  const remove = useCallback((sessionId: string) => setItems((l) => removeStashed(l, sessionId)), []);
  const prune = useCallback(
    (workspaceId: string, presentIds: string[]) => setItems((l) => pruneStashed(l, workspaceId, presentIds)),
    [],
  );
  return { items, add, remove, prune };
}
