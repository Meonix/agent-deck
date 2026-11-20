import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusReducer, initialFocusState, summaryMode, useSummaryMode, type FocusState } from "./useSummaryMode";

describe("summaryMode", () => {
  const table: [boolean, boolean, boolean, string][] = [
    [false, false, false, "expanded"],
    [false, false, true, "collapsed"],
    [false, true, false, "collapsed"],
    [false, true, true, "collapsed"],
    [true, false, false, "hidden"],
    [true, false, true, "hidden"],
    [true, true, false, "hidden"],
    [true, true, true, "hidden"],
  ];

  it.each(table)("maximized %s, focusInPanes %s, narrow %s -> %s", (maximized, focusInPanes, narrow, expected) => {
    expect(summaryMode({ maximized, focusInPanes, narrow })).toBe(expected);
  });
});

describe("focusReducer", () => {
  const held: FocusState = { ...initialFocusState, held: true };

  it("focusin sets focusInPanes", () => {
    expect(
      focusReducer(initialFocusState, {
        type: "focusin",
        inPanes: true,
        inModal: false,
      }).focusInPanes,
    ).toBe(true);
  });

  it("focusin inside a modal is ignored", () => {
    const state = { ...initialFocusState, focusInPanes: true };
    expect(focusReducer(state, { type: "focusin", inPanes: false, inModal: true })).toBe(state);
  });

  it("focusin while held is recorded as pending, not applied", () => {
    expect(focusReducer(held, { type: "focusin", inPanes: true, inModal: false })).toEqual({ ...held, pending: true });
  });

  it("a primary pointerdown holds and remembers whether it hit the panes", () => {
    const state = focusReducer(initialFocusState, {
      type: "pointerdown",
      primary: true,
      inPanes: true,
    });
    expect(state).toMatchObject({ held: true, pressInPanes: true });
  });

  it("a non-primary pointerdown changes nothing", () => {
    expect(
      focusReducer(initialFocusState, {
        type: "pointerdown",
        primary: false,
        inPanes: true,
      }),
    ).toBe(initialFocusState);
  });

  it("pointerend releases the hold but keeps pending for the flush", () => {
    expect(focusReducer({ ...held, pending: true }, { type: "pointerend" })).toMatchObject({
      held: false,
      pending: true,
    });
  });

  it("flush applies pending and clears the press", () => {
    const state = { ...initialFocusState, pending: true, pressInPanes: true };
    expect(focusReducer(state, { type: "flush" })).toEqual({
      ...initialFocusState,
      focusInPanes: true,
    });
  });

  it("flush without pending keeps focusInPanes", () => {
    const state = { ...initialFocusState, focusInPanes: true };
    expect(focusReducer(state, { type: "flush" })).toBe(state);
  });

  it("body re-check follows where focus ended", () => {
    const state = { ...initialFocusState, focusInPanes: true };
    expect(focusReducer(state, { type: "body", inPanes: false }).focusInPanes).toBe(false);
  });

  it("body re-check after a press inside the panes keeps them focused (SRS-FR-137)", () => {
    const state = {
      ...initialFocusState,
      focusInPanes: true,
      held: true,
      pressInPanes: true,
    };
    const next = focusReducer(state, { type: "body", inPanes: false });
    expect(focusReducer({ ...next, held: false }, { type: "flush" }).focusInPanes).toBe(true);
  });

  it("body re-check after a press outside the panes expands", () => {
    const state = {
      ...initialFocusState,
      focusInPanes: true,
      held: true,
      pressInPanes: false,
    };
    const next = focusReducer(state, { type: "body", inPanes: false });
    expect(focusReducer({ ...next, held: false }, { type: "flush" }).focusInPanes).toBe(false);
  });
});

describe("useSummaryMode", () => {
  let narrow = false;
  let listener: (() => void) | null = null;

  beforeEach(() => {
    narrow = false;
    listener = null;
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() {
        return narrow;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener: () => (listener = null),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("collapses while focus is in the pane area and expands when it leaves (SRS-FR-137)", () => {
    const area = document.createElement("div");
    const inside = document.createElement("textarea");
    const outside = document.createElement("button");
    area.append(inside);
    document.body.append(area, outside);
    const { result } = renderHook(() => useSummaryMode({ current: area }, false));
    expect(result.current).toBe("expanded");
    act(() => inside.focus());
    expect(result.current).toBe("collapsed");
    act(() => outside.focus());
    expect(result.current).toBe("expanded");
  });

  describe("while a pointer button is down", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function setup() {
      const area = document.createElement("div");
      const inside = document.createElement("textarea");
      const outside = document.createElement("button");
      area.append(inside);
      document.body.append(area, outside);
      return { inside, outside, ...renderHook(() => useSummaryMode({ current: area }, false)) };
    }

    it("keeps collapsed until the click is over when focus leaves the panes", () => {
      const { inside, outside, result } = setup();
      act(() => inside.focus());
      expect(result.current).toBe("collapsed");
      act(() => {
        document.dispatchEvent(new Event("pointerdown"));
        outside.focus();
      });
      expect(result.current).toBe("collapsed");
      act(() => {
        document.dispatchEvent(new Event("pointerup"));
        vi.runAllTimers();
      });
      expect(result.current).toBe("expanded");
    });

    it("lets a later keyboard focus win over the held value", () => {
      const { inside, outside, result } = setup();
      act(() => inside.focus());
      act(() => {
        document.dispatchEvent(new Event("pointerdown"));
        outside.focus();
        document.dispatchEvent(new Event("pointerup"));
        inside.focus();
        vi.runAllTimers();
      });
      expect(result.current).toBe("collapsed");
    });

    it("keeps expanded until the click is over when focus enters a pane", () => {
      const { inside, result } = setup();
      act(() => {
        document.dispatchEvent(new Event("pointerdown"));
        inside.focus();
      });
      expect(result.current).toBe("expanded");
      act(() => {
        document.dispatchEvent(new Event("pointerup"));
        vi.runAllTimers();
      });
      expect(result.current).toBe("collapsed");
    });
  });

  describe("pointer hold release and body focus", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function setup() {
      const area = document.createElement("div");
      const inside = document.createElement("textarea");
      const outside = document.createElement("button");
      area.append(inside);
      document.body.append(area, outside);
      return { inside, outside, ...renderHook(() => useSummaryMode({ current: area }, false)) };
    }

    it("does not hold for a non-primary button (SRS-FR-137)", () => {
      const { inside, outside, result } = setup();
      act(() => inside.focus());
      act(() => {
        document.dispatchEvent(new MouseEvent("pointerdown", { button: 2 }));
        outside.focus();
      });
      expect(result.current).toBe("expanded");
    });

    it("releases the hold on window blur (SRS-FR-137)", () => {
      const { inside, outside, result } = setup();
      act(() => inside.focus());
      act(() => {
        document.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
        outside.focus();
      });
      expect(result.current).toBe("collapsed");
      act(() => {
        window.dispatchEvent(new Event("blur"));
        vi.runAllTimers();
      });
      expect(result.current).toBe("expanded");
    });

    it("releases the hold on contextmenu (SRS-FR-137)", () => {
      const { inside, outside, result } = setup();
      act(() => inside.focus());
      act(() => {
        document.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
        outside.focus();
        document.dispatchEvent(new Event("contextmenu"));
        vi.runAllTimers();
      });
      expect(result.current).toBe("expanded");
    });

    it("keeps the mode when focus lands inside an aria-modal dialog", () => {
      const { inside, result } = setup();
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      const cancel = document.createElement("button");
      dialog.append(cancel);
      document.body.append(dialog);
      act(() => inside.focus());
      act(() => cancel.focus());
      expect(result.current).toBe("collapsed");
    });

    it("expands when focus falls to body, but not on a pane-to-pane move", () => {
      const { inside, result } = setup();
      const other = document.createElement("textarea");
      document.body.firstElementChild!.append(other);
      act(() => inside.focus());
      act(() => {
        other.focus();
        vi.runAllTimers();
      });
      expect(result.current).toBe("collapsed");
      act(() => {
        other.blur();
        vi.runAllTimers();
      });
      expect(result.current).toBe("expanded");
    });

    it("body focus waits for the pointer hold", () => {
      const { inside, result } = setup();
      act(() => inside.focus());
      act(() => {
        document.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
        inside.blur();
        vi.runAllTimers();
      });
      expect(result.current).toBe("collapsed");
      act(() => {
        document.dispatchEvent(new Event("pointerup"));
        vi.runAllTimers();
      });
      expect(result.current).toBe("expanded");
    });

    it("stays collapsed when focus falls to body after a primary press inside the pane area (SRS-FR-137)", () => {
      const { inside, result } = setup();
      const header = document.createElement("div");
      document.body.firstElementChild!.append(header);
      act(() => inside.focus());
      act(() => {
        header.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
        inside.blur();
        vi.runAllTimers();
        document.dispatchEvent(new Event("pointerup"));
        vi.runAllTimers();
      });
      expect(result.current).toBe("collapsed");
    });
  });

  it("collapses in a narrow window (SRS-FR-138)", () => {
    const { result } = renderHook(() => useSummaryMode({ current: document.createElement("div") }, false));
    expect(result.current).toBe("expanded");
    narrow = true;
    act(() => listener?.());
    expect(result.current).toBe("collapsed");
  });

  it("hides while maximized (SRS-FR-139)", () => {
    const { result } = renderHook(() => useSummaryMode({ current: null }, true));
    expect(result.current).toBe("hidden");
  });
});
