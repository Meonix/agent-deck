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

// Dialogs measured for the Approval Strip and the Question and Plan cards. Scratch paths are
// replaced by /Users/me/ws, and a row they wrapped is joined back into one.

const DASHES = "╌".repeat(120);
const HEADER = [" ▐▛███▛█   Claude Code v2.1.332", "▝▜██████▀  Haiku 5.5 · Claude Ultra", " ▝▝   ▝▝   /Users/me/ws", "", ""];

/** A Bash permission dialog whose "No" is option 4. */
export const permissionNo4 = toScreen([
  ...HEADER,
  "❯ Run exactly this bash command: touch a.txt",
  "",
  "⏺ Bash(touch a.txt)",
  "  ⎿  Waiting…",
  "",
  RULE,
  " Bash command",
  ' Tip: auto mode handles these prompts for you — choose "switch to auto mode" below',
  " Create empty file a.txt in the working directory",
  DASHES,
  " touch a.txt",
  DASHES,
  " Do you want to proceed?",
  " ❯ 1. Yes",
  "   2. Yes, and always allow access to /Users/me/ws from this project",
  "   3. Yes, and switch to auto mode · auto mode handles these prompts for you",
  "   4. No",
  "",
  " Esc to cancel · Tab to amend",
]);

/** A permission dialog whose "No" is option 3, its command wrapped in a `│` box with a warning below. */
export const permissionNo3Box = toScreen([
  "  ⎿  /plan to preview",
  "",
  "⏺ Approved Claude's plan",
  "  ⎿  Plan saved to: ~/.claude/plans/plan-in-3-short-merry-coral-of-b8d4b7e5-2563-4ed9-adb8-a59999f79efc.md · /plan to",
  "     edit",
  "     Context",
  "",
  "     Add a file hello.txt containing hi to the working directory, with a test.",
  "",
  "     Steps",
  "",
  "     1. Write a test first: a check that hello.txt exists and its content is hi (e.g. test_hello.sh); run it and confirm",
  "        it fails.",
  "     2. Create hello.txt in the working directory (/Users/me/ws) with the content hi.",
  "     3. Run the test again and confirm it passes.",
  "",
  "⏺ Bash(cd \"/Users/me/ws\" && printf '#…)",
  "  ⎿  Waiting…",
  "",
  RULE,
  " Bash command",
  ' Tip: auto mode handles these prompts for you — choose "switch to auto mode" below',
  " Write test script and run it before creating hello.txt",
  DASHES,
  [" │ cd \"/Users/me/ws\" && printf '#!/bin/sh\\n[ -f hello.txt ] && [ \"$(cat hello.txt)\" = \"hi\" ]\\n' >", ".d"],
  [" │ test_hello.sh && sh test_hello.sh; echo \"exit=$?\"", ".d"],
  DASHES,
  [" │ printf operand '#!/bin/sh\\n[ -f hello.txt ] && [ \"$(cat hello.txt)\" = \"hi\" ]\\n' contains array subscript with", ".d"],
  [" │ expansion — zsh arith-evals %d/%i operands (may run $(cmd))", ".d"],
  "",
  " Do you want to proceed?",
  " ❯ 1. Yes",
  "   2. Yes, and switch to auto mode · auto mode handles these prompts for you",
  "   3. No",
  "",
  " Esc to cancel · Tab to amend",
  "─────────────────────────────────────────────────────────────────────────────────────────────────── add-hello-txt-test ─",
]);

/** AskUserQuestion with one single-choice question. */
export const askQuestion = toScreen([
  ...HEADER,
  "❯ Run exactly this bash command: touch b.txt",
  "",
  "⏺ Bash(touch b.txt)",
  "  ⎿  Interrupted · What should Claude do instead?",
  "",
  "❯ Use the AskUserQuestion tool to ask me one question: which validation library to use, with options zod and yup. Then",
  "  just repeat my answer.",
  RULE,
  " ☐ Validation",
  "",
  "Dùng thư viện validation nào: zod hay yup?",
  "",
  "❯ 1. zod",
  "     TypeScript-first, suy kiểu từ schema",
  "  2. yup",
  "     API quen thuộc với form, ít kiểu hơn",
  "  3. Type something.",
  RULE,
  "  4. Chat about this",
  "",
  "Enter to select · ↑/↓ to navigate · Esc to cancel",
]);

/** The same kind of question after `3`: the cursor on "Type something.", drawn dim as a placeholder. */
export const askQuestionOnOther = toScreen([
  ...HEADER,
  "❯ Use the AskUserQuestion tool to ask me one question: which validation library to use, with options zod and yup. Then",
  "  just repeat my answer.",
  RULE,
  " ☐ Validation",
  "",
  "Bạn muốn dùng thư viện validation nào?",
  "",
  "  1. zod",
  "     TypeScript-first, suy luận kiểu từ schema",
  "  2. yup",
  "     API quen thuộc, phổ biến với Formik",
  ["❯ 3. Type something.", ".....ddddddddddddddd"],
  RULE,
  "  4. Chat about this",
  "",
  "Enter to select · ↑/↓ to navigate · ctrl+g to edit in Vim · Esc to cancel",
]);

/** ExitPlanMode. */
export const plan = toScreen([
  ...HEADER,
  "❯ Plan, in 3 short steps, how to add a file hello.txt containing hi. Do not explore. Then call ExitPlanMode right away.",
  "",
  "⏺ Updated plan",
  "  ⎿  /plan to preview",
  "",
  RULE,
  " Ready to code?",
  "",
  " Here is Claude's plan:",
  DASHES,
  " Context",
  "",
  " Add a file hello.txt containing hi to the working directory.",
  "",
  " Steps",
  "",
  " 1. Create hello.txt in the working directory (/Users/me/ws).",
  " 2. Write the content hi into it.",
  " 3. Verify by reading the file back and confirming it contains hi.",
  DASHES,
  "",
  RULE,
  " Claude has written up a plan and is ready to execute. Would you like to proceed?",
  "",
  " ❯ 1. Yes, and use auto mode",
  "   2. Yes, manually approve edits",
  "   3. Tell Claude what to change",
  "      shift+tab to approve with this feedback",
  "",
  " ctrl+g to edit in Vim · ~/.claude/plans/plan-in-3-short-lucky-music-of-3abae932-00b2-4d0c-b3c9-7006f8c88066.md",
]);

/** A permission dialog with its "No" row gone. */
export const permissionWithoutNo = permissionNo4.filter((line) => line.text !== "   4. No");

/** The Write tool's permission dialog: the path under the title, the content between the fences. */
export const writeDialog = toScreen([
  ...HEADER,
  "❯ Use the Write tool to create c.txt with the content hi.",
  "",
  "⏺ Write(c.txt)",
  "",
  RULE,
  " Create file",
  " c.txt",
  DASHES,
  ["  1 hi", ".ddd"],
  DASHES,
  " Do you want to create c.txt?",
  " ❯ 1. Yes",
  "   2. Yes, and switch to accept edits (auto-approve file edits and common file commands) for this session (shift+tab)",
  "   3. No",
  "",
  " Esc to cancel · Tab to amend",
]);

/** The Edit tool's permission dialog: the path under the title, the diff between the fences. */
export const editDialog = toScreen([
  ...HEADER,
  "❯ Use the Edit tool to change ws to workspace in README.md.",
  "",
  "  Read 1 file (ctrl+o to expand)",
  "",
  "⏺ Update(README.md)",
  "",
  RULE,
  " Edit file",
  " README.md",
  DASHES,
  " 1 -# ws",
  " 1 +# workspace",
  DASHES,
  " Do you want to make this edit to README.md?",
  " ❯ 1. Yes",
  "   2. Yes, and switch to accept edits (auto-approve file edits and common file commands) for this session (shift+tab)",
  "   3. No",
  "",
  " Esc to cancel · Tab to amend",
]);

/** A two-line Bash command, drawn in a `│` box between the fences. */
export const multilineDialog = toScreen([
  ...HEADER,
  "❯ Run exactly this two-line bash command with a newline between the lines:",
  "  echo one",
  "  touch d.txt",
  "",
  "⏺ Bash(echo one",
  "      touch d.txt)",
  "  ⎿  Waiting…",
  "",
  RULE,
  " Bash command",
  ' Tip: auto mode handles these prompts for you — choose "switch to auto mode" below',
  " Echo one and create d.txt in the current directory",
  DASHES,
  [" │ echo one", ".d"],
  [" │ touch d.txt", ".d"],
  DASHES,
  " Do you want to proceed?",
  " ❯ 1. Yes",
  "   2. Yes, and always allow access to /Users/me/ws from this project",
  "   3. Yes, and switch to auto mode · auto mode handles these prompts for you",
  "   4. No",
  "",
  " Esc to cancel · Tab to amend",
]);

const replaceRow = (screen: ScreenLine[], from: string, to: Row) =>
  screen.map((line) => (line.text === from ? toScreen([to])[0] : line));

// A typed answer is staged: the digit moves the cursor to the field, the text then replaces its label.

/** askQuestionOnOther before the digit: the cursor on the first option. */
export const askQuestionStart = replaceRow(
  replaceRow(askQuestionOnOther, "❯ 3. Type something.", "  3. Type something."),
  "  1. zod",
  "❯ 1. zod",
);

/** askQuestionOnOther after "valibot" was typed into the field. */
export const askQuestionTyped = replaceRow(askQuestionOnOther, "❯ 3. Type something.", "❯ 3. valibot");

/** The plan after the keep-planning digit: the cursor on "Tell Claude what to change". */
export const planOnKeep = replaceRow(
  replaceRow(plan, " ❯ 1. Yes, and use auto mode", "   1. Yes, and use auto mode"),
  "   3. Tell Claude what to change",
  [" ❯ 3. Tell Claude what to change", "......dddddddddddddddddddddddddd"],
);

/**
 * The plan Claude Code drew again after "thêm bước viết test" (plan2.json › plan2; after-feedback is the
 * same screen). The transcript's ExitPlanMode input still held the first plan, so only the screen shows this one.
 */
export const planRevised = toScreen([
  "⏺ Updated plan",
  "  ⎿  /plan to preview",
  "",
  RULE,
  " Ready to code?",
  "",
  " Here is Claude's plan:",
  DASHES,
  " Context",
  "",
  " Add a file hello.txt containing hi to the working directory, with a test.",
  "",
  " Steps",
  "",
  " 1. Write a test first: a check that hello.txt exists and its content is hi (e.g. test_hello.sh); run it and confirm it",
  "    fails.",
  " 2. Create hello.txt in the working directory (/Users/me/ws) with the content hi.",
  " 3. Run the test again and confirm it passes.",
  DASHES,
  "",
  RULE,
  " Claude has written up a plan and is ready to execute. Would you like to proceed?",
  "",
  " ❯ 1. Yes, and use auto mode",
  "   2. Yes, manually approve edits",
  "   3. Tell Claude what to change",
  "      shift+tab to approve with this feedback",
  "",
  " ctrl+g to edit in Vim · ~/.claude/plans/plan-in-3-short-merry-coral-of-b8d4b7e5-2563-4ed9-adb8-a59999f79efc.md",
]);

/** planRevised taller than the pane: its rows down to `last` have scrolled out of it. */
export const planRevisedBelow = (last: string) => planRevised.slice(planRevised.findIndex((line) => line.text === last) + 1);

/** planOnKeep after the feedback was typed into the field. */
export const planTyped = replaceRow(planOnKeep, " ❯ 3. Tell Claude what to change", " ❯ 3. thêm bước viết test");
