import type { SessionState } from "../api/sessions";
import { type Activity, activityParts } from "./chatState";

const NONE: Activity = { tool: null, arg: null, context: null, shells: 0, subagents: 0 };

/** What a running session is doing, under the Chat log (SRS-FR-152). */
export function ActivityBar({ state, activity }: { state: SessionState; activity: Activity | null }) {
  if (state !== "Running") return null;
  const a = activity ?? NONE;
  const counts = activityParts(a);
  return (
    <div role="status" className="sub flex h-7 shrink-0 items-center gap-3 border-t border-border px-3 text-[11px]">
      <span className="dot dot-busy" />
      {a.tool && (
        <span className="min-w-0 truncate">
          {a.tool}
          {a.arg && (
            <>
              {" "}
              <span className="font-mono">{a.arg}</span>
            </>
          )}
        </span>
      )}
      <span className="flex-1" />
      {/* The gap parts the two sides on screen; a reader hears the SRS wording. */}
      {a.tool && counts.length > 0 && <span className="sr-only"> · </span>}
      {counts.length > 0 && (
        <span className="shrink-0 whitespace-nowrap">
          {counts.map((text, i) => (
            <span key={text}>
              {i > 0 && " · "}
              <span className={i === 0 && a.context !== null ? "ctx-ok" : undefined}>{text}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
