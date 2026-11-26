import { describe, expect, it } from "vitest";
import { answerSteps } from "./dialogAnswer";
import type { Dialog } from "./dialogScreen";

const permission: Dialog = { kind: "permission", title: "Bash command", subject: "touch a.txt", command: "touch a.txt", yes: "1", no: "4" };
const question: Dialog = {
  kind: "question",
  question: "Which?",
  options: [
    { label: "zod", key: "1" },
    { label: "yup", key: "2" },
  ],
  other: "3",
  otherLabel: "Type something.",
  cursor: "1",
};
const plan: Dialog = { kind: "plan", approve: "2", keepPlanning: "3", keepPlanningLabel: "Tell Claude what to change", cursor: "1", plan: null };

describe("answerSteps", () => {
  it("allows and denies a permission with its digits", () => {
    expect(answerSteps(permission, { kind: "allow" })).toEqual({ key: "1" });
    expect(answerSteps(permission, { kind: "deny" })).toEqual({ key: "4" });
  });

  it("answers a question option with its key", () => {
    expect(answerSteps(question, { kind: "option", key: "2" })).toEqual({ key: "2" });
  });

  it("answers Khác with its digit, then the text", () => {
    expect(answerSteps(question, { kind: "other", text: "valibot" })).toEqual({ key: "3", text: "valibot" });
  });

  it("approves a plan with its digit", () => {
    expect(answerSteps(plan, { kind: "approvePlan" })).toEqual({ key: "2" });
  });

  it("keeps planning with its digit, then the feedback", () => {
    expect(answerSteps(plan, { kind: "keepPlanning", feedback: "add a test" })).toEqual({ key: "3", text: "add a test" });
  });

  it("turns newlines into single spaces and trims", () => {
    expect(answerSteps(question, { kind: "other", text: "  one\ntwo\r\nthree\rfour  " })).toEqual({ key: "3", text: "one two three four" });
    expect(answerSteps(plan, { kind: "keepPlanning", feedback: "a\n\nb" })).toEqual({ key: "3", text: "a b" });
  });

  it("turns tabs into spaces, so Tab cannot reach Tab to amend", () => {
    expect(answerSteps(question, { kind: "other", text: "a\tb\t\tc" })).toEqual({ key: "3", text: "a b c" });
    expect(answerSteps(plan, { kind: "keepPlanning", feedback: "\tx\t" })).toEqual({ key: "3", text: "x" });
  });

  it("strips control characters", () => {
    expect(answerSteps(question, { kind: "other", text: "va\x1b[201~li\x00bot\x7f" })).toEqual({ key: "3", text: "va[201~libot" });
  });

  it("refuses empty text", () => {
    expect(answerSteps(question, { kind: "other", text: "" })).toBeNull();
    expect(answerSteps(question, { kind: "other", text: " \n\t\x1b " })).toBeNull();
    expect(answerSteps(plan, { kind: "keepPlanning", feedback: "\r\n" })).toBeNull();
  });

  it("refuses a choice that does not fit the dialog", () => {
    expect(answerSteps(permission, { kind: "option", key: "1" })).toBeNull();
    expect(answerSteps(permission, { kind: "approvePlan" })).toBeNull();
    expect(answerSteps(question, { kind: "allow" })).toBeNull();
    expect(answerSteps(plan, { kind: "deny" })).toBeNull();
    expect(answerSteps(plan, { kind: "other", text: "x" })).toBeNull();
    expect(answerSteps({ kind: "other" }, { kind: "allow" })).toBeNull();
    expect(answerSteps({ kind: "none" }, { kind: "approvePlan" })).toBeNull();
  });

  it("refuses an option key the question does not have", () => {
    expect(answerSteps(question, { kind: "option", key: "3" })).toBeNull();
  });
});
