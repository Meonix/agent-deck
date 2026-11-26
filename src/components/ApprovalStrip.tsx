import { Hand } from "lucide-react";
import { labels } from "../labels";
import { ICON } from "./icon";

/** The tool asking for permission, when known, and its command or file. */
export type Strip = { tool: string | null; detail: string };

type Props = { strip: Strip; onAllow(): void; onDeny(): void };

/** A pending tool permission above the Composer (SRS-FR-163, SRS-FR-164). */
export function ApprovalStrip({ strip, onAllow, onDeny }: Props) {
  const text = strip.tool ? `${strip.tool} · ${strip.detail}` : strip.detail;
  return (
    <div role="group" aria-label={labels.permissionGroup} className="strip flex shrink-0 items-center gap-2 px-3 py-2 text-[13px]">
      <Hand {...ICON} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={text}>
        {strip.tool && (
          <>
            <b>{strip.tool}</b> ·{" "}
          </>
        )}
        <span className="font-mono">{strip.detail}</span>
      </span>
      <button type="button" onClick={onDeny} className="deny shrink-0 px-3 py-1">
        {labels.deny}
      </button>
      <button type="button" onClick={onAllow} className="allow shrink-0 px-3 py-1">
        {labels.allow}
      </button>
    </div>
  );
}
