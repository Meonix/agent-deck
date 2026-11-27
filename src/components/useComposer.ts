import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SavedFile, SessionState, SessionsClient } from "../api/sessions";
import type { Chip } from "./AttachmentChips";
import { insertPaths, removePath, tooLarge } from "./attachments";
import { type HistoryPosition, historyStep, normalisePrompt, sendPrompt } from "./composerLogic";
import { inputReadiness, type Readiness } from "./inputReady";
import type { TerminalAdapter } from "./TerminalPane";
import type { SuggestSource } from "./useSuggestionMenu";

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
  /** The Composer's textarea: attached paths go in at its caret. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export type AttachResult = SavedFile | { name: string; error: "too_large" };

/**
 * The Composer's state and actions for one pane (SRS-FR-154 to SRS-FR-158). The draft is local state, so a
 * keystroke re-renders this pane only; the pane stays mounted across view switches, so the draft survives them.
 */
export function useComposer({ paneId, adapter, state, client, sentPrompts, onSent, inputRef }: Options) {
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
          setAttached([]);
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

  // Stable, so a re-render does not count as a new source for the menus.
  const suggest = useMemo<SuggestSource>(
    () => ({ commands: () => client.listCommands(paneId), files: () => client.listFiles(paneId) }),
    [client, paneId],
  );

  const [attached, setAttached] = useState<AttachResult[]>([]);
  // Where the caret goes once the draft holding the attached paths is in the textarea.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    const at = pendingCaret.current;
    if (!el || at === null || el.value !== draft) return;
    pendingCaret.current = null;
    el.setSelectionRange(at, at);
    el.focus();
  });

  const attach = (results: AttachResult[]) => {
    if (results.length === 0) return;
    setAttached((prev) => [...prev, ...results]);
    const paths = results.flatMap((r) => ("error" in r ? [] : [r.path]));
    const el = inputRef.current;
    if (paths.length === 0) {
      el?.focus();
      return;
    }
    setPosition(null);
    setDraft((current) => {
      const at = el && el.value === current ? el.selectionStart : current.length;
      const next = insertPaths(current, at, paths);
      pendingCaret.current = next.caret;
      return next.text;
    });
  };

  // A path the user deleted by hand loses its chip; the index of each chip points back into `attached`.
  const shown = attached.flatMap((r, at): { at: number; chip: Chip }[] => {
    if ("error" in r) return [{ at, chip: { kind: "error", name: r.name } }];
    return draft.includes(r.path) ? [{ at, chip: { kind: "ok", name: r.name, size: r.size, path: r.path } }] : [];
  });
  const chips = shown.map((s) => s.chip);
  const onRemoveChip = (index: number) => {
    const entry = shown[index];
    if (!entry) return;
    if (entry.chip.kind === "ok") setDraft(removePath(draft, entry.chip.path));
    setAttached((prev) => prev.filter((_, i) => i !== entry.at));
  };

  const onPasteFiles = (files: File[]) => {
    void Promise.all(files.map((file) => saveFile(client, file))).then((results) => attach(results.filter((r) => r !== null)));
  };

  return {
    value: draft,
    onChange,
    readiness,
    running,
    onSend,
    onStop,
    onHistory,
    browsing: position !== null,
    suggest,
    attach,
    chips,
    onRemoveChip,
    onPasteFiles,
  };
}

async function saveFile(client: SessionsClient, file: File): Promise<AttachResult | null> {
  const name = file.name || "file";
  if (tooLarge(file.size)) return { name, error: "too_large" };
  try {
    return await client.savePromptFile(name, new Uint8Array(await file.arrayBuffer()));
  } catch (reason) {
    return reason === "too_large" ? { name, error: "too_large" } : null;
  }
}

// A pane whose session never started has nothing to send to.
function readinessOf(adapter: TerminalAdapter | null, state: SessionState): Readiness {
  return adapter ? inputReadiness(adapter.screen(), state, adapter.cols()) : { ready: false, reason: "ended" };
}

function sameReadiness(a: Readiness, b: Readiness) {
  return a.ready ? b.ready : !b.ready && a.reason === b.reason;
}
