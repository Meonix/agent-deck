import { useEffect, useRef, useState, type RefObject } from "react";

export type SummaryMode = "hidden" | "collapsed" | "expanded";

/** SRS-FR-139 beats SRS-FR-137 and SRS-FR-138: a maximized pane hides the summary outright. */
export function summaryMode(facts: { maximized: boolean; focusInPanes: boolean; narrow: boolean }): SummaryMode {
  if (facts.maximized) return "hidden";
  return facts.focusInPanes || facts.narrow ? "collapsed" : "expanded";
}

const MODAL = '[role="dialog"][aria-modal="true"]';
const NARROW_QUERY = "(max-width: 1099px)";

export function useSummaryMode(paneArea: RefObject<HTMLElement | null>, maximized: boolean): SummaryMode {
  const [focusInPanes, setFocusInPanes] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  const pointerDown = useRef(false);

  useEffect(() => {
    let pending: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    const apply = (inPanes: boolean) => {
      if (pointerDown.current) pending = inPanes;
      else {
        pending = null;
        clearTimeout(timer);
        setFocusInPanes(inPanes);
      }
    };
    // focusin only: focusout fires between two panes and would flicker the summary open for a frame.
    const onFocusIn = (event: FocusEvent) => {
      clearTimeout(bodyTimer);
      // A confirm dialog steals focus from the pane behind it; reflowing the panes under it would resize every PTY.
      if (event.target instanceof Element && event.target.closest(MODAL)) return;
      apply(event.target instanceof Node && !!paneArea.current?.contains(event.target));
    };
    // Focus that falls to body (empty canvas clicked, focused pane closed) fires no focusin, so only
    // a focusout that really ended on body is re-checked, after the browser has settled on the new target.
    const onFocusOut = () => {
      clearTimeout(bodyTimer);
      bodyTimer = setTimeout(() => {
        if (document.activeElement !== document.body || document.querySelector(MODAL)) return;
        apply(!!paneArea.current?.contains(document.activeElement));
      }, 0);
    };
    // A mode change under a held pointer moves the button before mouse-up and the click is lost,
    // so it waits until the click has been dispatched.
    const onPointerDown = (event: Event) => {
      // A right-click opens the native menu, which swallows the pointerup, so only the primary button holds.
      if ((event as PointerEvent).button > 0) return;
      clearTimeout(timer);
      pointerDown.current = true;
    };
    const onPointerEnd = () => {
      pointerDown.current = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending !== null) setFocusInPanes(pending);
        pending = null;
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    // pointerup never arrives when the window loses focus mid-press or a context menu opens.
    document.addEventListener("contextmenu", onPointerEnd, true);
    window.addEventListener("blur", onPointerEnd);
    return () => {
      clearTimeout(timer);
      clearTimeout(bodyTimer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
      document.removeEventListener("contextmenu", onPointerEnd, true);
      window.removeEventListener("blur", onPointerEnd);
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
