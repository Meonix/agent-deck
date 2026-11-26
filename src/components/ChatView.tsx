import { Bot, FilePlus, FileText, Pencil, Search, Terminal, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import { type RefObject, useId, useLayoutEffect, useRef, useState } from "react";
import { labels } from "../labels";
import type { ChatEntry, ChatState } from "./chatState";
import { ICON } from "./icon";

// Within this distance of the bottom the log keeps following new entries.
const FOLLOW_PX = 40;

const FAMILY: Record<string, LucideIcon> = {
  Read: FileText,
  Edit: Pencil,
  MultiEdit: Pencil,
  Write: FilePlus,
  NotebookEdit: FilePlus,
  Bash: Terminal,
  Grep: Search,
  Glob: Search,
  WebFetch: Search,
  WebSearch: Search,
  Agent: Bot,
  Task: Bot,
};

/** The conversation of a pane's session, read from its transcript (SRS-FR-149). */
export function ChatView({
  chat,
  paneId,
  boxRef,
  started = true,
}: {
  chat: ChatState;
  paneId?: string;
  boxRef?: RefObject<HTMLDivElement | null>;
  started?: boolean;
}) {
  const own = useRef<HTMLDivElement>(null);
  const box = boxRef ?? own;
  const atBottom = useRef(true);

  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat]);

  return (
    <div
      ref={box}
      role="log"
      data-chat-log={paneId}
      aria-label={labels.chatLog}
      aria-live="polite"
      aria-busy={chat.loading || undefined}
      tabIndex={-1}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_PX;
      }}
      className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 text-[13px] text-foreground outline-none"
    >
      {!started ? (
        <div className="font-mono text-xs leading-5">
          <div>{labels.startFailed}</div>
          <div className="mt-5">{labels.startFailedHint}</div>
        </div>
      ) : chat.unreadable ? (
        <div className="callout-err px-3 py-2 text-[12px] flex gap-2">
          <TriangleAlert {...ICON} />
          {labels.chatUnreadable}
        </div>
      ) : chat.loading ? (
        <>
          <div className="skel self-end h-8 w-1/2 rounded-[15px]" />
          <div className="skel h-3 w-3/4 rounded" />
          <div className="skel h-3 w-2/3 rounded" />
          <div className="skel h-3 w-1/2 rounded" />
        </>
      ) : (
        chat.items.map((entry) => <Entry key={entry.key} entry={entry} />)
      )}
    </div>
  );
}

function Entry({ entry }: { entry: ChatEntry }) {
  if (entry.kind === "prompt")
    return <div className="bubble self-end max-w-[70%] px-3 py-2 whitespace-pre-wrap break-words">{entry.text}</div>;
  if (entry.kind === "reply")
    return <div className="max-w-[85%] leading-relaxed whitespace-pre-wrap break-words">{entry.text}</div>;
  return <ToolCard tool={entry} />;
}

function ToolCard({ tool }: { tool: Extract<ChatEntry, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const resultId = useId();
  const Icon = FAMILY[tool.name] ?? Wrench;
  const result = open ? tool.result : null;
  return (
    <div className="flex flex-col min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={result ? resultId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="tool pl-3 py-1 flex items-center gap-2 min-w-0 text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
      >
        <Icon {...ICON} />
        <span className="shrink-0">{tool.name}</span>
        {tool.arg && (
          <>
            {" "}
            <span className="min-w-0 truncate font-mono text-[12px]">{tool.arg}</span>
          </>
        )}
        {!tool.result && (
          <>
            {" "}
            <span className="sub shrink-0 text-[12px]">{labels.toolRunning}</span>
          </>
        )}
      </button>
      {result && (
        <pre
          id={resultId}
          className={`ml-3 mt-1 max-h-80 overflow-auto pl-3 font-mono text-[12px] leading-5 whitespace-pre-wrap break-words ${result.isError ? "w-err" : ""}`}
        >
          {result.text}
        </pre>
      )}
    </div>
  );
}
