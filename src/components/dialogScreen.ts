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

type Menu = { start: number; options: Option[] };

/**
 * The last run of rows numbered 1, 2, 3… before `end`. Claude Code prints commands, plans and
 * questions that may hold numbered rows of their own, so keys come only from this run. Between two
 * options may sit an option's indented description, a wrapped label, or a `─` separator.
 */
function menu(rows: string[], end = rows.length): Menu | null {
  let last: Menu | null = null;
  let run: Menu | null = null;
  for (let i = 0; i < end; i++) {
    const o = option(rows[i]);
    if (o && o.key === "1") run = { start: i, options: [o] };
    else if (o && run && Number(o.key) === run.options.length + 1) run.options.push(o);
    else if (o || !(/^─+$/.test(rows[i]) || /^\s+\S/.test(rows[i]))) run = null;
    if (run) last = run;
  }
  return last;
}

const keyOf = (m: Menu | null, label: string) => m?.options.find((o) => o.label === label)?.key;

// The last match: the same words may appear earlier in a command, plan or question Claude Code prints.
const lastIndex = (rows: string[], words: string, end = rows.length) => {
  for (let i = end - 1; i >= 0; i--) if (rows[i].includes(words)) return i;
  return -1;
};

/** The menu, when a row holding `anchor` comes before it. */
function menuAfter(rows: string[], anchor: string): Menu | null {
  const m = menu(rows);
  return m && lastIndex(rows, anchor, m.start) >= 0 ? m : null;
}

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
  const m = menuAfter(rows, "Do you want to proceed?");
  const yes = keyOf(m, "Yes");
  const no = keyOf(m, "No");
  const start = rows.findIndex((row) => DASH_RULE.test(row.trim()));
  const end = start < 0 ? -1 : rows.findIndex((row, i) => i > start && DASH_RULE.test(row.trim()));
  const body = end < 0 ? rows.filter((row) => BOX_ROW.test(row.trim())) : rows.slice(start + 1, end);
  const command = joined(body.map((row) => row.trim().replace(BOX_ROW, "")));
  return yes && no && command ? { kind: "permission", command, yes, no } : { kind: "other" };
}

function question(rows: string[]): Dialog {
  const m = menu(rows, lastIndex(rows, "Enter to select"));
  const header = rows.findIndex((row) => /^\s*☐ /.test(row));
  if (!m || header < 0 || header > m.start) return { kind: "other" };
  const text = joined(rows.slice(header + 1, m.start));
  const other = keyOf(m, OTHER_LABEL);
  const options = m.options.filter((o) => o.label !== OTHER_LABEL && o.label !== CHAT_LABEL);
  return text && other && options.length > 0 ? { kind: "question", question: text, options, other } : { kind: "other" };
}

function plan(rows: string[]): Dialog {
  const m = menuAfter(rows, "Would you like to proceed?");
  const approve = keyOf(m, "Yes, manually approve edits");
  const keepPlanning = keyOf(m, "Tell Claude what to change");
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
