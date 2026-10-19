import { describe, expect, it } from "vitest";
import { dropSide, layoutRects, minSpan, movePane, paneOrder, removePane, setRatio, splitPane, type Layout } from "./paneTree";

const full = { x: 0, y: 0, width: 1, height: 1 };

function twoBySide(): Layout {
  return splitPane({ pane: "A" }, "A", "B", "right");
}

describe("splitPane", () => {
  it("makes the first pane the whole layout", () => {
    expect(splitPane(null, null, "A", "right")).toEqual({ pane: "A" });
    expect(layoutRects({ pane: "A" })).toEqual({ panes: { A: full }, dividers: [] });
  });

  it("splits right into two side-by-side halves", () => {
    const layout = twoBySide();
    expect(layout).toEqual({ split: "right", ratio: 0.5, first: { pane: "A" }, second: { pane: "B" } });
    expect(layoutRects(layout).panes).toEqual({
      A: { x: 0, y: 0, width: 0.5, height: 1 },
      B: { x: 0.5, y: 0, width: 0.5, height: 1 },
    });
  });

  it("splits down into two stacked halves", () => {
    const layout = splitPane({ pane: "A" }, "A", "B", "down");
    expect(layoutRects(layout).panes).toEqual({
      A: { x: 0, y: 0, width: 1, height: 0.5 },
      B: { x: 0, y: 0.5, width: 1, height: 0.5 },
    });
  });

  it("stacks the new pane under B and leaves A the left half", () => {
    const layout = splitPane(twoBySide(), "B", "C", "down");
    expect(layoutRects(layout).panes).toEqual({
      A: { x: 0, y: 0, width: 0.5, height: 1 },
      B: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      C: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    });
  });

  it("splits the last pane for a null or unknown target", () => {
    const base = splitPane(twoBySide(), "A", "C", "down");
    expect(paneOrder(base)).toEqual(["A", "C", "B"]);
    expect(paneOrder(splitPane(base, null, "D", "right"))).toEqual(["A", "C", "B", "D"]);
    expect(paneOrder(splitPane(base, "nope", "D", "right"))).toEqual(["A", "C", "B", "D"]);
  });

  it("does not mutate its input", () => {
    const layout = twoBySide();
    const copy = structuredClone(layout);
    splitPane(layout, "A", "C", "down");
    expect(layout).toEqual(copy);
  });
});

describe("paneOrder", () => {
  it("is empty for no layout and depth-first otherwise", () => {
    expect(paneOrder(null)).toEqual([]);
    expect(paneOrder(splitPane(twoBySide(), "A", "C", "down"))).toEqual(["A", "C", "B"]);
  });
});

describe("setRatio", () => {
  it("moves the divider of a right split to 2/3 and 1/3", () => {
    const { panes } = layoutRects(setRatio(twoBySide(), [], 2 / 3));
    expect(panes.A.width).toBeCloseTo(2 / 3);
    expect(panes.B.x).toBeCloseTo(2 / 3);
    expect(panes.B.width).toBeCloseTo(1 / 3);
  });

  it("changes only the split at the path", () => {
    const layout = splitPane(twoBySide(), "B", "C", "down");
    const next = setRatio(layout, ["second"], 0.25);
    expect(next).toEqual({
      split: "right",
      ratio: 0.5,
      first: { pane: "A" },
      second: { split: "down", ratio: 0.25, first: { pane: "B" }, second: { pane: "C" } },
    });
  });

  it("leaves the layout alone for a path that reaches no split, and does not mutate", () => {
    const layout = twoBySide();
    const copy = structuredClone(layout);
    expect(setRatio(layout, ["first"], 0.1)).toEqual(copy);
    expect(setRatio(layout, ["second", "first"], 0.1)).toEqual(copy);
    expect(setRatio({ pane: "A" }, [], 0.1)).toEqual({ pane: "A" });
    setRatio(layout, [], 0.9);
    expect(layout).toEqual(copy);
  });
});

describe("layoutRects dividers", () => {
  it("reports one divider per split with its box and boundary", () => {
    const layout = setRatio(splitPane(twoBySide(), "B", "C", "down"), ["second"], 0.25);
    expect(layoutRects(layout).dividers).toEqual([
      { path: [], dir: "right", box: full, at: 0.5 },
      { path: ["second"], dir: "down", box: { x: 0.5, y: 0, width: 0.5, height: 1 }, at: 0.25 },
    ]);
  });

  it("is empty for no layout", () => {
    expect(layoutRects(null)).toEqual({ panes: {}, dividers: [] });
  });
});

describe("removePane", () => {
  it("gives the space to the sibling", () => {
    const layout = removePane(twoBySide(), "A");
    expect(layout).toEqual({ pane: "B" });
    expect(layoutRects(layout).panes).toEqual({ B: full });
  });

  it("gives the space to a sibling that is itself a split, keeping its ratio", () => {
    const layout = setRatio(splitPane(twoBySide(), "B", "C", "down"), ["second"], 0.25);
    const next = removePane(layout, "A");
    expect(next).toEqual({ split: "down", ratio: 0.25, first: { pane: "B" }, second: { pane: "C" } });
    expect(layoutRects(next).panes.B).toEqual({ x: 0, y: 0, width: 1, height: 0.25 });
  });

  it("removes a pane nested in a column", () => {
    const layout = splitPane(twoBySide(), "B", "C", "down");
    expect(removePane(layout, "C")).toEqual(twoBySide());
  });

  it("returns null for the last pane and the same layout for an unknown id", () => {
    expect(removePane({ pane: "A" }, "A")).toBeNull();
    expect(removePane(twoBySide(), "nope")).toEqual(twoBySide());
  });

  it("does not mutate its input", () => {
    const layout = splitPane(twoBySide(), "B", "C", "down");
    const copy = structuredClone(layout);
    removePane(layout, "B");
    expect(layout).toEqual(copy);
  });
});

describe("minSpan", () => {
  const abc: Layout = {
    split: "right",
    ratio: 0.5,
    first: { pane: "A" },
    second: { split: "right", ratio: 0.5, first: { pane: "B" }, second: { pane: "C" } },
  };

  it("is the minimum for a leaf", () => {
    expect(minSpan({ pane: "A" }, "right", 200)).toBe(200);
  });

  it("adds both children along the split's own axis", () => {
    expect(minSpan(abc, "right", 200)).toBe(600);
  });

  it("takes the larger child across the axis", () => {
    expect(minSpan(abc, "down", 120)).toBe(120);
    const mixed: Layout = {
      split: "down",
      ratio: 0.5,
      first: { pane: "A" },
      second: { split: "right", ratio: 0.5, first: { pane: "B" }, second: { pane: "C" } },
    };
    expect(minSpan(mixed, "right", 200)).toBe(400);
    expect(minSpan(mixed, "down", 120)).toBe(240);
  });
});

describe("movePane (SRS-FR-081)", () => {
  const AB: Layout = { split: "right", ratio: 0.5, first: { pane: "A" }, second: { pane: "B" } };

  it("puts the pane on each side of the target, splitting the target in half", () => {
    expect(movePane(AB, "A", "B", "left")).toEqual({ split: "right", ratio: 0.5, first: { pane: "A" }, second: { pane: "B" } });
    expect(movePane(AB, "A", "B", "right")).toEqual({ split: "right", ratio: 0.5, first: { pane: "B" }, second: { pane: "A" } });
    expect(movePane(AB, "A", "B", "top")).toEqual({ split: "down", ratio: 0.5, first: { pane: "A" }, second: { pane: "B" } });
    expect(movePane(AB, "A", "B", "bottom")).toEqual({ split: "down", ratio: 0.5, first: { pane: "B" }, second: { pane: "A" } });
  });

  it("gives the old place to the panes left behind", () => {
    // A on the left, B over C on the right; C goes left of A.
    const layout: Layout = {
      split: "right",
      ratio: 0.3,
      first: { pane: "A" },
      second: { split: "down", ratio: 0.5, first: { pane: "B" }, second: { pane: "C" } },
    };
    const moved = movePane(layout, "C", "A", "left");
    expect(layoutRects(moved).panes).toEqual({
      C: { x: 0, y: 0, width: 0.15, height: 1 },
      A: { x: 0.15, y: 0, width: 0.15, height: 1 },
      B: { x: 0.3, y: 0, width: 0.7, height: 1 },
    });
  });

  it("leaves the layout alone for the same pane or an unknown id", () => {
    expect(movePane(AB, "A", "A", "left")).toBe(AB);
    expect(movePane(AB, "X", "B", "left")).toBe(AB);
    expect(movePane(AB, "A", "X", "left")).toBe(AB);
  });
});

describe("dropSide", () => {
  it("picks the nearest edge", () => {
    expect(dropSide(0.1, 0.5)).toBe("left");
    expect(dropSide(0.9, 0.5)).toBe("right");
    expect(dropSide(0.5, 0.1)).toBe("top");
    expect(dropSide(0.5, 0.9)).toBe("bottom");
    expect(dropSide(0.3, 0.8)).toBe("bottom");
  });

  it("prefers left and right on a tie", () => {
    expect(dropSide(0.5, 0.5)).toBe("left");
    expect(dropSide(0.8, 0.8)).toBe("right");
  });
});
