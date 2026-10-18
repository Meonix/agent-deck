import { useEffect, useRef, useState } from "react";
import type { ZoomClient } from "../api/zoom";
import { DEFAULT_TEXT_SIZE, nextTextSize, storedTextSize, zoomAction } from "./textZoom";

const STORAGE_KEY = "adTextSize";

function readStored(): number {
  try {
    return storedTextSize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

function store(size: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // Not kept for the next launch; this one still has the size.
  }
}

/** Applies the stored Text Size, then follows the Zoom shortcut; returns the size in effect (SRS-FR-068 to SRS-FR-071). */
export function useTextZoom(client: ZoomClient | undefined, mac: boolean): number {
  const [applied, setApplied] = useState(DEFAULT_TEXT_SIZE);
  // Moves on each press so a second press before the first zoom lands still counts.
  const target = useRef(DEFAULT_TEXT_SIZE);

  useEffect(() => {
    if (!client) return;
    let current = readStored();
    target.current = current;
    const apply = (size: number, save: boolean) =>
      client.setZoom(size).then(
        () => {
          current = size;
          if (save) store(size);
          setApplied(size);
        },
        () => {
          target.current = current;
        },
      );
    void apply(current, false);

    // Capture on the document runs before xterm's textarea, so the pane never gets the key.
    const onKey = (e: KeyboardEvent) => {
      const action = zoomAction(e, mac);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      const next = nextTextSize(target.current, action);
      if (next === target.current) return;
      target.current = next;
      void apply(next, true);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [client, mac]);

  return applied;
}
