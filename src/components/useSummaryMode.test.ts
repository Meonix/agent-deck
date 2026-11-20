import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summaryMode, useSummaryMode } from "./useSummaryMode";

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
