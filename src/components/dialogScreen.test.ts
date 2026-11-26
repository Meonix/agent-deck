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
    const screen = rows(RULE, " ☐ Lib", "", "Which one", "  do you want?", "", "❯ 1. zod", "  2. Type something.", "Enter to select");
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

  it("is other when dialog words sit below the box", () => {
    expect(dialogScreen(screens.dialogBelowBox)).toEqual({ kind: "other" });
  });
});
