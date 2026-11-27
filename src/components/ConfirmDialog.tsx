import { type ReactNode, useRef } from "react";
import { labels } from "../labels";
import { useModalFocus } from "./useModalFocus";

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
  // An Escape reaching the terminal behind would interrupt the turn the user keeps.
  useModalFocus(dialog, cancel, onCancel);
  return (
    <div className="scrim absolute inset-0 z-10 flex items-center justify-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="dlg flex w-[400px] max-w-[calc(100%-2rem)] flex-col gap-3"
      >
        <div id="confirm-dialog-title" className="text-[14px] font-semibold text-foreground">
          {title}
        </div>
        {detail && <div className="text-[12px] text-muted-foreground">{detail}</div>}
        <div className="dlg-actions">
          <button ref={cancel} onClick={onCancel} className="outline-btn hover:opacity-80 transition-opacity">
            {labels.cancel}
          </button>
          {extra && (
            <button onClick={extra.onChoose} className="outline-btn hover:opacity-80 transition-opacity">
              {extra.label}
            </button>
          )}
          <button onClick={onConfirm} className={`${danger ? "btn-danger" : "allow"} hover:opacity-80 transition-opacity`}>
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
