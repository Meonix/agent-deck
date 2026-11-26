/**
 * Claude Code's own words that the app reads off the terminal screen (measured on 2.1.332). When Claude
 * Code rewords a dialog, this is the one place to change.
 */

/** The question above a permission's menu: a command, a new file, or an edit. */
export const PERMISSION_QUESTION = /^\s*Do you want to (proceed|create .+|make this edit to .+)\?$/;
/** The footer under a permission's menu. */
export const PERMISSION_FOOTER = "Esc to cancel";
/** The footer under an AskUserQuestion menu. */
export const QUESTION_FOOTER = "Enter to select";
/** The question above an ExitPlanMode menu. */
export const PLAN_QUESTION = "Would you like to proceed?";
/** The row right above the fenced plan. */
export const PLAN_HEADING = "Here is Claude's plan:";

/** A permission's first and last menu items. */
export const YES_LABEL = "Yes";
export const NO_LABEL = "No";
/** A question's field for a typed answer, before anything is typed into it. */
export const OTHER_LABEL = "Type something.";
export const CHAT_LABEL = "Chat about this";
export const APPROVE_PLAN_LABEL = "Yes, manually approve edits";
/** The plan's field for feedback, before anything is typed into it. */
export const KEEP_PLANNING_LABEL = "Tell Claude what to change";

/** Words that mean some dialog is on screen, whether or not a button can answer it. */
export const DIALOG_WORDS = ["Esc to cancel", "Enter to confirm", QUESTION_FOOTER, "Do you want to proceed?", PLAN_QUESTION];

/** Whether a row holds dialog words, PERMISSION_QUESTION included. */
export const hasDialogWords = (text: string) => DIALOG_WORDS.some((w) => text.includes(w)) || PERMISSION_QUESTION.test(text);

/** The tool a permission dialog's title names, for when Chat has no pending tool yet. */
export const TOOL_OF_TITLE: Record<string, string> = { "Bash command": "Bash", "Create file": "Write", "Edit file": "Edit" };
