import { normalisePrompt } from "./composerLogic";
import type { Dialog } from "./dialogScreen";

export type Choice =
  | { kind: "allow" }
  | { kind: "deny" }
  | { kind: "option"; key: string }
  | { kind: "other"; text: string }
  | { kind: "approvePlan" }
  | { kind: "keepPlanning"; feedback: string };

/**
 * The digit that answers, and for a typed answer the text that goes into the field after it. Written in
 * one chunk, the digit and the text answered the first option (measured), so they are written apart.
 */
export type Steps = { key: string; text?: string };

// Claude Code's answer field is one line and submits at the first `\r`, so newlines become spaces;
// so do tabs, which the dialog reads as "Tab to amend".
const oneLine = (text: string) => normalisePrompt(text).replace(/[\n\t]+/g, " ").trim();

const typed = (key: string, text: string): Steps | null => {
  const line = oneLine(text);
  return line === "" ? null : { key, text: line };
};

/** null when the choice cannot answer this dialog (wrong kind, or empty text). (SRS-FR-164, SRS-FR-167) */
export function answerSteps(dialog: Dialog, choice: Choice): Steps | null {
  switch (dialog.kind) {
    case "permission":
      if (choice.kind === "allow") return { key: dialog.yes };
      if (choice.kind === "deny") return { key: dialog.no };
      return null;
    case "question":
      if (choice.kind === "option") return dialog.options.some((o) => o.key === choice.key) ? { key: choice.key } : null;
      if (choice.kind === "other") return typed(dialog.other, choice.text);
      return null;
    case "plan":
      if (choice.kind === "approvePlan") return { key: dialog.approve };
      if (choice.kind === "keepPlanning") return typed(dialog.keepPlanning, choice.feedback);
      return null;
    default:
      return null;
  }
}
