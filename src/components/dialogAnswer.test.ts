import { describe, expect, it } from "vitest";
import { answerBytes } from "./dialogAnswer";
import type { Dialog } from "./dialogScreen";

const permission: Dialog = { kind: "permission", command: "touch a.txt", yes: "1", no: "4" };
const question: Dialog = {
  kind: "question",
  question: "Which?",
  options: [
    { label: "zod", key: "1" },
    { label: "yup", key: "2" },
  ],
  other: "3",
};
const plan: Dialog = { kind: "plan", approve: "2", keepPlanning: "3" };

describe("answerBytes", () => {
  it("allows and denies a permission with its digits", () => {
    expect(answerBytes(permission, { kind: "allow" })).toBe("1");
    expect(answerBytes(permission, { kind: "deny" })).toBe("4");
  });

  it("answers a question option with its key", () => {
    expect(answerBytes(question, { kind: "option", key: "2" })).toBe("2");
  });

  it("answers Khác with its digit, the text and Enter", () => {
    expect(answerBytes(question, { kind: "other", text: "valibot" })).toBe("3valibot\r");
  });

  it("approves a plan with its digit", () => {
    expect(answerBytes(plan, { kind: "approvePlan" })).toBe("2");
  });

  it("keeps planning with its digit, the feedback and Enter", () => {
    expect(answerBytes(plan, { kind: "keepPlanning", feedback: "add a test" })).toBe("3add a test\r");
  });

  it("turns newlines into single spaces and trims", () => {
    expect(answerBytes(question, { kind: "other", text: "  one\ntwo\r\nthree\rfour  " })).toBe("3one two three four\r");
    expect(answerBytes(plan, { kind: "keepPlanning", feedback: "a\n\nb" })).toBe("3a b\r");
  });

  it("turns tabs into spaces, so Tab cannot reach Tab to amend", () => {
    expect(answerBytes(question, { kind: "other", text: "a\tb\t\tc" })).toBe("3a b c\r");
    expect(answerBytes(plan, { kind: "keepPlanning", feedback: "\tx\t" })).toBe("3x\r");
  });

  it("strips control characters", () => {
    expect(answerBytes(question, { kind: "other", text: "va\x1b[201~li\x00bot\x7f" })).toBe("3va[201~libot\r");
  });

  it("refuses empty text", () => {
    expect(answerBytes(question, { kind: "other", text: "" })).toBeNull();
    expect(answerBytes(question, { kind: "other", text: " \n\t\x1b " })).toBeNull();
    expect(answerBytes(plan, { kind: "keepPlanning", feedback: "\r\n" })).toBeNull();
  });

  it("refuses a choice that does not fit the dialog", () => {
    expect(answerBytes(permission, { kind: "option", key: "1" })).toBeNull();
    expect(answerBytes(permission, { kind: "approvePlan" })).toBeNull();
    expect(answerBytes(question, { kind: "allow" })).toBeNull();
    expect(answerBytes(plan, { kind: "deny" })).toBeNull();
    expect(answerBytes(plan, { kind: "other", text: "x" })).toBeNull();
    expect(answerBytes({ kind: "other" }, { kind: "allow" })).toBeNull();
    expect(answerBytes({ kind: "none" }, { kind: "approvePlan" })).toBeNull();
  });

  it("refuses an option key the question does not have", () => {
    expect(answerBytes(question, { kind: "option", key: "3" })).toBeNull();
  });
});
