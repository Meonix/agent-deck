import { useCallback, useEffect, useState } from "react";
import { sidebarShortcut } from "./sidebarToggle";

/** Whether the Sidebar shows; starts shown on every launch, nothing stored (SRS-FR-088 to SRS-FR-090). */
export function useSidebarToggle(mac: boolean): { shown: boolean; toggle(): void } {
  const [shown, setShown] = useState(true);
  const toggle = useCallback(() => setShown((s) => !s), []);

  useEffect(() => {
    // Capture on the document runs before xterm's textarea, so the pane never gets the key.
    const onKey = (e: KeyboardEvent) => {
      if (!sidebarShortcut(e, mac)) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [mac, toggle]);

  return { shown, toggle };
}
