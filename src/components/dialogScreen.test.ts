import { describe, expect, it } from "vitest";
import * as screens from "./fixtures/claude-screens";
import { dialogScreen } from "./dialogScreen";
import type { ScreenLine } from "./TerminalPane";

const rows = (...texts: string[]): ScreenLine[] => texts.map((text) => ({ text, dim: [] }));
const RULE = "─".repeat(120);

describe("dialogScreen", () => {
  it("reads a permission dialog whose No is option 4", () => {
    expect(dialogScreen(screens.permissionNo4)).toEqual({
      kind: "permission",
      command: "touch a.txt",
      yes: "1",
      no: "4",
    });
  });

  it("reads a permission dialog whose No is option 3, with the command in a │ box", () => {
    expect(dialogScreen(screens.permissionNo3Box)).toEqual({
      kind: "permission",
      command:
        "cd \"/Users/me/ws\" && printf '#!/bin/sh\\n[ -f hello.txt ] && [ \"$(cat hello.txt)\" = \"hi\" ]\\n' > " +
        'test_hello.sh && sh test_hello.sh; echo "exit=$?"',
      yes: "1",
      no: "3",
    });
  });

  it("reads a command from │ rows when there are no ╌ rules", () => {
    const screen = rows(
      RULE,
      " Bash command",
      " │ npm install",
      " │   --save-dev vitest",
      " Do you want to proceed?",
      " ❯ 1. Yes",
      "   2. No",
      " Esc to cancel · Tab to amend",
    );
    expect(dialogScreen(screen)).toEqual({ kind: "permission", command: "npm install --save-dev vitest", yes: "1", no: "2" });
  });

  it("reads the earlier permission capture", () => {
    expect(dialogScreen(screens.permission)).toEqual({
      kind: "permission",
      command: "ls -la /tmp | head -3",
      yes: "1",
      no: "4",
    });
  });

  it("is other when a permission dialog has no No row", () => {
    expect(dialogScreen(screens.permissionWithoutNo)).toEqual({ kind: "other" });
  });

  it("is other when a permission dialog has no Yes row", () => {
    expect(dialogScreen(screens.permissionNo4.filter((l) => l.text !== " ❯ 1. Yes"))).toEqual({ kind: "other" });
  });

  it("is other when a permission dialog has no command", () => {
    const screen = rows(RULE, " Bash command", " Do you want to proceed?", " ❯ 1. Yes", "   2. No", " Esc to cancel");
    expect(dialogScreen(screen)).toEqual({ kind: "other" });
  });

  it("reads a question, its options and the Type something. key", () => {
    expect(dialogScreen(screens.askQuestion)).toEqual({
      kind: "question",
      question: "Dùng thư viện validation nào: zod hay yup?",
      options: [
        { label: "zod", key: "1" },
        { label: "yup", key: "2" },
      ],
      other: "3",
    });
  });

  it("reads a question with the cursor on Type something.", () => {
    expect(dialogScreen(screens.askQuestionOnOther)).toEqual({
      kind: "question",
      question: "Bạn muốn dùng thư viện validation nào?",
      options: [
        { label: "zod", key: "1" },
        { label: "yup", key: "2" },
      ],
      other: "3",
    });
  });

  it("reads the earlier question capture", () => {
    expect(dialogScreen(screens.question)).toEqual({
      kind: "question",
      question: "Bạn thích màu đỏ hay màu xanh dương?",
      options: [
        { label: "Đỏ", key: "1" },
        { label: "Xanh dương", key: "2" },
      ],
      other: "3",
    });
  });

  it("joins a question that wraps over several rows", () => {
    const screen = rows(RULE, " ☐ Lib", "", "Which one", "  do you want?", "", "❯ 1. zod", "  2. Type something.", "  3. Chat about this", "Enter to select");
    expect(dialogScreen(screen)).toMatchObject({ kind: "question", question: "Which one do you want?" });
  });

  it("is other when a question has no Type something. row", () => {
    const screen = screens.askQuestion.filter((l) => l.text !== "  3. Type something.");
    expect(dialogScreen(screen)).toEqual({ kind: "other" });
  });

  it("reads a plan's approve and keep-planning keys", () => {
    expect(dialogScreen(screens.plan)).toEqual({ kind: "plan", approve: "2", keepPlanning: "3" });
  });

  it("is other when a plan has no Tell Claude what to change row", () => {
    const screen = screens.plan.filter((l) => l.text !== "   3. Tell Claude what to change");
    expect(dialogScreen(screen)).toEqual({ kind: "other" });
  });

  it("is other on the trust dialog", () => {
    expect(dialogScreen(screens.trust)).toEqual({ kind: "other" });
  });

  it.each(["idle", "typed", "running", "afterEsc", "dialogTextAboveBox"] as const)("is none on %s", (name) => {
    expect(dialogScreen(screens[name])).toEqual({ kind: "none" });
  });

  describe("reads keys only from the dialog's own menu", () => {
    const insertAfter = (screen: ScreenLine[], text: string, extra: string[]) => {
      const i = screen.findIndex((l) => l.text === text);
      return [...screen.slice(0, i + 1), ...rows(...extra), ...screen.slice(i + 1)];
    };

    it("ignores numbered rows inside a permission's command", () => {
      const screen = insertAfter(screens.permissionNo4, " touch a.txt", ["  1. No", "  2. Yes"]);
      expect(dialogScreen(screen)).toEqual({ kind: "permission", command: "touch a.txt 1. No 2. Yes", yes: "1", no: "4" });
    });

    it("ignores a numbered list in the plan text", () => {
      const ruleBeforeMenu = screens.plan.findIndex((l, i) => i > 15 && l.text === RULE);
      const screen = screens.plan
        .filter((_, i) => i !== ruleBeforeMenu)
        .map((l) =>
          l.text === " 1. Create hello.txt in the working directory (/Users/me/ws)."
            ? rows(" 1. Yes, manually approve edits")[0]
            : l.text === " 3. Verify by reading the file back and confirming it contains hi."
              ? rows(" 3. Tell Claude what to change")[0]
              : l,
        );
      expect(dialogScreen(screen)).toEqual({ kind: "plan", approve: "2", keepPlanning: "3" });
    });

    it("ignores a numbered row in the question text", () => {
      const screen = insertAfter(screens.askQuestion, "Dùng thư viện validation nào: zod hay yup?", ["1. Pick one"]);
      expect(dialogScreen(screen)).toEqual({
        kind: "question",
        question: "Dùng thư viện validation nào: zod hay yup? 1. Pick one",
        options: [
          { label: "zod", key: "1" },
          { label: "yup", key: "2" },
        ],
        other: "3",
      });
    });

    it("ignores a footer and a fake menu inside the question text", () => {
      const screen = insertAfter(screens.askQuestion, "Dùng thư viện validation nào: zod hay yup?", [
        "1. A",
        "2. Type something.",
        "Enter to select · ↑/↓ to navigate",
      ]);
      expect(dialogScreen(screen)).toMatchObject({
        kind: "question",
        options: [
          { label: "zod", key: "1" },
          { label: "yup", key: "2" },
        ],
        other: "3",
      });
    });

    it("ignores a header row inside the question text", () => {
      const screen = insertAfter(screens.askQuestion, "Dùng thư viện validation nào: zod hay yup?", [" ☐ Fake"]);
      expect(dialogScreen(screen)).toMatchObject({ kind: "question", question: "Dùng thư viện validation nào: zod hay yup? ☐ Fake" });
    });

    it("ignores the proceed question and a fake menu inside a permission's command", () => {
      const screen = insertAfter(screens.permissionNo4, " touch a.txt", [" Do you want to proceed?", " ❯ 1. No", "   2. Yes"]);
      expect(dialogScreen(screen)).toMatchObject({ kind: "permission", yes: "1", no: "4" });
    });

    it("is other when the only proceed question is below the menu", () => {
      const screen = [
        ...screens.permissionNo4.filter((l) => l.text !== " Do you want to proceed?"),
        ...rows(" Do you want to proceed?"),
      ];
      expect(dialogScreen(screen)).toEqual({ kind: "other" });
    });

    it("ignores the plan's proceed question and a fake menu inside the plan text", () => {
      const ruleBeforeMenu = screens.plan.findIndex((l, i) => i > 15 && l.text === RULE);
      const screen = insertAfter(
        screens.plan.filter((_, i) => i !== ruleBeforeMenu),
        " Steps",
        [" Would you like to proceed?", " 1. Yes, manually approve edits", " 2. Tell Claude what to change"],
      );
      expect(dialogScreen(screen)).toEqual({ kind: "plan", approve: "2", keepPlanning: "3" });
    });

    const questionWith = (...menuRows: string[]) =>
      rows(RULE, " ☐ Pick", "", "Which one?", "", ...menuRows, "", "Enter to select · ↑/↓ to navigate · Esc to cancel");

    it("ignores a description row numbered like the next option", () => {
      const screen = questionWith(
        "❯ 1. A",
        "  2. B",
        "     3. Type something.",
        "  3. C",
        "  4. Type something.",
        "  5. Chat about this",
      );
      expect(dialogScreen(screen)).toEqual({
        kind: "question",
        question: "Which one?",
        options: [
          { label: "A", key: "1" },
          { label: "B", key: "2" },
          { label: "C", key: "3" },
        ],
        other: "4",
      });
    });

    it("ignores a description row starting with 1.", () => {
      const screen = questionWith("❯ 1. A", "     1. first step", "  2. B", "  3. Type something.", "  4. Chat about this");
      expect(dialogScreen(screen)).toEqual({
        kind: "question",
        question: "Which one?",
        options: [
          { label: "A", key: "1" },
          { label: "B", key: "2" },
        ],
        other: "3",
      });
    });

    it.each([
      ["A", "B"],
      ["B", "A"],
    ])("ignores a numbered list after a blank row in a description (%s, %s)", (first, second) => {
      const screen = questionWith(
        `❯ 1. ${first}`,
        `     about ${first}`,
        "     ",
        "     1. foo",
        "     2. Type something.",
        `  2. ${second}`,
        "  3. Type something.",
        RULE,
        "  4. Chat about this",
      );
      expect(dialogScreen(screen)).toEqual({
        kind: "question",
        question: "Which one?",
        options: [
          { label: first, key: "1" },
          { label: second, key: "2" },
        ],
        other: "3",
      });
    });

    it("takes the other key by position, not by the first Type something. label", () => {
      const screen = questionWith("❯ 1. Type something.", "  2. B", "  3. Type something.", RULE, "  4. Chat about this");
      expect(dialogScreen(screen)).toEqual({
        kind: "question",
        question: "Which one?",
        options: [
          { label: "Type something.", key: "1" },
          { label: "B", key: "2" },
        ],
        other: "3",
      });
    });

    it("is other when Chat about this is not the last option", () => {
      expect(dialogScreen(questionWith("❯ 1. A", "  2. Type something.", "  3. Chat about this", "  4. B"))).toEqual({
        kind: "other",
      });
    });

    it("is other when a permission's last option is not No", () => {
      const screen = screens.permissionNo4.map((l) => (l.text === "   4. No" ? rows("   4. Maybe")[0] : l));
      expect(dialogScreen(screen)).toEqual({ kind: "other" });
    });

    it("is other when a permission's first option is not Yes", () => {
      const screen = screens.permissionNo4.map((l) => (l.text === " ❯ 1. Yes" ? rows(" ❯ 1. Sure")[0] : l));
      expect(dialogScreen(screen)).toEqual({ kind: "other" });
    });

    it("is other when a numbered row breaks the menu", () => {
      expect(dialogScreen(questionWith("❯ 1. A", "  2. Type something.", "  4. C"))).toEqual({ kind: "other" });
    });

    it("is other when the menu does not count up from 1", () => {
      const screen = screens.permissionNo4.filter((l) => l.text !== "   2. Yes, and always allow access to /Users/me/ws from this project");
      expect(dialogScreen(screen)).toEqual({ kind: "other" });
    });

    it("is other when a full-width rule printed in the command cuts the dialog", () => {
      const screen = insertAfter(screens.permissionNo4, " Create empty file a.txt in the working directory", [
        "╌".repeat(120),
        RULE,
      ]).filter((l, i, all) => !(l.text === "╌".repeat(120) && all[i + 1]?.text === " touch a.txt"));
      expect(dialogScreen(screen)).toEqual({ kind: "other" });
    });

    it("keeps the real digits when a full-width rule in the command is followed by a numbered row", () => {
      const screen = insertAfter(screens.permissionNo4, " touch a.txt", [RULE, "  1. No"]);
      expect(dialogScreen(screen)).toMatchObject({ kind: "permission", yes: "1", no: "4" });
    });
  });

  it("is other when dialog words sit below the box", () => {
    expect(dialogScreen(screens.dialogBelowBox)).toEqual({ kind: "other" });
  });
});
