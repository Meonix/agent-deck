import type { ReactNode } from "react";
import type { PaneView } from "./ViewSwitch";

type Props = { view: PaneView; shown: boolean; className?: string; children: ReactNode };

/** One view over the whole pane body. Hidden, it stays laid out (SRS-FR-148) but takes no input. */
export function ViewLayer({ view, shown, className = "", children }: Props) {
  return (
    <div data-view={view} inert={!shown} className={`absolute inset-0 ${className} ${shown ? "" : "invisible"}`}>
      {children}
    </div>
  );
}
