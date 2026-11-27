import { Hand } from "lucide-react";
import { labels } from "../labels";
import { ICON } from "./icon";

/** The tool asking for permission, when known, and its command or file. */
export type Strip = { tool: string | null; detail: string };

type Props = { strip: Strip; onAllow(): void; onDeny(): void };

/** A pending tool permission above the Composer (SRS-FR-163, SRS-FR-164). */
export function ApprovalStrip({ strip, onAllow, onDeny }: Props) {
  return (
    <div role="group" aria-label={labels.permissionGroup} className="strip mx-3 mb-2 flex shrink-0 items-start gap-2 px-3 py-2 text-[13px]">
      <Hand {...ICON} className="mt-1 shrink-0" />
      {/* All of what is approved shows, its lines kept: up to four rows, then it scrolls. */}
      <span className="flex min-w-0 flex-1 items-start gap-1 leading-5 py-0.5">
        {strip.tool && (
          <span className="shrink-0">
            <b>{strip.tool}</b> ·{" "}
          </span>
        )}
        <span title={strip.detail} className="max-h-20 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-all font-mono">
          {strip.detail}
        </span>
      </span>
      <div className="strip-actions">
        <button type="button" onClick={onDeny} className="deny shrink-0 px-3 py-1">
          {labels.deny}
        </button>
        <button type="button" onClick={onAllow} className="allow shrink-0 px-3 py-1">
          {labels.allow}
        </button>
      </div>
    </div>
  );
}
