import { describe, expect, it } from "vitest";
import { nextTextSize, storedTextSize, zoomAction } from "./textZoom";

type Keys = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };
const press = (k: Keys) => ({ metaKey: false, ctrlKey: false, altKey: false, ...k });

describe("zoomAction (SRS-FR-068, SRS-FR-069, SRS-FR-070)", () => {
  it("reads Cmd on macOS and Ctrl elsewhere", () => {
    expect(zoomAction(press({ key: "=", metaKey: true }), true)).toBe("in");
    expect(zoomAction(press({ key: "+", metaKey: true }), true)).toBe("in");
    expect(zoomAction(press({ key: "-", metaKey: true }), true)).toBe("out");
    expect(zoomAction(press({ key: "0", metaKey: true }), true)).toBe("reset");
    expect(zoomAction(press({ key: "=", ctrlKey: true }), false)).toBe("in");
    expect(zoomAction(press({ key: "+", ctrlKey: true }), false)).toBe("in");
    expect(zoomAction(press({ key: "-", ctrlKey: true }), false)).toBe("out");
    expect(zoomAction(press({ key: "0", ctrlKey: true }), false)).toBe("reset");
  });

  it("leaves Ctrl on macOS and Win on Windows to the terminal", () => {
    expect(zoomAction(press({ key: "-", ctrlKey: true }), true)).toBeNull();
    expect(zoomAction(press({ key: "=", metaKey: true }), false)).toBeNull();
  });

  it("ignores other modifiers, other keys and plain keys", () => {
    expect(zoomAction(press({ key: "=", metaKey: true, ctrlKey: true }), true)).toBeNull();
    expect(zoomAction(press({ key: "=", metaKey: true, altKey: true }), true)).toBeNull();
    expect(zoomAction(press({ key: "c", metaKey: true }), true)).toBeNull();
    expect(zoomAction(press({ key: "=" }), true)).toBeNull();
  });
});

describe("nextTextSize (SRS-FR-068, SRS-FR-069, SRS-FR-070)", () => {
  it("steps by 10 percentage points", () => {
    expect(nextTextSize(1, "in")).toBe(1.1);
    expect(nextTextSize(1.1, "in")).toBe(1.2);
    expect(nextTextSize(1, "out")).toBe(0.9);
  });

  it("stops at 200% and 50%", () => {
    expect(nextTextSize(2, "in")).toBe(2);
    expect(nextTextSize(0.5, "out")).toBe(0.5);
  });

  it("lands exactly on 200% after ten steps from 100%", () => {
    let size = 1;
    for (let i = 0; i < 10; i++) size = nextTextSize(size, "in");
    expect(size).toBe(2);
  });

  it("goes back to 100% on reset", () => {
    expect(nextTextSize(1.5, "reset")).toBe(1);
  });
});

describe("storedTextSize (SRS-FR-071)", () => {
  it("keeps a stored size on the grid inside the range", () => {
    expect(storedTextSize("1.3")).toBe(1.3);
    expect(storedTextSize("0.5")).toBe(0.5);
    expect(storedTextSize("2")).toBe(2);
  });

  it("falls back to 100% for anything else", () => {
    for (const raw of [null, "", "abc", "3", "0.4", "0.55", "NaN"]) expect(storedTextSize(raw)).toBe(1);
  });
});
