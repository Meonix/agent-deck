import { type ReactNode, useEffect, useRef } from "react";

type Props = {
  title: string;
  detail: ReactNode;
  action: string;
  /** A second, neutral choice shown between Cancel and `action`. */
  extra?: { label: string; onChoose(): void };
  onCancel(): void;
  onConfirm(): void;
};

export function ConfirmDialog({ title, detail, action, extra, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
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
    <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-96 rounded-lg border border-border bg-card p-5 space-y-4"
      >
        <div id="confirm-dialog-title" className="text-base font-medium text-foreground">
          {title}
        </div>
        {detail && <div className="text-sm text-muted-foreground">{detail}</div>}
        <div className="flex justify-end gap-2">
          <button ref={cancel} onClick={onCancel} className="text-sm text-foreground border border-border rounded-md px-3 py-1.5">
            Cancel
          </button>
          {extra && (
            <button onClick={extra.onChoose} className="text-sm text-foreground border border-border rounded-md px-3 py-1.5">
              {extra.label}
            </button>
          )}
          <button onClick={onConfirm} className="text-sm bg-error text-black rounded-md px-3 py-1.5">
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
