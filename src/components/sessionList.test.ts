import { describe, expect, it } from "vitest";
import { formatWhen, mergeSessions } from "./sessionList";

describe("formatWhen", () => {
  const now = new Date(2026, 9, 16, 14, 0).getTime();
  const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m, d, h, min).getTime();

  it("labels recent times like the design", () => {
    expect(formatWhen(now - 20_000, now)).toBe("Just now");
    expect(formatWhen(now - 2 * 60_000, now)).toBe("2 min ago");
    expect(formatWhen(now - 59 * 60_000, now)).toBe("59 min ago");
    expect(formatWhen(now - 60 * 60_000, now)).toBe("1 h ago");
    expect(formatWhen(at(2026, 9, 15, 15), now)).toBe("23 h ago");
    expect(formatWhen(at(2026, 9, 15, 9), now)).toBe("Yesterday");
    expect(formatWhen(at(2026, 9, 13, 9), now)).toBe("3 days ago");
    expect(formatWhen(at(2026, 9, 7, 9), now)).toBe("Last week");
    expect(formatWhen(at(2026, 9, 2, 9), now)).toBe("Oct 2");
    expect(formatWhen(at(2025, 11, 30, 9), now)).toBe("Dec 30, 2025");
  });

  it("never says Yesterday for the same calendar day, even on a 25-hour day", () => {
    const longDay = new Date(2026, 9, 25, 23, 50).getTime();
    expect(formatWhen(new Date(2026, 9, 25, 0, 10).getTime(), longDay)).toMatch(/h ago$/);
  });

  it("treats a time in the future as now", () => {
    expect(formatWhen(now + 5_000, now)).toBe("Just now");
  });
});

describe("mergeSessions", () => {
  const scanned = [
    { id: "b", title: "Scaffold Tauri app", lastActivity: 300 },
    { id: "a", title: "Init repo", lastActivity: 100 },
  ];

  it("keeps the scan order and marks sessions open in a pane as Live", () => {
    const rows = mergeSessions(scanned, [{ sessionId: "a", workspaceId: "w", title: "(untitled)", openedAt: 50 }], "w");
    expect(rows.map((r) => [r.id, r.title, r.live])).toEqual([
      ["b", "Scaffold Tauri app", false],
      ["a", "Init repo", true],
    ]);
  });

  it("adds a new pane session missing from the scan, newest first, with the pane title", () => {
    const rows = mergeSessions(scanned, [{ sessionId: "n", workspaceId: "w", title: "Fix login", openedAt: 400 }], "w");
    expect(rows.map((r) => [r.id, r.title, r.lastActivity, r.live])).toEqual([
      ["n", "Fix login", 400, true],
      ["b", "Scaffold Tauri app", 300, false],
      ["a", "Init repo", 100, false],
    ]);
  });

  it("ignores panes of other workspaces and prefers a real pane title", () => {
    const rows = mergeSessions(
      scanned,
      [
        { sessionId: "x", workspaceId: "other", title: "Elsewhere", openedAt: 999 },
        { sessionId: "b", workspaceId: "w", title: "Renamed by Claude", openedAt: 1 },
      ],
      "w",
    );
    expect(rows.map((r) => [r.id, r.title])).toEqual([
      ["b", "Renamed by Claude"],
      ["a", "Init repo"],
    ]);
  });
});
