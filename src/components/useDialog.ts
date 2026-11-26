import { useEffect, useRef, useState } from "react";
import type { PaneStatus, SessionsClient } from "../api/sessions";
import { labels } from "../labels";
import type { Strip } from "./ApprovalStrip";
import type { ChatEntry, ChatState } from "./chatState";
import { answerSteps, type Choice, type Steps } from "./dialogAnswer";
import { type Dialog, dialogScreen } from "./dialogScreen";
import type { Question } from "./QuestionCard";
import { knownState } from "./statusHighlight";
import type { TerminalAdapter } from "./TerminalPane";
import { useToast } from "./Toast";

/** A choice from the strip or a card; an option is named by its label, its key is read from the screen at answer time. */
export type PaneChoice = Exclude<Choice, { kind: "option" }> | { kind: "option"; label: string };

type View = {
  strip: Strip | null;
  question: Question | null;
  plan: { text: string | null } | null;
  /** The dialog the strip or card was built from; `none` while nothing shows. */
  dialog: Dialog;
};

const NOTHING: View = { strip: null, question: null, plan: null, dialog: { kind: "none" } };

/** How long each step of a typed answer waits for the screen to show the step before it landed. */
const STEP_WAIT_MS = 2000;

type Options = {
  paneId: string;
  /** The session terminal; null when Claude Code never started. */
  adapter: TerminalAdapter | null;
  status: PaneStatus;
  ended: boolean;
  chat: ChatState;
  client: SessionsClient;
};

/**
 * The Approval Strip, Question Card or plan card of one pane, and the answer they give
 * (SRS-FR-163 to SRS-FR-168). What shows is read from the session terminal's screen.
 */
export function useDialog({ paneId, adapter, status, ended, chat, client }: Options) {
  const showToast = useToast();
  const [view, setView] = useState<View>(() => viewOf(readDialog(adapter), status, ended, chat.items));
  const shown = useRef(view);
  shown.current = view;
  const show = (next: View) => setView((prev) => (sameView(prev, next) ? prev : next));

  // Until Claude Code redraws, the answered dialog is still on screen, and a second digit would land on
  // whatever dialog comes next, unseen. So a dialog is answered once, until the screen shows another one.
  const answered = useRef<Dialog | null>(null);
  const writing = useRef(false);

  // Once the dialog leaves the screen, answered here or in Term, the strip or card goes (SRS-FR-168).
  useEffect(() => {
    const refresh = () => {
      const dialog = readDialog(adapter);
      if (answered.current && !sameDialog(answered.current, dialog)) answered.current = null;
      show(viewOf(dialog, status, ended, chat.items));
    };
    refresh();
    if (!adapter) return;
    let frame = 0;
    const stop = adapter.onScreenChange(() => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    });
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, [adapter, status, ended, chat.items]);

  // A pane torn down in the middle of a typed answer writes nothing more.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const write = (bytes: string) =>
    alive.current ? client.write(paneId, bytes).then(() => true, () => false) : Promise.resolve(false);
  const stopped = () => {
    if (alive.current) showToast(labels.requestChanged);
  };

  /**
   * A digit is one write. A typed answer is three, each sent once the screen shows the one before landed:
   * the digit, the text once the cursor is in the field, then `\r` once the field shows the text.
   */
  async function deliver(adapter: TerminalAdapter, dialog: Dialog, steps: Steps) {
    if (!(await write(steps.key))) {
      // Nothing reached the session, so the same dialog may be answered again.
      answered.current = null;
      return;
    }
    if (steps.text === undefined) return;
    const text = steps.text;

    const inField = await screenShows(adapter, dialog, (d) => fieldOf(d)?.cursor === steps.key);
    if (!inField) return stopped();
    const placeholder = fieldOf(inField)?.label;
    if (!(await write(text))) return;

    // A long answer wraps, so its first row is compared as a prefix.
    const typed = await screenShows(adapter, dialog, (d) => {
      const field = fieldOf(d);
      return field?.cursor === steps.key && field.label !== placeholder && collapse(text).startsWith(collapse(field.label));
    });
    if (!typed) return stopped();
    await write("\r");
  }

  // SRS-FR-165: the screen and the status are read again at the click, as the request may have been answered or
  // replaced, or the session may have moved on, since the last frame.
  const answer = (choice: PaneChoice) => {
    if (writing.current || answered.current || !adapter) return;
    const now = viewOf(readDialog(adapter), status, ended, chat.items);
    const steps = stepsFor(shown.current.dialog, now.dialog, choice);
    if (steps === null) {
      showToast(labels.requestChanged);
      show(now);
      return;
    }
    writing.current = true;
    answered.current = now.dialog;
    deliver(adapter, now.dialog, steps).finally(() => (writing.current = false));
  };

  return { strip: view.strip, question: view.question, plan: view.plan, answer };
}

/** The field a typed answer goes into: the label its row shows, and the digit under the cursor. */
function fieldOf(d: Dialog) {
  if (d.kind === "question") return { label: d.otherLabel, cursor: d.cursor };
  if (d.kind === "plan") return { label: d.keepPlanningLabel, cursor: d.cursor };
  return null;
}

/**
 * The screen once `ok` holds for the same dialog; null when another dialog took its place, or after
 * STEP_WAIT_MS. A frame with no readable dialog may be a redraw in progress, so it is waited through.
 */
function screenShows(adapter: TerminalAdapter, dialog: Dialog, ok: (d: Dialog) => boolean): Promise<Dialog | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: Dialog | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stop();
      resolve(result);
    };
    const check = () => {
      const d = dialogScreen(adapter.screen());
      if (sameDialog(dialog, d)) {
        if (ok(d)) finish(d);
      } else if (d.kind !== "none" && d.kind !== "other") finish(null);
    };
    const timer = setTimeout(() => finish(null), STEP_WAIT_MS);
    const stop = adapter.onScreenChange(check);
    check();
  });
}

/** What to write to `fresh`, or null when it is not the dialog the user answered. */
function stepsFor(seen: Dialog, fresh: Dialog, choice: PaneChoice): Steps | null {
  if (!sameDialog(seen, fresh)) return null;
  if (choice.kind !== "option") return answerSteps(fresh, choice);
  // The digit of an option is the one on screen now, found by the label the user chose.
  const key = fresh.kind === "question" ? fresh.options.find((o) => o.label === choice.label)?.key : undefined;
  return key ? answerSteps(fresh, { kind: "option", key }) : null;
}

/** The same request: a permission for the same thing, the same question, or a plan. */
function sameDialog(a: Dialog, b: Dialog) {
  return (
    (a.kind === "permission" &&
      b.kind === "permission" &&
      a.title === b.title &&
      a.subject === b.subject &&
      a.command === b.command) ||
    (a.kind === "question" && b.kind === "question" && a.question === b.question) ||
    (a.kind === "plan" && b.kind === "plan")
  );
}

// A pane whose session never started shows no dialog.
const readDialog = (adapter: TerminalAdapter | null): Dialog => (adapter ? dialogScreen(adapter.screen()) : { kind: "none" });

function viewOf(dialog: Dialog, status: PaneStatus, ended: boolean, items: ChatEntry[]): View {
  if (ended) return NOTHING;
  const pending = newestPending(items);

  if (dialog.kind === "permission") {
    if (knownState(status) !== "Needs Approval") return NOTHING;
    // The hook's reason and the transcript's arg keep only a command's first line; the screen shows all of it.
    return { ...NOTHING, dialog, strip: { tool: pending?.name ?? null, detail: dialog.subject } };
  }
  if (dialog.kind === "question") {
    const asked = pending?.name === "AskUserQuestion" && pending.detail && "question" in pending.detail ? pending.detail.question : null;
    // Several questions or answers are answered in Term; the text check keeps an older question's card off a new dialog.
    if (!asked || asked.count !== 1 || asked.multiSelect) return NOTHING;
    if (!collapse(dialog.question).startsWith(collapse(asked.text).slice(0, 40))) return NOTHING;
    // With the cursor already in the field (moved there in Term), a digit would be typed into it.
    if (dialog.cursor === dialog.other) return NOTHING;
    return { ...NOTHING, dialog, question: { text: asked.text, options: asked.options } };
  }
  if (dialog.kind === "plan") return { ...NOTHING, dialog, plan: { text: pendingPlan(pending) } };
  return NOTHING;
}

type ToolEntry = Extract<ChatEntry, { kind: "tool" }>;

function newestPending(items: ChatEntry[]): ToolEntry | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "tool" && item.result === null) return item;
  }
  return null;
}

/** The plan of the pending ExitPlanMode; an earlier plan may not be the one being asked about. */
function pendingPlan(pending: ToolEntry | null): string | null {
  if (pending?.name !== "ExitPlanMode" || !pending.detail || !("plan" in pending.detail)) return null;
  return pending.detail.plan.trim() === "" ? null : pending.detail.plan;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function sameView(a: View, b: View) {
  return JSON.stringify(a) === JSON.stringify(b);
}
