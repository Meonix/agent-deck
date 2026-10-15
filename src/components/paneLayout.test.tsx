import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { insertRight } from "./paneLayout";
import { PaneGrid } from "./PaneGrid";

describe("insertRight (5.2)", () => {
  it("puts the first pane into an empty layout", () => {
    expect(insertRight([], null, "a")).toEqual(["a"]);
  });

  it("puts the new pane right after the focused middle pane", () => {
    expect(insertRight(["a", "b", "c"], "b", "n")).toEqual(["a", "b", "n", "c"]);
  });

  it("appends when no pane is focused", () => {
    expect(insertRight(["a", "b"], null, "n")).toEqual(["a", "b", "n"]);
  });

  it("appends when the focused id is no longer in the layout", () => {
    expect(insertRight(["a", "b"], "gone", "n")).toEqual(["a", "b", "n"]);
  });
});

describe("PaneGrid (5.2)", () => {
  it("lays the panes out as equal columns in order", () => {
    render(
      <PaneGrid>
        <section aria-label="one" />
        <section aria-label="two" />
        <section aria-label="three" />
      </PaneGrid>,
    );
    const grid = screen.getByTestId("pane-grid");
    expect(grid.style.gridTemplateColumns).toBe("repeat(3, minmax(0,1fr))");
    expect([...grid.children].map((c) => c.getAttribute("aria-label"))).toEqual(["one", "two", "three"]);
  });
});
