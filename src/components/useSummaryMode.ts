import { useEffect, useState, type RefObject } from "react";

export type SummaryMode = "hidden" | "collapsed" | "expanded";

/** SRS-FR-139 beats SRS-FR-137 and SRS-FR-138: a maximized pane hides the summary outright. */
export function summaryMode(facts: { maximized: boolean; focusInPanes: boolean; narrow: boolean }): SummaryMode {
  if (facts.maximized) return "hidden";
  return facts.focusInPanes || facts.narrow ? "collapsed" : "expanded";
}

const NARROW_QUERY = "(max-width: 1099px)";

export function useSummaryMode(paneArea: RefObject<HTMLElement | null>, maximized: boolean): SummaryMode {
  const [focusInPanes, setFocusInPanes] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    // focusin only: focusout fires between two panes and would flicker the summary open for a frame.
    const onFocusIn = (event: FocusEvent) => {
      setFocusInPanes(event.target instanceof Node && !!paneArea.current?.contains(event.target));
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [paneArea]);

  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return summaryMode({ maximized, focusInPanes, narrow });
}
