import { useEffect, useRef } from "react";

type Props = { workspaceName: string; title: string; onCancel(): void; onConfirm(): void };

export function ConfirmClose({ workspaceName, title, onCancel, onConfirm }: Props) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div
      className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div
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
          <button onClick={onConfirm} className="text-sm bg-error text-black rounded-md px-3 py-1.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
