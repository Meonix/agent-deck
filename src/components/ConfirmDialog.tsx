import { type ReactNode, useEffect, useRef } from "react";
import { labels } from "../labels";

type Props = {
  title: string;
  detail: ReactNode;
  action: string;
  /** A second, neutral choice shown between Cancel and `action`. */
  extra?: { label: string; onChoose(): void };
  /** `action` moves something to the Trash: red rather than iris. */
  danger?: boolean;
  onCancel(): void;
  onConfirm(): void;
};

export function ConfirmDialog({ title, detail, action, extra, danger = false, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // Focus returns to where it was, so closing the dialog does not strand it on body.
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    cancel.current?.focus();
    // Capture phase on the document, so neither Escape nor Tab reaches the terminal
    // behind the overlay: an Escape there would interrupt the turn the user keeps.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return onCancel();
      const buttons = [...(dialog.current?.querySelectorAll("button") ?? [])];
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = at === -1 ? (e.shiftKey ? buttons.length - 1 : 0) : at + (e.shiftKey ? -1 : 1);
      buttons[(next + buttons.length) % buttons.length]?.focus();
    };
    const onFocus = (e: FocusEvent) => {
      if (!dialog.current?.contains(e.target as Node)) cancel.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, [onCancel]);
  return (
    <div className="scrim absolute inset-0 z-10 flex items-center justify-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="dlg flex w-[400px] max-w-[calc(100%-2rem)] flex-col gap-3 p-4"
      >
        <div id="confirm-dialog-title" className="text-[14px] font-semibold text-foreground">
          {title}
        </div>
        {detail && <div className="text-[12px] text-muted-foreground">{detail}</div>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button ref={cancel} onClick={onCancel} className={`${CHOICE} outline-btn text-foreground`}>
            {labels.cancel}
          </button>
          {extra && (
            <button onClick={extra.onChoose} className={`${CHOICE} outline-btn text-foreground`}>
              {extra.label}
            </button>
          )}
          <button onClick={onConfirm} className={`${CHOICE} font-medium ${danger ? "btn-danger" : "allow"}`}>
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

const CHOICE = "whitespace-nowrap px-3 py-1.5 text-[13px] hover:opacity-90 transition-opacity";
