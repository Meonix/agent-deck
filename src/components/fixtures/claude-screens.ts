import type { ScreenLine } from "../TerminalPane";

// Screens of Claude Code 2.1.332 at 120×40, read back through @xterm/xterm. A row is its text,
// or its text and a dim mask with one character per cell ("d" dim, "." not).
type Row = string | [text: string, dim: string];

const RULE = "─".repeat(120);

function toScreen(rows: Row[]): ScreenLine[] {
  return rows.map((row) => {
    const [text, mask] = typeof row === "string" ? [row, ""] : row;
    return { text, dim: [...Array(text.length).keys()].map((i) => mask[i] === "d") };
  });
}

export const trust = toScreen([
  "",
  RULE,
  " Accessing workspace:",
  "",
  " /Users/me/ws",
  "",
  "",
  " Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source",
  " project, or work from your team). If not, take a moment to review what's in this folder first.",
  "",
  " Claude Code'll be able to read, edit, and execute files here.",
  "",
  " Security guide",
  "",
  " ❯ No, exit",
  "   Yes, I trust this folder",
  "",
  " Enter to confirm · Esc to cancel",
]);

export const idle = toScreen([
  " ▐▛███▛█   Claude Code v2.1.332",
  "▝▜██████▀  Haiku 5.5 · Claude Ultra",
  " ▝▝   ▝▝   /Users/me/ws",
  "",
  "",
  RULE,
  ["❯\u00a0Try \"how do I log an error?\"", "..ddd.dddd.dd.d.ddd.dd.ddddddd"],
  RULE,
  "──",
  "  Haiku 5.5 | 0/1M tokens (0%)                                                                      ◐ medium · /effort",
  "  ⏸ manual mode on · ← for agents",
]);

export const typed = toScreen([
  " ▐▛███▛█   Claude Code v2.1.332",
  "▝▜██████▀  Haiku 5.5 · Claude Ultra",
  " ▝▝   ▝▝   /Users/me/ws",
  "",
  "",
  RULE,
  ["❯\u00a0Try \"how do I log an error?\"", "..ddd.dddd.dd.d.ddd.dd.ddddddd"],
  "──hello",
  "──",
  "  Haiku 5.5 | 0/1M tokens (0%)                                                                      ◐ medium · /effort",
  "  ⏸ manual mode on",
]);

export const running = toScreen([
  " ▐▛███▛█   Claude Code v2.1.332",
  "▝▜██████▀  Haiku 5.5 · Claude Ultra",
  " ▝▝   ▝▝   /Users/me/ws",
  "",
  "",
  RULE,
  "❯ Run the bash command: ls -la /tmp | head -3",
  "",
  "· Gitifying… (running UserPromptSubmit hook · 0s)",
  "✻    ifying…",
  RULE,
  "❯",
  RULE,
  "──",
  "  Haiku 5.5 | 0/1M tokens (0%)                                                                      ◐ medium · /effort",
  "  ⏸ manual mode on · esc to interrupt · ← for agents",
]);

export const permission = toScreen([
  " ▐▛███▛█   Claude Code v2.1.332",
  "▝▜██████▀  Haiku 5.5 · Claude Ultra",
  " ▝▝   ▝▝   /Users/me/ws",
  "",
  "",
  RULE,
  "❯ Run the bash command: ls -la /tmp | head -3",
  "",
  "· Gitifying… (running UserPromptSubmit hook · 0s)",
  "⏺ Listing 1 directory… (ctrl+o to expand)",
  "  ⎿  $ ls -la /tmp | head -3────────────────────────────────────────────────────────────────────────────────────────────",
  "",
  RULE,
  " Bash command",
  " Tip: auto mode handles these prompts for you — choose \"switch to auto mode\" below",
  " List first entries of /tmp",
  "╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌───╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌",
  "╌╌",
  " ls -la /tmp | head -3",
  "╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌",
  " Do you want to proceed?",
  " ❯ 1. Yes",
  "   2. Yes, allow reading from /tmp from this project",
  "   3. Yes, and switch to auto mode · auto mode handles these prompts for you",
  "   4. No",
  "",
  " Esc to cancel · Tab to amend",
]);

export const afterEsc = toScreen([
  " ▐▛███▛█   Claude Code v2.1.332",
  "▝▜██████▀  Haiku 5.5 · Claude Ultra",
  " ▝▝   ▝▝   /Users/me/ws",
  "",
  "",
  RULE,
  "❯ Run the bash command: ls -la /tmp | head -3",
  "",
  "· Gitifying… (running UserPromptSubmit hook · 0s)",
  "⏺ Listing 1 directory… (ctrl+o to expand)",
  "  Listed 1 directory (ctrl+o to expand)",
  "    \u00a0Interrupted · What should Claude do instead?",
  RULE,
  RULE,
  "❯",
  RULE,
  "─╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌───╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌",
  "╌ Haiku 5.5 | 48.8k/1M tokens (5%)",
  "  ⏸ manual mode on",
]);

export const question = toScreen([
  " ▐▛███▛█   Claude Code v2.1.332",
  "▝▜██████▀  Haiku 5.5 · Claude Ultra",
  " ▝▝   ▝▝   /Users/me/ws",
  "",
  "",
  RULE,
  "❯ Run the bash command: ls -la /tmp | head -3",
  "",
  "· Gitifying… (running UserPromptSubmit hook · 0s)",
  "⏺ Listing 1 directory… (ctrl+o to expand)",
  "  Listed 1 directory (ctrl+o to expand)",
  "    \u00a0Interrupted · What should Claude do instead?",
  RULE,
  RULE,
  "❯ Use the AskUserQuestion tool to ask me whether I prefer red or blue. Do nothing else.",
  RULE,
  " ☐ Màu sắc",
  "",
  "Bạn thích màu đỏ hay màu xanh dương?",
  "",
  "❯ 1. Đỏ",
  "     Chọn màu đỏ",
  "  2. Xanh dương",
  "     Chọn màu xanh dương",
  "  3. Type something.",
  RULE,
  "──",
  "  4. Chat about this",
  "",
  "Enter to select · ↑/↓ to navigate · Esc to cancel",
]);

// Edge cases derived from the captures.

/** The idle box, scrolled up, above a live box holding typed text. */
export const readyBoxAboveTyped = [
  ...idle.slice(0, 8),
  ...toScreen(["", "❯ fix the build", "", RULE, "❯ hello", RULE]),
];

/** A dialog's words left in the transcript above a live, empty box. */
export const dialogTextAboveBox = [...toScreen([" Do you want to proceed?", " ❯ 1. Yes"]), ...afterEsc];

export const dialogBelowBox = [...idle, ...toScreen(["", " Esc to cancel"])];

export const noBox = [...idle.slice(0, 5), ...idle.slice(9)];

export const shortRules = idle.map((line) => (line.text === RULE ? toScreen(["─".repeat(50)])[0] : line));

/** A multi-line input box whose second row is blank, which trims to nothing. */
export const emptyContinuation = toScreen([RULE, "❯", "", RULE]);

export const dimContinuation = toScreen([RULE, ["❯ Try this", "..ddd.dddd"], ["  or that", "..dd.dddd"], RULE]);

export const typedContinuation = toScreen([RULE, "❯ first", "  second", RULE]);
