import { useEffect, useRef, useState, type RefObject } from "react";

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

  const pointerDown = useRef(false);

  useEffect(() => {
    let pending: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // focusin only: focusout fires between two panes and would flicker the summary open for a frame.
    const onFocusIn = (event: FocusEvent) => {
      const inPanes = event.target instanceof Node && !!paneArea.current?.contains(event.target);
      if (pointerDown.current) pending = inPanes;
      else setFocusInPanes(inPanes);
    };
    // A mode change under a held pointer moves the button before mouse-up and the click is lost,
    // so it waits until the click has been dispatched.
    const onPointerDown = () => {
      clearTimeout(timer);
      pointerDown.current = true;
    };
    const onPointerEnd = () => {
      pointerDown.current = false;
      timer = setTimeout(() => {
        if (pending !== null) setFocusInPanes(pending);
        pending = null;
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
    };
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
