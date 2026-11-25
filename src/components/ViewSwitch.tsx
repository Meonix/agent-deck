import { labels } from "../labels";

export type PaneView = "chat" | "term" | "shell" | "plan";

const VIEWS: PaneView[] = ["chat", "term", "shell", "plan"];
// Chat (backlog item 38) and Plan (item 43) are not built yet.
const UNAVAILABLE = new Set<PaneView>(["chat", "plan"]);

export const isAvailable = (view: PaneView) => !UNAVAILABLE.has(view);

type Props = {
  view: PaneView;
  /** What a hidden shell runs; null while it is shown, at its prompt or absent (SRS-FR-058). */
  shellCommand: string | null;
  /** A narrow header: the items not built yet and the shell command make room for the pane buttons. */
  compact?: boolean;
  onChoose(view: PaneView): void;
};

/**
 * Toggle buttons rather than a radiogroup: arrow keys would select in a radiogroup, and every choice
 * moves focus into the terminal anyway.
 */
export function ViewSwitch({ view, shellCommand, compact = false, onChoose }: Props) {
  const command = compact ? null : shellCommand;
  return (
    <div role="group" aria-label={labels.viewSwitch} className="seg min-w-0">
      {VIEWS.filter((v) => !compact || isAvailable(v)).map((v) => {
        const unavailable = !isAvailable(v);
        const running = v === "shell" && command;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={v === view}
            aria-disabled={unavailable || undefined}
            title={unavailable ? labels.viewNotReady : undefined}
            onClick={() => onChoose(v)}
            className={`${v === view ? "seg-on" : ""} ${running ? "flex min-w-0 gap-1" : ""}`}
          >
            {running ? <ShellRunning command={running} /> : labels.views[v]}
          </button>
        );
      })}
    </div>
  );
}

function ShellRunning({ command }: { command: string }) {
  const [lead, name] = labels.shellRunning(command);
  // Flex drops the space between the spans from the layout, so the gap draws it.
  return (
    <>
      <span>{lead}</span> <span className="min-w-0 max-w-[140px] truncate font-mono">{name}</span>
    </>
  );
}
