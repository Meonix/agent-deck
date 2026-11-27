import { afterEach, describe, expect, it, vi } from "vitest";
import { listenForDrops, registerDropTarget, routeDrop } from "./dropTargets";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function twoPanes() {
  document.body.innerHTML = `<div data-pane-id="p1"><span id="a"></span></div><div data-pane-id="p2"><span id="b"></span></div><p id="out"></p>`;
  const el = (id: string) => document.getElementById(id);
  const t1 = vi.fn();
  const t2 = vi.fn();
  const offs = [registerDropTarget("p1", t1), registerDropTarget("p2", t2)];
  return { el, t1, t2, offs };
}

describe("routeDrop", () => {
  it("delivers to the pane under the pointer only", () => {
    const { el, t1, t2, offs } = twoPanes();
    expect(routeDrop(["/a", "/b"], { x: 10, y: 10 }, 1, () => el("b"))).toBe(true);
    expect(t2).toHaveBeenCalledWith(["/a", "/b"]);
    expect(t1).not.toHaveBeenCalled();
    offs.forEach((off) => off());
  });

  it("divides the physical position by the scale", () => {
    const { el, offs } = twoPanes();
    const hit = vi.fn(() => el("a"));
    routeDrop(["/a"], { x: 300, y: 200 }, 2, hit);
    expect(hit).toHaveBeenCalledWith(150, 100);
    offs.forEach((off) => off());
  });

  it("does nothing when no element or no pane is under the pointer", () => {
    const { el, t1, t2, offs } = twoPanes();
    expect(routeDrop(["/a"], { x: 1, y: 1 }, 1, () => null)).toBe(false);
    expect(routeDrop(["/a"], { x: 1, y: 1 }, 1, () => el("out"))).toBe(false);
    expect(t1).not.toHaveBeenCalled();
    expect(t2).not.toHaveBeenCalled();
    offs.forEach((off) => off());
  });

  it("stops delivering after unregister", () => {
    const { el, t2, offs } = twoPanes();
    offs[1]();
    expect(routeDrop(["/a"], { x: 1, y: 1 }, 1, () => el("b"))).toBe(false);
    expect(t2).not.toHaveBeenCalled();
    offs[0]();
  });
});

describe("listenForDrops", () => {
  it("ignores enter, over and leave and routes drop", async () => {
    const { el, t1, offs } = twoPanes();
    // jsdom has no elementFromPoint.
    document.elementFromPoint = () => el("a");
    let cb!: Parameters<Parameters<typeof listenForDrops>[0]>[0];
    const unlisten = vi.fn();
    const stop = listenForDrops(async (c) => {
      cb = c;
      return unlisten;
    });
    await Promise.resolve();
    cb({ payload: { type: "enter", paths: ["/x"], position: { x: 1, y: 1 } } });
    cb({ payload: { type: "over", position: { x: 1, y: 1 } } });
    cb({ payload: { type: "leave" } });
    expect(t1).not.toHaveBeenCalled();
    cb({ payload: { type: "drop", paths: ["/x"], position: { x: 1, y: 1 } } });
    expect(t1).toHaveBeenCalledWith(["/x"]);
    stop();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
    offs.forEach((off) => off());
  });

  it("unlistens when cleanup runs before the listen promise resolves", async () => {
    const unlisten = vi.fn();
    let resolve!: (f: () => void) => void;
    const stop = listenForDrops(() => new Promise((r) => (resolve = r)));
    stop();
    expect(unlisten).not.toHaveBeenCalled();
    resolve(unlisten);
    await Promise.resolve();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
