import { useEffect, useRef } from "react";

type Props = { workspaceName: string; title: string; onCancel(): void; onConfirm(): void };

export function ConfirmClose({ workspaceName, title, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    // Capture phase on the document, so neither Escape nor Tab reaches the terminal
    // behind the overlay: an Escape there would interrupt the turn the user keeps.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return onCancel();
      const next = document.activeElement === cancel.current ? confirm.current : cancel.current;
      next?.focus();
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
        aria-labelledby="confirm-close-title"
        className="w-96 rounded-lg border border-border bg-card p-5 space-y-4"
      >
        <div id="confirm-close-title" className="text-base font-medium text-foreground">
          Session is still running. Close anyway?
        </div>
        <div className="text-sm text-muted-foreground">
          {workspaceName} · {title} will be ended.
        </div>
        <div className="flex justify-end gap-2">
          <button ref={cancel} onClick={onCancel} className="text-sm text-foreground border border-border rounded-md px-3 py-1.5">
            Cancel
          </button>
          <button ref={confirm} onClick={onConfirm} className="text-sm bg-error text-black rounded-md px-3 py-1.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
