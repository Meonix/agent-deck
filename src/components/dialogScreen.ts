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

type Option = { label: string; key: string };

const option = (text: string) => {
  const match = OPTION_ROW.exec(text);
  return match ? { label: match[2], key: match[1], column: text.indexOf(match[1]) } : null;
};

/**
 * Whether a walk over the menu steps past `row`: a blank or rule row, or, once the digit column is
 * known, a row starting deeper than it (a description, a wrapped label, "shift+tab to approve…").
 */
const passes = (row: string, column: number) =>
  row.trim() === "" || /^[─╌]+$/.test(row.trim()) || (column >= 0 && row.search(/\S/) > column);

/**
 * The menu just above `footer`, read bottom-up: digits in one column counting down to 1. Text Claude
 * Code prints above it (a command, a plan, a question) may hold numbered rows of its own, which the
 * walk never reaches. `start` is the row of "1.".
 */
function menuAbove(rows: string[], footer: number): { start: number; options: Option[] } | null {
  const options: Option[] = [];
  let column = -1;
  for (let i = footer - 1; i >= 0; i--) {
    if (passes(rows[i], column)) continue;
    const o = option(rows[i]);
    if (!o || (column >= 0 && (o.column !== column || Number(o.key) !== Number(options[0].key) - 1))) return null;
    column = o.column;
    options.unshift({ label: o.label, key: o.key });
    if (o.key === "1") return { start: i, options };
  }
  return null;
}

/** The menu just below `anchor`, read top-down: digits in one column counting up from 1. */
function menuBelow(rows: string[], anchor: number): Option[] {
  const options: Option[] = [];
  let column = -1;
  for (let i = anchor + 1; i < rows.length; i++) {
    if (passes(rows[i], column)) continue;
    const o = option(rows[i]);
    if (!o || (column >= 0 && o.column !== column) || Number(o.key) !== options.length + 1) break;
    column = o.column;
    options.push({ label: o.label, key: o.key });
  }
  return options;
}

// The last match: the same words may appear earlier in a command, plan or question Claude Code prints.
const lastIndex = (rows: string[], words: string, end = rows.length) => {
  for (let i = end - 1; i >= 0; i--) if (rows[i].includes(words)) return i;
  return -1;
};

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

const OTHER: Dialog = { kind: "other" };

function permission(rows: string[]): Dialog {
  const m = menuAbove(rows, lastIndex(rows, "Esc to cancel"));
  if (!m || lastIndex(rows, "Do you want to proceed?", m.start) < 0) return OTHER;
  const yes = m.options[0];
  const no = m.options[m.options.length - 1];
  if (yes.label !== "Yes" || no.label !== "No" || m.options.length < 2) return OTHER;

  const start = rows.findIndex((row) => DASH_RULE.test(row.trim()));
  const end = start < 0 ? -1 : rows.findIndex((row, i) => i > start && DASH_RULE.test(row.trim()));
  const body = end < 0 ? rows.filter((row) => BOX_ROW.test(row.trim())) : rows.slice(start + 1, end);
  const command = joined(body.map((row) => row.trim().replace(BOX_ROW, "")));
  return command ? { kind: "permission", command, yes: yes.key, no: no.key } : OTHER;
}

/** The last two items are always "Type something." and "Chat about this"; Claude's options come before. */
function question(rows: string[]): Dialog {
  const m = menuAbove(rows, lastIndex(rows, "Enter to select"));
  const header = rows.findIndex((row) => /^\s*☐ /.test(row));
  if (!m || header < 0 || header > m.start) return OTHER;
  const options = m.options.slice(0, -2);
  const [other, chat] = m.options.slice(-2);
  const text = joined(rows.slice(header + 1, m.start));
  if (options.length === 0 || other.label !== "Type something." || chat.label !== "Chat about this" || !text)
    return OTHER;
  return { kind: "question", question: text, options, other: other.key };
}

function plan(rows: string[]): Dialog {
  const options = menuBelow(rows, lastIndex(rows, "Would you like to proceed?"));
  const keyOf = (label: string) => options.find((o) => o.label === label)?.key;
  const approve = keyOf("Yes, manually approve edits");
  const keepPlanning = keyOf("Tell Claude what to change");
  return approve && keepPlanning ? { kind: "plan", approve, keepPlanning } : OTHER;
}

/** Which Claude Code dialog is on screen, with what a button needs to answer it (SRS-FR-163, SRS-FR-166). */
export function dialogScreen(screen: ScreenLine[]): Dialog {
  const rows = dialogRows(screen);
  const has = (words: string) => rows.some((row) => row.includes(words));

  if (has("Do you want to proceed?")) return permission(rows);
  if (has("Enter to select")) return question(rows);
  if (has("Would you like to proceed?")) return plan(rows);
  return rows.some((text) => isDialogRow({ text, dim: [] })) ? OTHER : { kind: "none" };
}
