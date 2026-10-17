import { describe, expect, it } from "vitest";
import type { PaneStatus } from "../api/sessions";
import { activeSessions, folderHighlights, maximizedBadge } from "./statusHighlight";
import type { PaneEntry } from "./TerminalPane";

function e(id: string, workspaceId: string, status: Partial<PaneStatus>, sessionId = `s${id}`, ended = false): PaneEntry {
  return {
    pane: { paneId: id, sessionId, started: true },
    workspaceId,
    openedAt: 1,
    workspaceName: `ws-${workspaceId}`,
    adapter: null,
    stream: {} as PaneEntry["stream"],
    openedSize: { cols: 80, rows: 24 },
    ended,
    title: `title-${id}`,
    graceOver: false,
    status: { state: "Idle", since: 1, reason: null, tracked: true, reportedAt: null, ...status },
    shell: null,
    shellFailed: false,
  };
}

describe("a session resumed after its pane ended", () => {
  // Pane 1 crashed (Error, ended) and its session was resumed in pane 2, which is Idle.
  const entries = () => [
    e("1", "w", { state: "Error", reason: "exit code 1" }, "s-crashed", true),
    e("2", "w", { state: "Idle" }, "s-crashed"),
  ];

  it("does not count the ended pane in its folder", () => {
    expect(folderHighlights(entries()).has("w")).toBe(false);
  });
});

describe("folderHighlights (1.1)", () => {
  it("takes the most urgent state of each folder and counts its sessions in that state", () => {
    const folders = folderHighlights([
      e("1", "mokairo", { state: "Running" }),
      e("2", "mokairo", { state: "Error" }),
      e("3", "mokairo", { state: "Running" }),
      e("4", "agent-deck", { state: "Running" }),
      e("5", "agent-deck", { state: "Needs Approval" }),
      e("6", "agent-deck", { state: "Needs Approval" }),
      e("7", "k3s", { state: "Running" }),
      e("8", "k3s", { state: "Running" }),
    ]);
    expect(folders.get("mokairo")).toEqual({ state: "Error", count: 1 });
    expect(folders.get("agent-deck")).toEqual({ state: "Needs Approval", count: 2 });
    expect(folders.get("k3s")).toEqual({ state: "Running", count: 2 });
  });

  it("leaves out a folder whose sessions are Idle, Ended or untracked", () => {
    const folders = folderHighlights([
      e("1", "quiet", { state: "Idle" }),
      e("2", "quiet", { state: "Ended" }),
      e("3", "quiet", { state: "Error", tracked: false }),
    ]);
    expect(folders.has("quiet")).toBe(false);
  });
});

describe("maximizedBadge (1.1)", () => {
  it("counts the other sessions that need the user and takes the Error colour if any", () => {
    const badge = maximizedBadge(
      [
        e("1", "w", { state: "Needs Approval" }),
        e("2", "w", { state: "Needs Approval", since: 200 }),
        e("3", "v", { state: "Error", since: 500 }),
        e("4", "w", { state: "Running" }),
        e("5", "w", { state: "Error", tracked: false }),
        e("6", "w", { state: "Idle" }),
      ],
      "1",
    );
    expect(badge).toEqual({ count: 2, state: "Error", paneId: "3" });
  });

  it("uses the Needs Approval colour and the session waiting longest when nothing failed", () => {
    const badge = maximizedBadge(
      [
        e("1", "w", { state: "Running" }),
        e("2", "w", { state: "Needs Approval", since: 1405 }),
        e("3", "w", { state: "Needs Approval", since: 1400 }),
      ],
      "1",
    );
    expect(badge).toEqual({ count: 2, state: "Needs Approval", paneId: "3" });
  });

  it("is null when only the maximized pane or running sessions need nothing", () => {
    expect(maximizedBadge([e("1", "w", { state: "Needs Approval" }), e("2", "w", { state: "Running" })], "1")).toBeNull();
  });

  it("ignores an ended pane whose session was resumed in the maximized pane", () => {
    const entries = [
      e("1", "w", { state: "Error", reason: "exit code 1" }, "s-crashed", true),
      e("2", "w", { state: "Idle" }, "s-crashed"),
    ];
    expect(maximizedBadge(entries, "2")).toBeNull();
  });
});

describe("activeSessions (1.1)", () => {
  const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

  it("lists the session of every started pane across folders, with its folder name (SRS-FR-051)", () => {
    const unstarted = e("3", "w", {});
    unstarted.pane.started = false;
    const rows = activeSessions([e("1", "a", {}), e("2", "b", {}), unstarted]);
    expect(rows.map((r) => [r.title, r.workspaceName, r.paneId])).toEqual([
      ["title-1", "ws-a", "1"],
      ["title-2", "ws-b", "2"],
    ]);
  });

  it("keeps a pane whose session ended, as Ended (SRS-FR-051)", () => {
    const rows = activeSessions([e("1", "w", { state: "Ended" }, "s1", true)]);
    expect(rows.map((r) => r.state)).toEqual(["Ended"]);
  });

  it("puts Error, Needs Approval, Running, Idle, Ended in that order (SRS-FR-052)", () => {
    const rows = activeSessions([
      e("1", "w", { state: "Running", since: 1400 }),
      e("2", "w", { state: "Idle", since: 1 }),
      e("3", "w", { state: "Ended" }, "s3", true),
      e("4", "w", { state: "Error", since: 1405 }),
      e("5", "w", { state: "Needs Approval", since: 1403 }),
    ]);
    expect(titles(rows)).toEqual(["title-4", "title-5", "title-1", "title-2", "title-3"]);
  });

  it("puts the session that entered the state first on top within one state (SRS-FR-052)", () => {
    const rows = activeSessions([
      e("1", "w", { state: "Needs Approval", since: 1403 }),
      e("2", "w", { state: "Needs Approval", since: 1401 }),
    ]);
    expect(titles(rows)).toEqual(["title-2", "title-1"]);
  });

  it("counts an untracked pane as Idle, without highlight (SRS-FR-036)", () => {
    const rows = activeSessions([
      e("1", "w", { state: "Running", tracked: false }),
      e("2", "w", { state: "Running", since: 5 }),
    ]);
    expect(rows.map((r) => [r.title, r.state, r.highlighted])).toEqual([
      ["title-2", "Running", true],
      ["title-1", "Idle", false],
    ]);
  });

  it("highlights Running, Needs Approval and Error rows only and keeps their reason (SRS-FR-032)", () => {
    const rows = activeSessions([
      e("1", "w", { state: "Error", since: 9, reason: "overloaded" }),
      e("2", "w", { state: "Idle" }),
    ]);
    expect(rows[0]).toMatchObject({ state: "Error", since: 9, reason: "overloaded", highlighted: true });
    expect(rows[1].highlighted).toBe(false);
  });

  it("shows a resumed session once, through its live pane", () => {
    const rows = activeSessions([
      e("1", "w", { state: "Error" }, "s-crashed", true),
      e("2", "w", { state: "Idle" }, "s-crashed"),
    ]);
    expect(rows.map((r) => [r.paneId, r.state])).toEqual([["2", "Idle"]]);
    const reversed = activeSessions([e("2", "w", { state: "Idle" }, "s-crashed"), e("1", "w", { state: "Error" }, "s-crashed", true)]);
    expect(reversed.map((r) => r.paneId)).toEqual(["2"]);
  });

  it("keeps the ended pane when resuming its session failed to start", () => {
    const failed = e("2", "w", {}, "s-crashed");
    failed.pane.started = false;
    const rows = activeSessions([e("1", "w", { state: "Ended" }, "s-crashed", true), failed]);
    expect(rows.map((r) => [r.paneId, r.state])).toEqual([["1", "Ended"]]);
  });
});
