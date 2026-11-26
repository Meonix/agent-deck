import { useEffect, useRef, useState } from "react";
import type { PaneStatus, SessionsClient } from "../api/sessions";
import { labels } from "../labels";
import type { Strip } from "./ApprovalStrip";
import type { ChatEntry, ChatState } from "./chatState";
import { answerBytes, type Choice } from "./dialogAnswer";
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

  // SRS-FR-165: the screen and the status are read again at the click, as the request may have been answered or
  // replaced, or the session may have moved on, since the last frame.
  const answer = (choice: PaneChoice) => {
    if (writing.current || answered.current) return;
    const now = viewOf(readDialog(adapter), status, ended, chat.items);
    const bytes = stillShown(shown.current.dialog, now.dialog, choice);
    if (bytes === null) {
      showToast(labels.requestChanged);
      show(now);
      return;
    }
    writing.current = true;
    answered.current = now.dialog;
    client.write(paneId, bytes).then(
      () => (writing.current = false),
      () => {
        writing.current = false;
        answered.current = null;
      },
    );
  };

  return { strip: view.strip, question: view.question, plan: view.plan, answer };
}

/** The bytes answering `fresh`, or null when it is not the dialog the user answered. */
function stillShown(seen: Dialog, fresh: Dialog, choice: PaneChoice): string | null {
  if (!sameDialog(seen, fresh)) return null;
  if (choice.kind !== "option") return answerBytes(fresh, choice);
  // The digit of an option is the one on screen now, found by the label the user chose.
  const key = fresh.kind === "question" ? fresh.options.find((o) => o.label === choice.label)?.key : undefined;
  return key ? answerBytes(fresh, { kind: "option", key }) : null;
}

/** The same request: a permission for the same command, the same question, or a plan. */
function sameDialog(a: Dialog, b: Dialog) {
  return (
    (a.kind === "permission" && b.kind === "permission" && a.command === b.command) ||
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
    return { ...NOTHING, dialog, strip: stripOf(status.reason, pending, dialog.command) };
  }
  if (dialog.kind === "question") {
    const asked = pending?.name === "AskUserQuestion" && pending.detail && "question" in pending.detail ? pending.detail.question : null;
    // Several questions or answers are answered in Term; the text check keeps an older question's card off a new dialog.
    if (!asked || asked.count !== 1 || asked.multiSelect) return NOTHING;
    if (!collapse(dialog.question).startsWith(collapse(asked.text).slice(0, 40))) return NOTHING;
    return { ...NOTHING, dialog, question: { text: asked.text, options: asked.options } };
  }
  if (dialog.kind === "plan") return { ...NOTHING, dialog, plan: { text: latestPlan(items) } };
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

/**
 * The PermissionRequest hook's reason reads "<tool> <target>" (signal.rs › permission_reason); it is trusted only
 * when it names the pending tool, as a Notification may have set it to something else.
 */
function stripOf(reason: string | null, pending: ToolEntry | null, command: string): Strip {
  if (!pending) return { tool: null, detail: command };
  const fromReason = reason !== null && (reason === pending.name || reason.startsWith(`${pending.name} `));
  const rest = fromReason ? reason.slice(pending.name.length).trim() : "";
  return { tool: pending.name, detail: rest || pending.arg || command };
}

/** The newest non-empty plan of the session: the pending ExitPlanMode's, else an earlier one. */
function latestPlan(items: ChatEntry[]): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "tool" && item.name === "ExitPlanMode" && item.detail && "plan" in item.detail && item.detail.plan.trim() !== "") {
      return item.detail.plan;
    }
  }
  return null;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function sameView(a: View, b: View) {
  return JSON.stringify(a) === JSON.stringify(b);
}
