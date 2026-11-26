import { useEffect, useRef, useState } from "react";
import type { SessionState, SessionsClient } from "../api/sessions";
import { type HistoryPosition, historyStep, normalisePrompt, sendPrompt } from "./composerLogic";
import { inputReadiness, type Readiness } from "./inputReady";
import type { TerminalAdapter } from "./TerminalPane";

type Options = {
  paneId: string;
  /** The session terminal; null when Claude Code never started. */
  adapter: TerminalAdapter | null;
  /** "Ended" once the session ended, else its status. */
  state: SessionState;
  client: SessionsClient;
  /** Prompts sent from this pane, oldest first (SRS-FR-158). */
  sentPrompts: readonly string[];
  /** The prompt reached the session and joins the history. */
  onSent(prompt: string): void;
};

/**
 * The Composer's state and actions for one pane (SRS-FR-154 to SRS-FR-158). The draft is local state, so a
 * keystroke re-renders this pane only; the pane stays mounted across view switches, so the draft survives them.
 */
export function useComposer({ paneId, adapter, state, client, sentPrompts, onSent }: Options) {
  const [draft, setDraft] = useState("");

  // RULE-12 is read from the session terminal's screen: per frame of output, and on each status change.
  const [readiness, setReadiness] = useState(() => readinessOf(adapter, state));
  const showReadiness = (next: Readiness) => setReadiness((prev) => (sameReadiness(prev, next) ? prev : next));
  useEffect(() => {
    const refresh = () => showReadiness(readinessOf(adapter, state));
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
  }, [adapter, state]);

  // Where ↑/↓ stand in the history; null once the user edits, so ↑ and ↓ go back to moving the caret.
  const [position, setPosition] = useState<HistoryPosition>(null);
  const onChange = (text: string) => {
    setPosition(null);
    setDraft(text);
  };
  const onHistory = (dir: "up" | "down") => {
    const step = historyStep(sentPrompts, position, dir);
    if (!step) return;
    setPosition(step.position);
    setDraft(step.text);
  };

  // Until the write lands the screen may still show the empty box, so a second Enter would send twice.
  const sending = useRef(false);
  // SRS-FR-156: the screen is read again at the moment of sending, as a dialog may have appeared since the last frame.
  const onSend = () => {
    if (sending.current) return;
    const now = readinessOf(adapter, state);
    showReadiness(now);
    if (!now.ready || !adapter) return;
    const delivery = sendPrompt(draft, adapter.bracketedPaste());
    if (!delivery.ok) {
      if (delivery.reason === "unrecognized") showReadiness({ ready: false, reason: "unrecognized" });
      return;
    }
    const sent = draft;
    sending.current = true;
    // A failed write leaves the prompt in the Composer.
    client
      .write(paneId, delivery.bytes)
      .then(
        () => {
          setPosition(null);
          // Text typed while the write was pending is a new prompt, not the one sent.
          setDraft((current) => (current === sent ? "" : current));
          onSent(normalisePrompt(sent));
        },
        () => {},
      )
      .finally(() => (sending.current = false));
  };

  const running = state === "Running";
  const onStop = () => {
    if (running) client.write(paneId, "\x1b").catch(() => {});
  };

  return { value: draft, onChange, readiness, running, onSend, onStop, onHistory, browsing: position !== null };
}

// A pane whose session never started has nothing to send to.
function readinessOf(adapter: TerminalAdapter | null, state: SessionState): Readiness {
  return adapter ? inputReadiness(adapter.screen(), state, adapter.cols()) : { ready: false, reason: "ended" };
}

function sameReadiness(a: Readiness, b: Readiness) {
  return a.ready ? b.ready : !b.ready && a.reason === b.reason;
}
