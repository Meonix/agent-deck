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
