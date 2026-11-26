import { isDialogRow } from "./inputReady";
import type { ScreenLine } from "./TerminalPane";

export type Dialog =
  | { kind: "none" }
  | { kind: "other" }
  | { kind: "permission"; command: string; yes: string; no: string }
  | { kind: "question"; question: string; options: { label: string; key: string }[]; other: string }
  | { kind: "plan"; approve: string; keepPlanning: string };

const OPTION_ROW = /^\s*(?:❯ )?(\d+)\. (.+)$/;
const DASH_RULE = /^╌+$/;
const BOX_ROW = /^│ ?/;
const OTHER_LABEL = "Type something.";
const CHAT_LABEL = "Chat about this";

type Option = { label: string; key: string };

const option = (text: string): Option | null => {
  const match = OPTION_ROW.exec(text);
  return match ? { label: match[2], key: match[1] } : null;
};

const keyOf = (rows: string[], label: string) => rows.map(option).find((o) => o?.label === label)?.key;

const joined = (rows: string[]) =>
  rows
    .map((row) => row.trim())
    .filter((row) => row !== "")
    .join(" ");

/**
 * The rows of the dialog: those below the last full-width rule. A rule right before a numbered
 * option (short `─` rows aside) only separates a question's options, so it does not start the dialog.
 */
function dialogRows(screen: ScreenLine[]): string[] {
  const rows = screen.map((line) => line.text.trimEnd());
  const width = Math.max(0, ...rows.map((row) => row.length));
  const isRule = (row: string) => /^─+$/.test(row) && row.length * 2 >= width;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isRule(rows[i])) continue;
    let next = i + 1;
    while (next < rows.length && /^─+$/.test(rows[next])) next++;
    if (next < rows.length && OPTION_ROW.test(rows[next])) continue;
    return rows.slice(i + 1);
  }
  return rows;
}

function permission(rows: string[]): Dialog {
  const yes = keyOf(rows, "Yes");
  const no = keyOf(rows, "No");
  const start = rows.findIndex((row) => DASH_RULE.test(row.trim()));
  const end = start < 0 ? -1 : rows.findIndex((row, i) => i > start && DASH_RULE.test(row.trim()));
  const body = end < 0 ? rows.filter((row) => BOX_ROW.test(row.trim())) : rows.slice(start + 1, end);
  const command = joined(body.map((row) => row.trim().replace(BOX_ROW, "")));
  return yes && no && command ? { kind: "permission", command, yes, no } : { kind: "other" };
}

function question(rows: string[]): Dialog {
  const header = rows.findIndex((row) => /^\s*☐ /.test(row));
  const first = rows.findIndex((row, i) => i > header && OPTION_ROW.test(row));
  const text = header < 0 || first < 0 ? "" : joined(rows.slice(header + 1, first));
  const other = keyOf(rows, OTHER_LABEL);
  const options = rows
    .map(option)
    .filter((o): o is Option => o !== null && o.label !== OTHER_LABEL && o.label !== CHAT_LABEL);
  return text && other && options.length > 0 ? { kind: "question", question: text, options, other } : { kind: "other" };
}

function plan(rows: string[]): Dialog {
  const approve = keyOf(rows, "Yes, manually approve edits");
  const keepPlanning = keyOf(rows, "Tell Claude what to change");
  return approve && keepPlanning ? { kind: "plan", approve, keepPlanning } : { kind: "other" };
}

/** Which Claude Code dialog is on screen, with what a button needs to answer it (SRS-FR-163, SRS-FR-166). */
export function dialogScreen(screen: ScreenLine[]): Dialog {
  const rows = dialogRows(screen);
  const has = (words: string) => rows.some((row) => row.includes(words));

  if (has("Do you want to proceed?")) return permission(rows);
  if (has("Enter to select")) return question(rows);
  if (has("Would you like to proceed?")) return plan(rows);
  return rows.some((text) => isDialogRow({ text, dim: [] })) ? { kind: "other" } : { kind: "none" };
}
