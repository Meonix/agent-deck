import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Workspace } from "../api/workspaces";

/** The Session Chooser's life: which folder it shows, the + or name that opened it, and its Session Selection. */
export function useSessionChooser(items: Workspace[] | null, select: (workspaceId: string) => void) {
  const [chooser, setChooser] = useState<{ workspaceId: string; opens: number } | null>(null);
  const workspace = chooser ? (items?.find((w) => w.id === chooser.workspaceId) ?? null) : null;
  // Bumped on every open, also of the same folder, so its sessions are read again (SRS-FR-007).
  const opens = useRef(0);
  /** The `opens` of the chooser on screen, null while none is. */
  const shown = useRef<number | null>(null);
  /** Gets focus back when the chooser is dismissed; null once a pane action takes over. */
  const opener = useRef<HTMLElement | null>(null);
  const [selection, setSelection] = useState<string[]>([]);

  const open = (target: Workspace, from: HTMLElement) => {
    select(target.id);
    opener.current = from;
    shown.current = ++opens.current;
    setChooser({ workspaceId: target.id, opens: shown.current });
  };

  /** ×, Esc or a click outside: closed without opening a pane, so the chooser hands focus back to `opener`. */
  const dismiss = useCallback(() => {
    shown.current = null;
    setChooser(null);
    setSelection([]); // SRS-FR-076
  }, []);

  /** Closes the chooser for `action`, a pane action resolving to false when no pane opened or took focus. */
  const leave = (action: () => Promise<boolean>) => {
    const from = opener.current;
    opener.current = null;
    // Unmounted first: while it is mounted, its focus guard pulls the focus a pane takes back in (SRS-FR-015).
    flushSync(dismiss);
    void action().then((opened) => {
      // Only off body: the user may have put focus somewhere else meanwhile.
      if (!opened && from?.isConnected && document.activeElement === document.body) from.focus();
    });
  };

  /** A setter for later that ticks rows only while the chooser opened now is still on screen (SRS-FR-076). */
  const selectLater = () => {
    const startedIn = shown.current;
    return (ids: string[]) => {
      if (shown.current === startedIn) setSelection(ids);
    };
  };

  return { workspace, opens: chooser?.opens ?? 0, opener, open, dismiss, leave, selection, setSelection, selectLater };
}
