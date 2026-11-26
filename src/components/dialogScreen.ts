import {
  APPROVE_PLAN_LABEL,
  CHAT_LABEL,
  KEEP_PLANNING_LABEL,
  NO_LABEL,
  OTHER_LABEL,
  PERMISSION_FOOTER,
  PERMISSION_QUESTION,
  PLAN_HEADING,
  PLAN_QUESTION,
  QUESTION_FOOTER,
  YES_LABEL,
} from "./claudeScreenText";
import { isDialogRow } from "./inputReady";
import type { ScreenLine } from "./TerminalPane";

/**
 * The row a typed answer goes into: "Type something." in a question, "Tell Claude what to change" in a
 * plan. Its label is that placeholder, or the text typed into it so far.
 */
export type Field = { key: string; label: string };

export type Dialog =
  | { kind: "none" }
  | { kind: "other" }
  | {
      kind: "permission";
      /** The header row: "Bash command", "Create file", "Edit file"… */
      title: string;
      /** What is being approved, as the user must see it: a command with its lines, or a file's path. */
      subject: string;
      /** The fenced text on one line, the identity of the request. */
      command: string;
      yes: string;
      no: string;
    }
  | {
      kind: "question";
      question: string;
      options: { label: string; key: string }[];
      field: Field;
      /** The digit of the row under ❯. */
      cursor: string | null;
    }
  | {
      kind: "plan";
      approve: string;
      field: Field;
      cursor: string | null;
      /** The plan as drawn; null unless all of it is on screen. */
      plan: string | null;
    };

const OPTION_ROW = /^\s*(?:❯ )?(\d+)\. (.+)$/;
const DASH_RULE = /^╌+$/;
const BOX_ROW = /^│ ?/;

type Option = { label: string; key: string };
type Menu = { start: number; options: Option[]; cursor: string | null };

const option = (text: string) => {
  const match = OPTION_ROW.exec(text);
  return match ? { label: match[2], key: match[1], column: text.indexOf(match[1]), cursor: /^\s*❯ /.test(text) } : null;
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
function menuAbove(rows: string[], footer: number): Menu | null {
  const options: Option[] = [];
  let column = -1;
  let cursor: string | null = null;
  for (let i = footer - 1; i >= 0; i--) {
    if (passes(rows[i], column)) continue;
    const o = option(rows[i]);
    if (!o || (column >= 0 && (o.column !== column || Number(o.key) !== Number(options[0].key) - 1))) return null;
    column = o.column;
    options.unshift({ label: o.label, key: o.key });
    if (o.cursor) cursor = o.key;
    if (o.key === "1") return { start: i, options, cursor };
  }
  return null;
}

/** The menu just below `anchor`, read top-down: digits in one column counting up from 1. */
function menuBelow(rows: string[], anchor: number): Menu {
  const options: Option[] = [];
  let column = -1;
  let cursor: string | null = null;
  for (let i = anchor + 1; i < rows.length; i++) {
    if (passes(rows[i], column)) continue;
    const o = option(rows[i]);
    if (!o || (column >= 0 && o.column !== column) || Number(o.key) !== options.length + 1) break;
    column = o.column;
    options.push({ label: o.label, key: o.key });
    if (o.cursor) cursor = o.key;
  }
  return { start: anchor + 1, options, cursor };
}

// The last match: the same words may appear earlier in a command, plan or question Claude Code prints.
const lastIndex = (rows: string[], words: string | RegExp, end = rows.length) => {
  for (let i = end - 1; i >= 0; i--) if (typeof words === "string" ? rows[i].includes(words) : words.test(rows[i])) return i;
  return -1;
};

const joined = (rows: string[]) =>
  rows
    .map((row) => row.trim())
    .filter((row) => row !== "")
    .join(" ");

const isRule = (row: string, width: number) => /^─+$/.test(row) && row.length * 2 >= width;
// The fence spans the screen from column 0; a shorter or indented `╌` row is printed text.
const isFence = (row: string, width: number) => DASH_RULE.test(row) && row.length >= 0.9 * width;

/**
 * The rows of the dialog: those below the last full-width rule. A rule right before a numbered
 * option (short `─` rows aside) only separates a question's options, so it does not start the dialog.
 */
function dialogRows(rows: string[], width: number): { rows: string[]; opened: boolean } {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isRule(rows[i], width)) continue;
    let next = i + 1;
    while (next < rows.length && /^─+$/.test(rows[next])) next++;
    if (next < rows.length && OPTION_ROW.test(rows[next])) continue;
    return { rows: rows.slice(i + 1), opened: true };
  }
  // No opening rule: the top of a dialog taller than the pane has scrolled out of it.
  return { rows, opened: false };
}

const OTHER: Dialog = { kind: "other" };

function permission(rows: string[], width: number): Dialog {
  const m = menuAbove(rows, lastIndex(rows, PERMISSION_FOOTER));
  if (!m || lastIndex(rows, PERMISSION_QUESTION, m.start) < 0) return OTHER;
  const yes = m.options[0];
  const no = m.options[m.options.length - 1];
  if (yes.label !== YES_LABEL || no.label !== NO_LABEL || m.options.length < 2) return OTHER;

  // Both fences must be there, and a `│` box must open right under the first one: what the strip shows
  // is what Cho phép approves.
  const start = rows.findIndex((row) => isFence(row, width));
  const end = start < 0 ? -1 : rows.findIndex((row, i) => i > start && isFence(row, width));
  if (end < 0 || end > m.start) return OTHER;
  const body = rows.slice(start + 1, end);
  const isBox = (row: string) => BOX_ROW.test(row.trim());
  if (body.some(isBox) && !isBox(body[0])) return OTHER;
  const command = joined(body.map((row) => row.trim().replace(BOX_ROW, "")));

  const titleAt = rows.findIndex((row) => row.trim() !== "");
  const title = rows[titleAt].trim();
  // A file dialog names the file on the row under its title; the fence holds its content or diff.
  const subject = title.endsWith(" file")
    ? (rows.slice(titleAt + 1).find((row) => row.trim() !== "") ?? "").trim()
    : body
        .map((row) => row.replace(/^\s?(│ ?)?/, "").trimEnd())
        .filter((row) => row !== "")
        .join("\n");
  return subject ? { kind: "permission", title, subject, command, yes: yes.key, no: no.key } : OTHER;
}

/**
 * The last two items are always "Type something." and "Chat about this"; Claude's options come before.
 * Text typed into the field replaces "Type something.", with the cursor kept on it.
 */
function question(rows: string[]): Dialog {
  const m = menuAbove(rows, lastIndex(rows, QUESTION_FOOTER));
  const header = rows.findIndex((row) => /^\s*☐ /.test(row));
  if (!m || header < 0 || header > m.start) return OTHER;
  const options = m.options.slice(0, -2);
  const [other, chat] = m.options.slice(-2);
  const text = joined(rows.slice(header + 1, m.start));
  const fieldShown = other && (other.label === OTHER_LABEL || m.cursor === other.key);
  if (options.length === 0 || !fieldShown || chat.label !== CHAT_LABEL || !text) return OTHER;
  return { kind: "question", question: text, options, field: other, cursor: m.cursor };
}

/** Feedback typed into "Tell Claude what to change" replaces its label, with the cursor kept on it. */
function plan(rows: string[], all: string[], width: number): Dialog {
  const m = menuBelow(rows, lastIndex(rows, PLAN_QUESTION));
  const approve = m.options.find((o) => o.label === APPROVE_PLAN_LABEL)?.key;
  const last = m.options[m.options.length - 1];
  const keep =
    m.options.find((o) => o.label === KEEP_PLANNING_LABEL) ??
    (last && m.cursor === last.key && !last.label.startsWith(YES_LABEL) ? last : undefined);
  if (!approve || !keep) return OTHER;
  return { kind: "plan", approve, field: keep, cursor: m.cursor, plan: planText(all, width) };
}

/**
 * The plan between the `╌` fences under "Here is Claude's plan:", which sits above the rule that opens the
 * menu. Null unless the dialog's top rule, that row and both fences are on screen: a part of the plan
 * must never pass for all of it.
 */
function planText(all: string[], width: number): string | null {
  const ask = lastIndex(all, PLAN_QUESTION);
  const here = lastIndex(all, PLAN_HEADING, ask);
  if (here < 0 || !all.slice(0, here).some((row) => isRule(row, width))) return null;
  const open = all.findIndex((row, i) => i > here && isFence(row, width));
  const close = open < 0 ? -1 : all.findIndex((row, i) => i > open && isFence(row, width));
  if (close < 0 || close > ask) return null;
  const body = all.slice(open + 1, close);
  const indent = Math.min(...body.filter((row) => row.trim() !== "").map((row) => row.search(/\S/)));
  const text = body.map((row) => row.slice(indent)).join("\n").replace(/^\n+|\n+$/g, "");
  return text === "" ? null : text;
}

/** Which Claude Code dialog is on screen, with what a button needs to answer it (SRS-FR-163, SRS-FR-166). */
export function dialogScreen(screen: ScreenLine[]): Dialog {
  const all = screen.map((line) => line.text.trimEnd());
  const width = Math.max(0, ...all.map((row) => row.length));
  const { rows, opened } = dialogRows(all, width);

  // The dialog's own marker is the lowest one; the same words may be printed in a command or plan above it.
  const markers = [
    { at: lastIndex(rows, PERMISSION_QUESTION), read: () => (opened ? permission(rows, width) : OTHER) },
    { at: lastIndex(rows, QUESTION_FOOTER), read: () => question(rows) },
    { at: lastIndex(rows, PLAN_QUESTION), read: () => plan(rows, all, width) },
  ].filter((m) => m.at >= 0);
  if (markers.length > 0) return markers.reduce((a, b) => (b.at > a.at ? b : a)).read();
  return rows.some((text) => isDialogRow({ text, dim: [] })) ? OTHER : { kind: "none" };
}
