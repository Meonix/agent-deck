import { normalisePrompt } from "./composerLogic";
import type { Dialog } from "./dialogScreen";

export type Choice =
  | { kind: "allow" }
  | { kind: "deny" }
  | { kind: "option"; key: string }
  | { kind: "other"; text: string }
  | { kind: "approvePlan" }
  | { kind: "keepPlanning"; feedback: string };

// Claude Code's answer field is one line and submits at the first `\r`, so newlines become spaces.
const oneLine = (text: string) => normalisePrompt(text).replace(/\n+/g, " ").trim();

const typed = (key: string, text: string) => {
  const line = oneLine(text);
  return line === "" ? null : `${key}${line}\r`;
};

/** null when the choice cannot answer this dialog (wrong kind, or empty text). (SRS-FR-164, SRS-FR-167) */
export function answerBytes(dialog: Dialog, choice: Choice): string | null {
  switch (dialog.kind) {
    case "permission":
      if (choice.kind === "allow") return dialog.yes;
      if (choice.kind === "deny") return dialog.no;
      return null;
    case "question":
      if (choice.kind === "option") return dialog.options.some((o) => o.key === choice.key) ? choice.key : null;
      if (choice.kind === "other") return typed(dialog.other, choice.text);
      return null;
    case "plan":
      if (choice.kind === "approvePlan") return dialog.approve;
      if (choice.kind === "keepPlanning") return typed(dialog.keepPlanning, choice.feedback);
      return null;
    default:
      return null;
  }
}
