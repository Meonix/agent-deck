import { afterEach, describe, expect, it } from "vitest";
import type { Layout } from "./paneTree";
import { type SnapshotEntry, readSnapshot, rebuildLayout, snapshotOf, writeSnapshot } from "./paneSnapshot";

function e(id: string, over: Partial<SnapshotEntry> = {}): SnapshotEntry {
  return {
    pane: { paneId: id, sessionId: `s${id}`, started: true },
    workspaceId: "w",
    title: `title-${id}`,
    ended: false,
    prompted: true,
    ...over,
  };
}

// 1 | (2 over 3), 30/70, the right side 40/60.
const three: Layout = {
  split: "right",
  ratio: 0.3,
  first: { pane: "1" },
  second: { split: "down", ratio: 0.4, first: { pane: "2" }, second: { pane: "3" } },
};

describe("snapshotOf (SRS-FR-084)", () => {
  it("keeps every prompted, live pane with its place", () => {
    expect(snapshotOf(three, [e("1"), e("2"), e("3")])).toEqual({
      version: 1,
      layout: three,
      panes: {
        "1": { workspaceId: "w", sessionId: "s1", title: "title-1" },
        "2": { workspaceId: "w", sessionId: "s2", title: "title-2" },
        "3": { workspaceId: "w", sessionId: "s3", title: "title-3" },
      },
    });
  });

  it("leaves out ended, not started and never prompted panes, keeping the other ratios", () => {
    const snapshot = snapshotOf(three, [e("1"), e("2", { ended: true }), e("3")]);
    expect(snapshot!.layout).toEqual({ split: "right", ratio: 0.3, first: { pane: "1" }, second: { pane: "3" } });
    expect(Object.keys(snapshot!.panes)).toEqual(["1", "3"]);

    expect(snapshotOf(three, [e("1", { pane: { paneId: "1", sessionId: "s1", started: false } }), e("2"), e("3")])!.layout).toEqual(
      three.second,
    );
    expect(Object.keys(snapshotOf(three, [e("1"), e("2", { prompted: false, title: "(untitled)" }), e("3")])!.panes)).toEqual(["1", "3"]);
  });

  it("counts a pane that got a title as prompted", () => {
    expect(Object.keys(snapshotOf(three, [e("1", { prompted: false }), e("2"), e("3")])!.panes)).toEqual(["1", "2", "3"]);
    expect(Object.keys(snapshotOf(three, [e("1", { prompted: false, title: "(untitled)" }), e("2"), e("3")])!.panes)).toEqual([
      "2",
      "3",
    ]);
  });

  it("has nothing to keep without panes", () => {
    expect(snapshotOf(null, [])).toBeNull();
    expect(snapshotOf({ pane: "1" }, [e("1", { ended: true })])).toBeNull();
  });
});

describe("rebuildLayout (SRS-FR-085, SRS-FR-086)", () => {
  it("renames the reopened panes and gives the space of the others to their neighbours", () => {
    expect(rebuildLayout(three, { "1": "p7", "2": null, "3": "p8" })).toEqual({
      split: "right",
      ratio: 0.3,
      first: { pane: "p7" },
      second: { pane: "p8" },
    });
  });

  it("has no layout when nothing reopened", () => {
    expect(rebuildLayout(three, { "1": null, "2": null, "3": null })).toBeNull();
  });
});

describe("readSnapshot / writeSnapshot", () => {
  afterEach(() => localStorage.clear());

  it("reads back what it wrote, and nothing after a null write", () => {
    const snapshot = snapshotOf(three, [e("1"), e("2"), e("3")]);
    writeSnapshot(snapshot);
    expect(readSnapshot()).toEqual(snapshot);
    writeSnapshot(null);
    expect(readSnapshot()).toBeNull();
  });

  it("ignores missing, broken and unknown-version data", () => {
    expect(readSnapshot()).toBeNull();
    localStorage.setItem("adOpenPanes", "{not json");
    expect(readSnapshot()).toBeNull();
    localStorage.setItem("adOpenPanes", JSON.stringify({ version: 2, layout: { pane: "1" }, panes: {} }));
    expect(readSnapshot()).toBeNull();
    localStorage.setItem("adOpenPanes", JSON.stringify({ version: 1, layout: { pane: "1" }, panes: {} }));
    expect(readSnapshot()).toBeNull();
  });
});
