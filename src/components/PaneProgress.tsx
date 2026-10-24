import { useEffect, useRef } from "react";
import type { PaneProgress } from "../api/sessions";

const ROW_REM = 1.5;
const MAX_ROWS = 4;

// Mouse down would move focus off the terminal, and the user keeps typing while answering.
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

export function TrackingPrompt({ onAnswer }: { onAnswer(on: boolean): void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-card text-xs text-muted-foreground">
      <span className="flex-1">Track progress for this session?</span>
      <button
        onMouseDown={keepFocus}
        onClick={() => onAnswer(true)}
        className="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground"
      >
        Track
      </button>
      <button
        onMouseDown={keepFocus}
        onClick={() => onAnswer(false)}
        className="rounded-md border border-border px-2 py-0.5 text-foreground hover:bg-muted"
      >
        No
      </button>
    </div>
  );
}

export function ProgressStrip({ progress, onSetCollapsed }: { progress: PaneProgress; onSetCollapsed(collapsed: boolean): void }) {
  const { checkpoints, collapsed, updating, failed } = progress;
  const list = useRef<HTMLUListElement>(null);
  const lastOpen = useRef<HTMLLIElement>(null);
  const done = checkpoints.filter((c) => c.done).length;
  const open = checkpoints.filter((c) => !c.done);
  const head = `Progress · ${done}/${checkpoints.length}`;

  // After every change, so the newest unfinished checkpoint stays visible in the 4-row window (SRS-FR-121).
  // Scrolls the list itself: scrollIntoView would also move the pane around it. Expanding remounts the list at the top.
  useEffect(() => {
    const ul = list.current;
    const row = lastOpen.current;
    if (!ul || !row) return;
    const bottom = row.offsetTop + row.offsetHeight;
    if (row.offsetTop < ul.scrollTop) ul.scrollTop = row.offsetTop;
    else if (bottom > ul.scrollTop + ul.clientHeight) ul.scrollTop = bottom - ul.clientHeight;
  }, [checkpoints, collapsed]);

  return (
    <div role="region" aria-label="Progress" className="border-b border-border bg-card text-xs">
      <div className="flex items-center gap-2 px-3" style={{ height: `${ROW_REM}rem` }}>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {collapsed && open.length > 0 ? `${head} · ${open[open.length - 1].summary}` : head}
        </span>
        {updating && <span aria-label="Updating" className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-approval" />}
        {failed && <span className="shrink-0 text-approval">Couldn't update</span>}
        <button
          aria-label={collapsed ? "Expand progress" : "Collapse progress"}
          onMouseDown={keepFocus}
          onClick={() => onSetCollapsed(!collapsed)}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>
      {!collapsed && (
        <ul
          ref={list}
          aria-label="Checkpoints"
          className="relative overflow-y-auto border-t border-border"
          style={{ maxHeight: `calc(${MAX_ROWS * ROW_REM}rem + 1px)` }}
        >
          {checkpoints.map((c, i) => (
            <li
              key={i}
              ref={c === open[open.length - 1] ? lastOpen : undefined}
              className="flex items-center gap-2 px-3"
              style={{ height: `${ROW_REM}rem` }}
            >
              <span className={`shrink-0 ${c.done ? "text-running" : "text-approval"}`}>{c.done ? "✓" : "●"}</span>
              <span className="min-w-0 truncate text-foreground">{c.summary}</span>
              {c.result !== "" && <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.result}</span>}
              <span className="ml-auto shrink-0 text-muted-foreground">{c.startedAt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
