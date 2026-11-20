import { useEffect, useReducer, useState, type RefObject } from "react";

export type SummaryMode = "hidden" | "collapsed" | "expanded";

/** SRS-FR-139 beats SRS-FR-137 and SRS-FR-138: a maximized pane hides the summary outright. */
export function summaryMode(facts: { maximized: boolean; focusInPanes: boolean; narrow: boolean }): SummaryMode {
  if (facts.maximized) return "hidden";
  return facts.focusInPanes || facts.narrow ? "collapsed" : "expanded";
}

const MODAL = '[role="dialog"][aria-modal="true"]';
const NARROW_QUERY = "(max-width: 1099px)";

export type FocusState = {
  focusInPanes: boolean;
  /** A primary pointer button is down. */
  held: boolean;
  /** Latest focus result recorded while held, applied once the press is over. */
  pending: boolean | null;
  /** The last primary press landed inside the pane area. */
  pressInPanes: boolean;
};

export type FocusAction =
  | { type: "focusin"; inPanes: boolean; inModal: boolean }
  | { type: "pointerdown"; primary: boolean; inPanes: boolean }
  | { type: "pointerend" }
  | { type: "flush" }
  | { type: "body"; inPanes: boolean };

export const initialFocusState: FocusState = {
  focusInPanes: false,
  held: false,
  pending: null,
  pressInPanes: false,
};

// Returns the same object when nothing changed so the hook does not re-render on every pointer event.
function patch(state: FocusState, changes: Partial<FocusState>): FocusState {
  const keys = Object.keys(changes) as (keyof FocusState)[];
  return keys.every((k) => state[k] === changes[k]) ? state : { ...state, ...changes };
}

function apply(state: FocusState, inPanes: boolean): FocusState {
  return state.held ? patch(state, { pending: inPanes }) : patch(state, { pending: null, focusInPanes: inPanes });
}

export function focusReducer(state: FocusState, event: FocusAction): FocusState {
  switch (event.type) {
    case "focusin":
      // A confirm dialog steals focus from the pane behind it; reflowing the panes under it would resize every PTY.
      return event.inModal ? state : apply(state, event.inPanes);
    case "pointerdown":
      // A right-click opens the native menu, which swallows the pointerup, so only the primary button holds.
      return event.primary ? patch(state, { held: true, pressInPanes: event.inPanes }) : state;
    case "pointerend":
      return patch(state, { held: false });
    case "flush": {
      const settled = state.pending === null ? state : patch(state, { focusInPanes: state.pending, pending: null });
      return patch(settled, { pressInPanes: false });
    }
    case "body":
      // A press inside the panes (header, padding, drag start) drops focus to body without leaving the panes.
      return apply(state, state.pressInPanes || event.inPanes);
  }
}

export function useSummaryMode(paneArea: RefObject<HTMLElement | null>, maximized: boolean): SummaryMode {
  const [{ focusInPanes }, dispatch] = useReducer(focusReducer, initialFocusState);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    const inPanes = (node: unknown) => node instanceof Node && !!paneArea.current?.contains(node);
    // focusin only: focusout fires between two panes and would flicker the summary open for a frame.
    const onFocusIn = (event: FocusEvent) => {
      clearTimeout(bodyTimer);
      dispatch({
        type: "focusin",
        inPanes: inPanes(event.target),
        inModal: event.target instanceof Element && !!event.target.closest(MODAL),
      });
    };
    // Focus that falls to body (empty canvas clicked, focused pane closed) fires no focusin, so only
    // a focusout that really ended on body is re-checked, after the browser has settled on the new target.
    const onFocusOut = () => {
      clearTimeout(bodyTimer);
      bodyTimer = setTimeout(() => {
        if (document.activeElement !== document.body || document.querySelector(MODAL)) return;
        dispatch({ type: "body", inPanes: inPanes(document.activeElement) });
      }, 0);
    };
    // A mode change under a held pointer moves the button before mouse-up and the click is lost,
    // so it waits until the click has been dispatched.
    const onPointerDown = (event: Event) => {
      clearTimeout(timer);
      dispatch({
        type: "pointerdown",
        primary: !((event as PointerEvent).button > 0),
        inPanes: inPanes(event.target),
      });
    };
    const onPointerEnd = () => {
      dispatch({ type: "pointerend" });
      clearTimeout(timer);
      timer = setTimeout(() => dispatch({ type: "flush" }), 0);
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
