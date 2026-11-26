import { describe, expect, it } from "vitest";
import type { PaneStatus, SessionState } from "../api/sessions";
import type { Workspace } from "../api/workspaces";
import type { StashedSession } from "./stash";
import { folderTree, maximizedBadge, needsUser } from "./statusHighlight";
import type { PaneEntry } from "./TerminalPane";
import { initialChat } from "./chatState";

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
    status: { state: "Idle", since: 1, reason: null, tracked: true, ...status },
    chat: initialChat,
    activity: null,
    shell: null,
    shellFailed: false,
    prompted: false,
    view: "term",
    returnView: "term",
  };
}

describe("needsUser", () => {
  it("is true for Error and Needs Approval only", () => {
    const states: SessionState[] = ["Running", "Needs Approval", "Idle", "Error", "Ended"];
    expect(states.map((s) => [s, needsUser(s)])).toEqual([
      ["Running", false],
      ["Needs Approval", true],
      ["Idle", false],
      ["Error", true],
      ["Ended", false],
    ]);
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

const w = (id: string, missing = false): Workspace => ({ id, name: id, path: `/p/${id}`, missing });

describe("folderTree", () => {
  const LIST = [w("agent-deck"), w("mokairo"), w("notes")];
  const tree = (entries: PaneEntry[], workspaces = LIST, stashed: StashedSession[] = []) => folderTree(entries, workspaces, stashed);
  const order = (entries: PaneEntry[], workspaces = LIST) => tree(entries, workspaces).open.map((n) => n.workspace.id);
  const titles = (entries: PaneEntry[]) => tree(entries).open[0].rows.map((r) => r.title);

  describe("rows and order (1.1)", () => {
    it("nests each session under its workspace, with no workspace name on the row (SRS-FR-051)", () => {
      const unstarted = e("3", "agent-deck", {});
      unstarted.pane.started = false;
      const { open } = tree([e("1", "agent-deck", {}), e("2", "mokairo", {}), unstarted]);
      expect(open.map((n) => [n.workspace.id, n.rows.map((r) => r.paneId)])).toEqual([
        ["agent-deck", ["1"]],
        ["mokairo", ["2"]],
      ]);
      expect(open[0].rows[0]).not.toHaveProperty("workspaceName");
    });

    it("keeps a pane whose session ended, as Ended, until it is closed (SRS-FR-051)", () => {
      const { open } = tree([e("1", "agent-deck", { state: "Ended" }, "s1", true)]);
      expect(open[0].rows.map((r) => r.state)).toEqual(["Ended"]);
    });

    it("puts workspaces with a session in Needs Approval or Error first, the rest in Workspace List order (SRS-FR-052)", () => {
      const running = e("1", "agent-deck", { state: "Running" });
      expect(order([running, e("2", "mokairo", { state: "Error" }), e("3", "notes", { state: "Idle" })])).toEqual(["mokairo", "agent-deck", "notes"]);
      // Both urgent workspaces keep Workspace List order among themselves.
      expect(order([e("1", "notes", { state: "Error" }), e("2", "agent-deck", { state: "Idle" }), e("3", "mokairo", { state: "Needs Approval" })])).toEqual([
        "mokairo",
        "notes",
        "agent-deck",
      ]);
      expect(order([e("1", "mokairo", { state: "Running" }), e("2", "agent-deck", { state: "Idle" })])).toEqual(["agent-deck", "mokairo"]);
    });

    it("orders rows Error, Needs Approval, Running, Idle, Ended, then by time entered (SRS-FR-052)", () => {
      expect(
        titles([
          e("1", "agent-deck", { state: "Running", since: 1400 }),
          e("2", "agent-deck", { state: "Idle", since: 1 }),
          e("3", "agent-deck", { state: "Ended" }, "s3", true),
          e("4", "agent-deck", { state: "Error", since: 1405 }),
          e("5", "agent-deck", { state: "Needs Approval", since: 1403 }),
          e("6", "agent-deck", { state: "Needs Approval", since: 1401 }),
        ]),
      ).toEqual(["title-4", "title-6", "title-5", "title-1", "title-2", "title-3"]);
    });

    it("orders an untracked pane with the Idle rows, without highlight (SRS-FR-036)", () => {
      const { open } = tree([e("1", "agent-deck", { state: "Error", tracked: false }), e("2", "agent-deck", { state: "Running", since: 5 })]);
      expect(open[0].rows.map((r) => [r.title, r.state, r.highlighted])).toEqual([
        ["title-2", "Running", false],
        ["title-1", "Idle", false],
      ]);
      expect(order([e("1", "mokairo", { state: "Error", tracked: false }), e("2", "agent-deck", {})])).toEqual(["agent-deck", "mokairo"]);
    });

    it("highlights Needs Approval and Error rows and keeps their time and reason (SRS-FR-032, SRS-FR-033)", () => {
      const { open } = tree([e("1", "agent-deck", { state: "Error", since: 9, reason: "overloaded" }), e("2", "agent-deck", { state: "Running" })]);
      expect(open[0].rows[0]).toMatchObject({ state: "Error", since: 9, reason: "overloaded", highlighted: true });
      expect(open[0].rows[1].highlighted).toBe(false);
    });
  });

  describe("count (1.2, SRS-FR-040)", () => {
    const count = (entries: PaneEntry[]) => tree(entries).open[0].count;

    it("counts Error and Needs Approval together in the Error colour", () => {
      expect(
        count([
          e("1", "agent-deck", { state: "Error" }),
          e("2", "agent-deck", { state: "Needs Approval" }),
          e("3", "agent-deck", { state: "Running" }),
          e("4", "agent-deck", { state: "Running" }),
        ]),
      ).toEqual({ n: 2, tone: "Error" });
    });

    it("takes the Needs Approval colour when only approvals wait", () => {
      expect(count([e("1", "agent-deck", { state: "Needs Approval" }), e("2", "agent-deck", { state: "Running" })])).toEqual({
        n: 1,
        tone: "Needs Approval",
      });
    });

    it("counts the open sessions in grey when nothing needs the user", () => {
      expect(count([e("1", "agent-deck", { state: "Idle" }), e("2", "agent-deck", { state: "Idle" })])).toEqual({ n: 2, tone: "grey" });
      expect(count([e("1", "agent-deck", { state: "Running" }), e("2", "agent-deck", { state: "Idle" })])).toEqual({ n: 2, tone: "grey" });
    });

    it("counts an untracked pane only in the grey number", () => {
      const untracked = () => e("1", "agent-deck", { state: "Error", tracked: false });
      expect(count([untracked(), e("2", "agent-deck", { state: "Needs Approval" })])).toEqual({ n: 1, tone: "Needs Approval" });
      expect(count([untracked(), e("2", "agent-deck", { state: "Idle" })])).toEqual({ n: 2, tone: "grey" });
    });
  });

  describe("Other Folders and stash (1.3)", () => {
    it("puts every workspace with no started pane in other, in Workspace List order, Missing included (SRS-FR-141)", () => {
      const unstarted = e("2", "notes", {});
      unstarted.pane.started = false;
      const list = [w("agent-deck"), w("gone", true), w("mokairo"), w("notes")];
      expect(tree([], list).other.map((x) => x.id)).toEqual(["agent-deck", "gone", "mokairo", "notes"]);
      expect(tree([], list).open).toEqual([]);
      expect(tree([e("1", "mokairo", {}), unstarted], list).other.map((x) => x.id)).toEqual(["agent-deck", "gone", "notes"]);
    });

    it("keeps the newest-first order of the stash list (SRS-FR-106)", () => {
      const row = (id: string, stashedAt: number): StashedSession => ({
        sessionId: id,
        workspaceId: "mokairo",
        workspaceName: "mokairo",
        title: id,
        stashedAt,
      });
      const stashed = [row("newer", 2), row("older", 1)];
      expect(tree([], LIST, stashed).stash).toEqual(stashed);
    });
  });

  describe("a resumed session (1.4)", () => {
    it("shows a resumed session once, through its live pane", () => {
      const ended = () => e("1", "agent-deck", { state: "Error" }, "s-crashed", true);
      const live = () => e("2", "agent-deck", { state: "Idle" }, "s-crashed");
      expect(tree([ended(), live()]).open[0].rows.map((r) => [r.paneId, r.state])).toEqual([["2", "Idle"]]);
      expect(tree([live(), ended()]).open[0].rows.map((r) => r.paneId)).toEqual(["2"]);
    });

    it("keeps the ended pane when resuming its session failed to start", () => {
      const failed = e("2", "agent-deck", {}, "s-crashed");
      failed.pane.started = false;
      const { open } = tree([e("1", "agent-deck", { state: "Ended" }, "s-crashed", true), failed]);
      expect(open[0].rows.map((r) => [r.paneId, r.state])).toEqual([["1", "Ended"]]);
    });

    it("does not count the ended pane in its folder", () => {
      const crashed = (ws: string) => [
        e("1", ws, { state: "Error", reason: "exit code 1" }, "s-crashed", true),
        e("2", ws, { state: "Idle" }, "s-crashed"),
      ];
      expect(tree(crashed("agent-deck")).open[0].count).toEqual({ n: 1, tone: "grey" });
      expect(order([...crashed("mokairo"), e("3", "agent-deck", {})])).toEqual(["agent-deck", "mokairo"]);
    });
  });
});
