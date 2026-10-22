import { afterEach, describe, expect, it } from "vitest";
import { type StashedSession, addStashed, pruneStashed, readStash, removeStashed, writeStash } from "./stash";

function s(id: string, over: Partial<StashedSession> = {}): StashedSession {
  return { sessionId: id, workspaceId: "w", workspaceName: "mokairo", title: `title-${id}`, stashedAt: 1, ...over };
}

describe("addStashed (SRS-FR-106)", () => {
  it("puts the newest stash first", () => {
    expect(addStashed([s("a")], s("b")).map((x) => x.sessionId)).toEqual(["b", "a"]);
  });

  it("keeps one row per session, moved to the top", () => {
    const list = addStashed([s("b"), s("a", { title: "old" })], s("a", { title: "new", stashedAt: 2 }));
    expect(list.map((x) => [x.sessionId, x.title])).toEqual([
      ["a", "new"],
      ["b", "title-b"],
    ]);
  });
});

describe("removeStashed (SRS-FR-110)", () => {
  it("drops only that session", () => {
    expect(removeStashed([s("a"), s("b")], "a").map((x) => x.sessionId)).toEqual(["b"]);
  });

  it("returns the same list when the session is not stashed", () => {
    const list = [s("a")];
    expect(removeStashed(list, "z")).toBe(list);
  });
});

describe("pruneStashed (SRS-FR-112)", () => {
  it("drops rows of the listed workspace whose session is gone, keeping other workspaces", () => {
    const list = [s("a"), s("b"), s("c", { workspaceId: "other" })];
    expect(pruneStashed(list, "w", ["b"]).map((x) => x.sessionId)).toEqual(["b", "c"]);
  });

  it("returns the same list when nothing is gone", () => {
    const list = [s("a")];
    expect(pruneStashed(list, "w", ["a", "x"])).toBe(list);
  });
});

describe("readStash / writeStash (SRS-FR-111)", () => {
  afterEach(() => localStorage.clear());

  it("reads back what was written, in order", () => {
    writeStash([s("b"), s("a")]);
    expect(readStash().map((x) => x.sessionId)).toEqual(["b", "a"]);
  });

  it("reads nothing stored as empty", () => {
    expect(readStash()).toEqual([]);
  });

  it("reads a corrupt or foreign value as empty", () => {
    localStorage.setItem("adStashedSessions", "{not json");
    expect(readStash()).toEqual([]);
    localStorage.setItem("adStashedSessions", JSON.stringify({ version: 99, sessions: [s("a")] }));
    expect(readStash()).toEqual([]);
    localStorage.setItem("adStashedSessions", JSON.stringify({ version: 1, sessions: [{ sessionId: 3 }] }));
    expect(readStash()).toEqual([]);
  });
});
