import { describe, expect, it } from "vitest";
import type { CommandItem, FileEntry } from "../api/sessions";
import {
  BUILTIN_COMMANDS,
  FILE_ROWS,
  apply,
  matchCommands,
  matchFiles,
  mergeCommands,
  trigger,
} from "./suggestions";

describe("trigger", () => {
  it("opens the command menu for a leading slash word", () => {
    expect(trigger("/com", 4)).toEqual({ kind: "command", query: "com", start: 0, end: 4 });
    expect(trigger("/", 1)).toEqual({ kind: "command", query: "", start: 0, end: 1 });
  });

  it("opens the file menu for an @ word", () => {
    expect(trigger("Xem lại @src/comp", 17)).toEqual({ kind: "file", query: "src/comp", start: 8, end: 17 });
    expect(trigger("@", 1)).toEqual({ kind: "file", query: "", start: 0, end: 1 });
  });

  it("ignores slashes and @ inside a word", () => {
    expect(trigger("sửa a/b", 7)).toBeNull();
    expect(trigger("a@b", 3)).toBeNull();
  });

  it("closes the command menu once whitespace follows the command", () => {
    expect(trigger("/commit x", 9)).toBeNull();
  });
});

describe("BUILTIN_COMMANDS", () => {
  it("holds the 112 measured built-ins", () => {
    expect(BUILTIN_COMMANDS).toHaveLength(112);
    expect(BUILTIN_COMMANDS.every((c) => c.source === "builtin")).toBe(true);
    const names = BUILTIN_COMMANDS.map((c) => c.name);
    expect(names).toContain("clear");
    expect(names).toContain("compact");
    expect(BUILTIN_COMMANDS.find((c) => c.name === "model")?.description).toBe("Switch model");
  });
});

describe("mergeCommands / matchCommands", () => {
  const commit: CommandItem = { name: "commit", description: "…", source: "user-skill" };
  const mk = (name: string): CommandItem => ({ name, description: "", source: "plugin" });

  it("keeps the first of two same-named commands", () => {
    const a: CommandItem = { name: "x", description: "a", source: "builtin" };
    const b: CommandItem = { name: "x", description: "b", source: "plugin" };
    expect(mergeCommands([a], [b])).toEqual([a]);
  });

  it("matches built-in and fetched names by prefix", () => {
    const names = matchCommands(mergeCommands(BUILTIN_COMMANDS, [commit]), "com").map((c) => c.name);
    expect(names).toContain("compact");
    expect(names).toContain("commit");
  });

  it("matches the part after the last colon", () => {
    const item = mk("superpowers:brainstorming");
    expect(matchCommands([item], "brain")).toEqual([item]);
  });

  it("puts prefix matches before after-colon matches, each sorted", () => {
    const items = [mk("z:review"), mk("a:review"), mk("review-x"), mk("review")];
    expect(matchCommands(items, "rev").map((c) => c.name)).toEqual(["review", "review-x", "a:review", "z:review"]);
  });

  it("is case-insensitive", () => {
    const items = [mk("Commit")];
    expect(matchCommands(items, "COM")).toEqual(items);
  });

  it("returns everything sorted for an empty query", () => {
    expect(matchCommands([mk("b"), mk("a")], "").map((c) => c.name)).toEqual(["a", "b"]);
  });
});

describe("matchFiles", () => {
  const f = (path: string): FileEntry => ({ path, dir: path.endsWith("/") });

  it("ranks name prefix, then path prefix, then the rest", () => {
    const entries = [
      f("src/components/AppShell.tsx"),
      f("docs/app-notes.md"),
      f("src/App.test.tsx"),
      f("src/components/"),
      f("src/App.tsx"),
    ];
    expect(matchFiles(entries, "App").map((e) => e.path)).toEqual([
      "src/App.tsx",
      "src/App.test.tsx",
      "docs/app-notes.md",
      "src/components/AppShell.tsx",
    ]);
  });

  it("ranks a path prefix above an inner match", () => {
    const entries = [f("lib/src/x.ts"), f("src/deep/x.ts")];
    expect(matchFiles(entries, "src/").map((e) => e.path)).toEqual(["src/deep/x.ts", "lib/src/x.ts"]);
  });

  it("uses the last part before the slash as a folder's name", () => {
    expect(matchFiles([f("zz/aa/zeta.ts"), f("a/b/zeta/")], "zet")[0].path).toBe("a/b/zeta/");
  });

  it("caps the rows", () => {
    const entries = Array.from({ length: 20 }, (_, i) => f(`src/App${String(i).padStart(2, "0")}.ts`));
    expect(matchFiles(entries, "App")).toHaveLength(FILE_ROWS);
  });

  it("returns the shortest paths first for an empty query", () => {
    const entries = [f("long/path/file.ts"), f("b.ts"), f("a.ts")];
    expect(matchFiles(entries, "").map((e) => e.path)).toEqual(["a.ts", "b.ts", "long/path/file.ts"]);
  });
});

describe("apply", () => {
  const file = (path: string): { kind: "file"; entry: FileEntry } => ({
    kind: "file",
    entry: { path, dir: path.endsWith("/") },
  });

  it("completes a command and adds a space", () => {
    const t = { kind: "command" as const, query: "comm", start: 0, end: 5 };
    expect(apply("/comm", t, { kind: "command", name: "commit" })).toEqual({ text: "/commit ", caret: 8 });
  });

  it("completes a file and adds a space", () => {
    const t = { kind: "file" as const, query: "src/comp", start: 8, end: 17 };
    const out = apply("Xem lại @src/comp", t, file("src/components/PaneGrid.tsx"));
    expect(out.text).toBe("Xem lại @src/components/PaneGrid.tsx ");
    expect(out.caret).toBe(out.text.length);
  });

  it("adds no space after a folder", () => {
    const t = { kind: "file" as const, query: "src/comp", start: 8, end: 17 };
    const out = apply("Xem lại @src/comp", t, file("src/components/"));
    expect(out.text).toBe("Xem lại @src/components/");
    expect(out.caret).toBe(out.text.length);
  });

  it("replaces the rest of the word and keeps existing whitespace", () => {
    const t = { kind: "file" as const, query: "sr", start: 0, end: 3 };
    expect(apply("@sr x", t, file("src/a.ts"))).toEqual({ text: "@src/a.ts x", caret: 10 });
  });
});
