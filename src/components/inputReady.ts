import type { SessionState } from "../api/sessions";
import type { ScreenLine } from "./TerminalPane";

export type Readiness =
  | { ready: true }
  | { ready: false; reason: "approval" | "unrecognized" | "running" | "ended" };

const PROMPT_ROW = /^❯(?:[  ]|$)/;
const CHOICE_ROW = /^\s*❯ \d+\. /;
const DIALOG_WORDS = ["Esc to cancel", "Enter to confirm", "Enter to select", "Do you want to proceed?"];

const isDialogRow = ({ text }: ScreenLine) => CHOICE_ROW.test(text) || DIALOG_WORDS.some((w) => text.includes(w));

// A blank continuation row has been trimmed to nothing.
const isContinuation = ({ text }: ScreenLine) => text === "" || text.startsWith("  ");

// The placeholder's spaces are drawn with cursor moves, so they are not dim cells.
const isEntirelyDim = ({ text, dim }: ScreenLine) => text.split("").every((c, i) => /\s/.test(c) || dim[i]);

/**
 * Whether Claude Code's input box is empty and no dialog is showing (RULE-12, SRS-FR-155).
 * `cols` is the terminal's width; combining marks make a row longer in code units than in cells.
 */
export function inputReadiness(screen: ScreenLine[], state: SessionState, cols: number): Readiness {
  if (state === "Ended") return { ready: false, reason: "ended" };
  if (state === "Needs Approval") return { ready: false, reason: "approval" };

  const isRule = (line: ScreenLine | undefined) =>
    line !== undefined && /^─+$/.test(line.text) && line.text.length * 2 >= cols;

  let prompt = screen.length - 1;
  while (prompt >= 0 && !PROMPT_ROW.test(screen[prompt].text)) prompt--;
  const opened = prompt > 0 && isRule(screen[prompt - 1]);

  if ((opened ? screen.slice(prompt) : screen).some(isDialogRow)) return { ready: false, reason: "approval" };
  if (state === "Running") return { ready: false, reason: "running" };
  if (!opened) return { ready: false, reason: "unrecognized" };

  let close = prompt + 1;
  while (close < screen.length && isContinuation(screen[close])) close++;
  if (!isRule(screen[close])) return { ready: false, reason: "unrecognized" };

  const row = screen[prompt];
  const input = [{ text: row.text.slice(1), dim: row.dim.slice(1) }, ...screen.slice(prompt + 1, close)];
  return input.every(isEntirelyDim) ? { ready: true } : { ready: false, reason: "unrecognized" };
}
