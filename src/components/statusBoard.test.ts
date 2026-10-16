import { describe, expect, it } from "vitest";
import type { PaneStatus } from "../api/sessions";
import { boardCards } from "./statusBoard";
import type { PaneEntry } from "./TerminalPane";

function e(id: string, status: Partial<PaneStatus>): PaneEntry {
  return {
    pane: { paneId: id, sessionId: `s${id}`, started: true },
    workspaceId: "w",
    openedAt: 1,
    workspaceName: `ws-${id}`,
    adapter: null,
    stream: {} as PaneEntry["stream"],
    openedSize: { cols: 80, rows: 24 },
    ended: false,
    title: `title-${id}`,
    graceOver: false,
    status: { state: "Idle", since: 1, reason: null, tracked: true, reportedAt: null, ...status },
  };
}

describe("boardCards (4.1)", () => {
  it("groups tracked Running, Needs Approval and Error panes and keeps pane order", () => {
    const cards = boardCards([
      e("1", { state: "Running", since: 10, reason: "Bash npm test" }),
      e("2", { state: "Needs Approval", reason: "Edit a" }),
      e("3", { state: "Idle" }),
      e("4", { state: "Running", tracked: false }),
      e("5", { state: "Error", reason: "overloaded" }),
      e("6", { state: "Running" }),
      e("7", { state: "Ended" }),
    ]);
    expect(cards.Running.map((c) => c.paneId)).toEqual(["1", "6"]);
    expect(cards["Needs Approval"].map((c) => c.paneId)).toEqual(["2"]);
    expect(cards.Error.map((c) => c.paneId)).toEqual(["5"]);
    expect(cards.Running[0]).toEqual({
      paneId: "1",
      workspaceName: "ws-1",
      title: "title-1",
      since: 10,
      reason: "Bash npm test",
    });
  });
});
