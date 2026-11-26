import { describe, expect, it } from "vitest";
import { activityParts, applyChat, initialChat, type ChatItem } from "./chatState";

const prompt = (key: string, text = key): ChatItem => ({ kind: "prompt", key, text });
const tool = (key: string, id: string): ChatItem => ({ kind: "tool", key, id, name: "Bash", arg: "ls" });
const result = (key: string, toolId: string, isError = false): ChatItem => ({ kind: "result", key, toolId, text: "out", isError });

describe("applyChat (5.2)", () => {
  it("starts loading with nothing", () => {
    expect(initialChat).toEqual({ loading: true, unreadable: false, items: [], held: {} });
  });

  it("a reset ends loading and replaces all items", () => {
    const a = applyChat(initialChat, { reset: true, items: [prompt("a")] });
    expect(a.loading).toBe(false);
    const b = applyChat(a, { reset: true, items: [prompt("b")] });
    expect(b.items.map((i) => i.key)).toEqual(["b"]);
  });

  it("a reset clears unreadable", () => {
    const u = applyChat(initialChat, { unreadable: true });
    expect(applyChat(u, { reset: true, items: [] }).unreadable).toBe(false);
  });

  it("appends keep order", () => {
    const a = applyChat(initialChat, { reset: true, items: [prompt("a")] });
    const b = applyChat(a, { items: [prompt("b"), { kind: "reply", key: "c", text: "c" }] });
    expect(b.items.map((i) => i.key)).toEqual(["a", "b", "c"]);
  });

  it("attaches a result to its tool", () => {
    const s = applyChat(initialChat, { reset: true, items: [tool("t", "id1"), result("r", "id1", true)] });
    expect(s.items).toEqual([{ kind: "tool", key: "t", id: "id1", name: "Bash", arg: "ls", result: { text: "out", isError: true } }]);
  });

  it("attaches a result that came before its tool", () => {
    const a = applyChat(initialChat, { reset: true, items: [result("r", "id1")] });
    expect(a.items).toEqual([]);
    const b = applyChat(a, { items: [tool("t", "id1")] });
    expect(b.items[0]).toMatchObject({ kind: "tool", result: { text: "out", isError: false } });
  });

  it("keeps an orphan result through unreadable", () => {
    const a = applyChat(initialChat, { reset: true, items: [result("r", "id1")] });
    const b = applyChat(a, { unreadable: true });
    const c = applyChat(b, { items: [tool("t", "id1")] });
    expect(c.items[0]).toMatchObject({ result: { text: "out" } });
  });

  it("a reset clears an orphan result", () => {
    const a = applyChat(initialChat, { items: [result("r", "id1")] });
    const b = applyChat(a, { reset: true, items: [] });
    expect(applyChat(b, { items: [tool("t", "id1")] }).items[0]).toMatchObject({ result: null });
  });

  it("holds an orphan across several appends", () => {
    let s = applyChat(initialChat, { items: [result("r", "id1")] });
    s = applyChat(s, { items: [prompt("a")] });
    s = applyChat(s, { items: [prompt("b")] });
    s = applyChat(s, { items: [tool("t", "id1")] });
    expect(s.items[2]).toMatchObject({ kind: "tool", result: { text: "out" } });
    expect(s.held).toEqual({});
  });

  it("a tool without a result has result null", () => {
    expect(applyChat(initialChat, { items: [tool("t", "id1")] }).items[0]).toMatchObject({ result: null });
  });

  it("drops duplicate keys", () => {
    const a = applyChat(initialChat, { items: [prompt("a"), prompt("a", "again")] });
    const b = applyChat(a, { items: [prompt("a", "third")] });
    expect(b.items).toHaveLength(1);
    expect(b.items[0]).toMatchObject({ text: "a" });
  });

  it("unreadable sets the flag and ends loading", () => {
    expect(applyChat(initialChat, { unreadable: true })).toMatchObject({ loading: false, unreadable: true });
  });

  it("does not mutate its input", () => {
    const a = applyChat(initialChat, { items: [tool("t", "id1")] });
    const frozen = JSON.stringify(a);
    applyChat(a, { items: [result("r", "id1")] });
    expect(JSON.stringify(a)).toBe(frozen);
    expect(JSON.stringify(initialChat)).toBe('{"loading":true,"unreadable":false,"items":[],"held":{}}');
  });
});

describe("activityParts (5.2)", () => {
  const base = { tool: null, arg: null, context: null, shells: 0, subagents: 0 };

  it("lists the count parts in order", () => {
    expect(activityParts({ tool: "Bash", arg: "npm test", context: 42, shells: 1, subagents: 2 })).toEqual([
      "42% context",
      "1 shell",
      "2 subagent",
    ]);
  });

  it("leaves out unknown parts and zero counts", () => {
    expect(activityParts({ ...base, context: 7, subagents: 3 })).toEqual(["7% context", "3 subagent"]);
    expect(activityParts({ ...base, tool: "Read" })).toEqual([]);
  });
});
