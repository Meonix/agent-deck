import { ArrowUp, Square } from "lucide-react";
import { type RefObject, useId, useLayoutEffect, useRef, useState } from "react";
import { labels } from "../labels";
import { AttachmentChips, type Chip } from "./AttachmentChips";
import { ICON } from "./icon";
import type { Readiness } from "./inputReady";
import { SuggestionMenu } from "./SuggestionMenu";
import { type SuggestSource, useSuggestionMenu } from "./useSuggestionMenu";

// Matches the textarea's leading-5; it grows to MAX_ROWS rows and scrolls beyond.
const ROW_PX = 20;
const MAX_ROWS = 8;

const LOCK = {
  approval: labels.composerLockApproval,
  unrecognized: labels.composerLockUnrecognized,
  ended: labels.composerLockEnded,
} as const;

type Props = {
  paneId: string;
  value: string;
  onChange(value: string): void;
  readiness: Readiness;
  running: boolean;
  onSend(): void;
  onStop(): void;
  /** ↑ asks for the next older prompt, ↓ for the next newer one (SRS-FR-158). */
  onHistory(dir: "up" | "down"): void;
  /** The text is a recalled prompt the user has not edited, so ↑ and ↓ keep walking the history. */
  browsing: boolean;
  /** The pane focuses the Composer through it when it opens or Chat is chosen. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** The lists behind the "/" and "@" menus (SRS-FR-159, SRS-FR-160). */
  suggest: SuggestSource;
  /** The files attached to the draft (SRS-FR-161, SRS-FR-162). */
  chips: Chip[];
  onRemoveChip(index: number): void;
  /** Files pasted into the field; a paste without files stays a text paste. */
  onPasteFiles(files: File[]): void;
};

/** The pane's prompt input under the Chat log (SRS-FR-154 to SRS-FR-162). */
export function Composer({ paneId, value, onChange, readiness, running, onSend, onStop, onHistory, browsing, inputRef: area, suggest, chips, onRemoveChip, onPasteFiles }: Props) {
  const reasonId = useId();

  // The caret counts only for the text the user typed or chose: a recalled prompt or a cleared draft opens
  // no menu, so ↑/↓ keep walking the history.
  const [typed, setTyped] = useState<{ value: string; caret: number } | null>(null);
  const caret = !browsing && typed?.value === value ? typed.caret : 0;
  const track = (el: HTMLTextAreaElement) => {
    if (typed?.value === el.value && typed.caret === el.selectionStart) return;
    setTyped({ value: el.value, caret: el.selectionStart });
  };
  const pendingCaret = useRef<number | null>(null);
  const { menu, onKey, choose } = useSuggestionMenu(suggest, value, caret, (next) => {
    pendingCaret.current = next.caret;
    setTyped({ value: next.text, caret: next.caret });
    onChange(next.text);
  });
  useLayoutEffect(() => {
    const el = area.current;
    const at = pendingCaret.current;
    if (!el || at === null || el.value !== value) return;
    pendingCaret.current = null;
    el.setSelectionRange(at, at);
    el.focus();
  });
  // Running is not a lock: the Composer shows Stop instead of a reason.
  const lock = readiness.ready || readiness.reason === "running" ? null : LOCK[readiness.reason];
  const canSend = readiness.ready;

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    const height = el.scrollHeight;
    el.style.height = `${Math.min(Math.max(height, ROW_PX), MAX_ROWS * ROW_PX)}px`;
    el.style.overflowY = height > MAX_ROWS * ROW_PX ? "auto" : "hidden";
  }, [area, value]);

  const press = (action: () => void) => {
    action();
    area.current?.focus();
  };

  // The placeholder says why sending is locked only while the field is empty; with text the reason gets its own line.
  const reasonShown = lock !== null && value !== "" && !running;

  return (
    <div className="mx-3 mb-2 shrink-0 rounded-group bg-canvas px-3 py-2">
      {lock && (
        <div id={reasonId} className={reasonShown ? "mb-1 truncate text-[11px] text-muted-foreground" : "sr-only"}>
          {lock}
        </div>
      )}
      <AttachmentChips chips={chips} onRemove={onRemoveChip} />
      <div className="flex items-center gap-2">
        <div className={`field ${value ? "field-on" : ""} relative flex min-w-0 flex-1 px-3 py-1.5`}>
          {menu && <SuggestionMenu menu={menu} choose={choose} />}
          <textarea
            ref={area}
            rows={1}
            data-composer={paneId}
            aria-label={labels.composerLabel}
            aria-describedby={lock ? reasonId : undefined}
            placeholder={lock ?? labels.composerPlaceholder}
            aria-autocomplete="list"
            aria-controls={menu ? menu.id : undefined}
            aria-activedescendant={menu ? `${menu.id}-${menu.active}` : undefined}
            value={value}
            onChange={(e) => {
              track(e.target);
              onChange(e.target.value);
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length === 0) return;
              e.preventDefault();
              onPasteFiles(files);
            }}
            // Key and mouse moves of the caret, not onSelect: that one follows document selectionchange,
            // which also fires when focus leaves a closing pane.
            onKeyUp={(e) => track(e.currentTarget)}
            onMouseUp={(e) => track(e.currentTarget)}
            onKeyDown={(e) => {
              // Keys that end a Vietnamese IME composition only commit the word.
              const composing = e.nativeEvent.isComposing || e.keyCode === 229;
              if (!composing && onKey(e)) return;
              if (e.key === "Enter" && !e.shiftKey) {
                if (composing) return;
                e.preventDefault();
                if (canSend) onSend();
                return;
              }
              if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
              const el = e.currentTarget;
              const onFirstRow = !el.value.slice(0, el.selectionStart).includes("\n");
              const onLastRow = !el.value.slice(el.selectionEnd).includes("\n");
              if (e.key === "ArrowUp" && onFirstRow && (el.value === "" || browsing)) {
                e.preventDefault();
                onHistory("up");
              } else if (e.key === "ArrowDown" && onLastRow && browsing) {
                e.preventDefault();
                onHistory("down");
              }
            }}
            className="block min-w-0 flex-1 resize-none bg-transparent text-[13px] leading-5 outline-none placeholder:text-muted-foreground"
          />
        </div>
        {running ? (
          <button type="button" aria-label={labels.stop} title={labels.stop} onClick={() => press(onStop)} className="stop flex size-8 shrink-0 items-center justify-center">
            <Square {...ICON} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={labels.send}
            title={lock ?? labels.send}
            aria-disabled={canSend ? undefined : true}
            aria-describedby={lock ? reasonId : undefined}
            onClick={() => press(() => canSend && onSend())}
            className={`${canSend ? "send" : "send-off"} flex size-8 shrink-0 items-center justify-center`}
          >
            <ArrowUp {...ICON} />
          </button>
        )}
      </div>
    </div>
  );
}
