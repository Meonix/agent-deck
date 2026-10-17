import { describe, expect, it } from "vitest";
import type { PaneStatus } from "../api/sessions";
import { folderHighlights, maximizedBadge, sessionHighlights } from "./statusHighlight";
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
  };
}

describe("sessionHighlights (1.1)", () => {
  it("highlights tracked Running, Needs Approval and Error sessions only", () => {
    const highlights = sessionHighlights([
      e("1", "w", { state: "Running", since: 10, reason: "Bash npm test" }),
      e("2", "w", { state: "Needs Approval", reason: "Edit a" }),
      e("3", "w", { state: "Idle" }),
      e("4", "w", { state: "Running", tracked: false }),
      e("5", "w", { state: "Error", reason: "overloaded" }),
      e("7", "w", { state: "Ended" }),
    ]);
    expect([...highlights.keys()]).toEqual(["s1", "s2", "s5"]);
    expect(highlights.get("s1")).toEqual({ paneId: "1", state: "Running", since: 10, reason: "Bash npm test" });
    expect(highlights.get("s2")?.state).toBe("Needs Approval");
    expect(highlights.get("s5")?.state).toBe("Error");
  });
});

describe("a session resumed after its pane ended", () => {
  // Pane 1 crashed (Error, ended) and its session was resumed in pane 2, which is Idle.
  const entries = () => [
    e("1", "w", { state: "Error", reason: "exit code 1" }, "s-crashed", true),
    e("2", "w", { state: "Idle" }, "s-crashed"),
  ];

  it("follows the live pane, not the ended one", () => {
    expect(sessionHighlights(entries()).has("s-crashed")).toBe(false);
  });

  it("does not count the ended pane in its folder", () => {
    expect(folderHighlights(entries()).has("w")).toBe(false);
  });

  it("jumps to the live pane once it is highlighted", () => {
    const [ended, live] = entries();
    live.status = { ...live.status, state: "Needs Approval" };
    expect(sessionHighlights([ended, live]).get("s-crashed")?.paneId).toBe("2");
    expect(sessionHighlights([live, ended]).get("s-crashed")?.paneId).toBe("2");
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
