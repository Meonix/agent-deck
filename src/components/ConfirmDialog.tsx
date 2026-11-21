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
    // One UI sheet: near the bottom, over the blurred, dimmed window.
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-dim pb-16 backdrop-blur-oneui">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="flex w-[520px] max-w-[calc(100%-2rem)] flex-col gap-2 rounded-card bg-surface p-6 shadow-oneui"
      >
        <div id="confirm-dialog-title" className="text-[17px] font-semibold text-foreground">
          {title}
        </div>
        {detail && <div className="text-[13px] text-muted-foreground">{detail}</div>}
        <div className="-mx-2 mt-3 flex items-center">
          <button ref={cancel} onClick={onCancel} className={`${CHOICE} text-foreground`}>
            Cancel
          </button>
          {extra && (
            <>
              <Rule />
              <button onClick={extra.onChoose} className={`${CHOICE} text-accent-foreground`}>
                {extra.label}
              </button>
            </>
          )}
          <Rule />
          <button onClick={onConfirm} className={`${CHOICE} text-error-foreground`}>
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

const CHOICE = "h-10 flex-1 whitespace-nowrap rounded-full px-2 text-[14px] font-semibold hover:bg-muted transition-colors";

function Rule() {
  return <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />;
}
