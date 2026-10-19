import { describe, expect, it } from "vitest";
import { sidebarShortcut } from "./sidebarToggle";

const key = (k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("sidebarShortcut (SRS-FR-089)", () => {
  it("is Cmd+B on macOS and Ctrl+B on Windows", () => {
    expect(sidebarShortcut(key("b", { metaKey: true }), true)).toBe(true);
    expect(sidebarShortcut(key("b", { ctrlKey: true }), false)).toBe(true);
  });

  it("leaves the other modifier to the terminal", () => {
    expect(sidebarShortcut(key("b", { ctrlKey: true }), true)).toBe(false);
    expect(sidebarShortcut(key("b", { metaKey: true }), false)).toBe(false);
    expect(sidebarShortcut(key("b", { metaKey: true, ctrlKey: true }), true)).toBe(false);
  });

  it("ignores Ctrl+H, a bare B, and B with Shift or Alt", () => {
    expect(sidebarShortcut(key("h", { ctrlKey: true }), false)).toBe(false);
    expect(sidebarShortcut(key("h", { metaKey: true }), true)).toBe(false);
    expect(sidebarShortcut(key("b"), true)).toBe(false);
    expect(sidebarShortcut(key("B", { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(sidebarShortcut(key("b", { metaKey: true, altKey: true }), true)).toBe(false);
  });

  it("matches an upper-case B from Caps Lock", () => {
    expect(sidebarShortcut(key("B", { metaKey: true }), true)).toBe(true);
  });
});
