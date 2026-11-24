import { describe, expect, it } from "vitest";
import { labels } from "../labels";
import { formatWhen, mergeSessions } from "./sessionList";

describe("formatWhen", () => {
  const now = new Date(2026, 9, 16, 14, 0).getTime();
  const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m, d, h, min).getTime();

  it("labels recent times like the design", () => {
    expect(formatWhen(now - 20_000, now)).toBe(labels.justNow);
    expect(formatWhen(now - 2 * 60_000, now)).toBe(labels.minutesAgo(2));
    expect(formatWhen(now - 59 * 60_000, now)).toBe(labels.minutesAgo(59));
    expect(formatWhen(now - 60 * 60_000, now)).toBe(labels.hoursAgo(1));
    expect(formatWhen(at(2026, 9, 15, 15), now)).toBe(labels.hoursAgo(23));
    expect(formatWhen(at(2026, 9, 15, 9), now)).toBe(labels.yesterday);
    expect(formatWhen(at(2026, 9, 13, 9), now)).toBe(labels.daysAgo(3));
    expect(formatWhen(at(2026, 9, 7, 9), now)).toBe(labels.lastWeek);
    expect(formatWhen(at(2026, 9, 2, 9), now)).toBe(labels.date(2, 10));
    expect(formatWhen(at(2025, 11, 30, 9), now)).toBe(labels.dateWithYear(30, 12, 2025));
  });

  it("says hours, not yesterday, for a time earlier the same day (the branch a 25-hour DST day needs)", () => {
    const longDay = new Date(2026, 9, 25, 23, 50).getTime();
    expect(formatWhen(new Date(2026, 9, 25, 0, 10).getTime(), longDay)).toMatch(new RegExp(`^${labels.hoursAgo(0).replace("0", "\\d+")}$`));
  });

  it("treats a time in the future as now", () => {
    expect(formatWhen(now + 5_000, now)).toBe(labels.justNow);
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
