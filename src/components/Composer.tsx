import { ArrowUp, Square } from "lucide-react";
import { type RefObject, useId, useLayoutEffect, useRef } from "react";
import { labels } from "../labels";
import { ICON } from "./icon";
import type { Readiness } from "./inputReady";

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
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

/** The pane's prompt input under the Chat log (SRS-FR-154 to SRS-FR-158). */
export function Composer({ paneId, value, onChange, readiness, running, onSend, onStop, onHistory, inputRef }: Props) {
  const own = useRef<HTMLTextAreaElement>(null);
  const area = inputRef ?? own;
  // The text is a recalled prompt the user has not edited, so ↑ and ↓ keep walking the history.
  const browsing = useRef(false);
  const reasonId = useId();
  const lock = readiness.ready || readiness.reason === "running" ? null : LOCK[readiness.reason];
  const canSend = readiness.ready && !running;

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
    <div className="shrink-0 border-t border-border bg-card px-3 py-2">
      {lock && (
        <div id={reasonId} className={reasonShown ? "mb-1 truncate text-[11px] text-muted-foreground" : "sr-only"}>
          {lock}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className={`field ${value ? "field-on" : ""} flex min-w-0 flex-1 px-3 py-1.5`}>
          <textarea
            ref={area}
            rows={1}
            data-composer={paneId}
            aria-label={labels.composerLabel}
            aria-describedby={lock ? reasonId : undefined}
            placeholder={lock ?? labels.composerPlaceholder}
            value={value}
            onChange={(e) => {
              browsing.current = false;
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                // Enter that ends a Vietnamese IME composition only commits the word.
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                e.preventDefault();
                if (canSend) onSend();
                return;
              }
              if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
              const el = e.currentTarget;
              const onFirstRow = !el.value.slice(0, el.selectionStart).includes("\n");
              const onLastRow = !el.value.slice(el.selectionEnd).includes("\n");
              if (e.key === "ArrowUp" && onFirstRow && (el.value === "" || browsing.current)) {
                e.preventDefault();
                browsing.current = true;
                onHistory("up");
              } else if (e.key === "ArrowDown" && onLastRow && browsing.current) {
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
