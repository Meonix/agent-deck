import { BOARD_STATES, type BoardState, type Card, boardCards } from "./statusBoard";
import { StateMarker, tone } from "./statusTone";
import type { PaneEntry } from "./TerminalPane";

export function StatusBoard({ entries, onJump }: { entries: PaneEntry[]; onJump(paneId: string): void }) {
  const cards = boardCards(entries);
  return (
    <aside aria-label="Status Board" className="bg-card overflow-auto p-3 space-y-4 border-l border-border">
      <div className="text-sm font-medium text-foreground">Status Board</div>
      {BOARD_STATES.map((state) => (
        <div key={state} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide">
            <span className={`flex items-center gap-1.5 ${tone[state].text}`}>
              <StateMarker state={state} />
              {state}
            </span>
            <span className="text-muted-foreground">{cards[state].length}</span>
          </div>
          {cards[state].length > 0 ? (
            cards[state].map((card) => <CardView key={card.paneId} card={card} state={state} onJump={onJump} />)
          ) : (
            <div className="rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
              Nothing here
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}

function CardView({ card, state, onJump }: { card: Card; state: BoardState; onJump(paneId: string): void }) {
  return (
    <button
      type="button"
      aria-label={`${card.workspaceName} · ${card.title}, ${state}`}
      onClick={() => onJump(card.paneId)}
      onKeyDown={(e) => {
        // Activating on Enter's keydown, with the default stopped, keeps the rest of that Enter out of the terminal it focuses.
        if (e.key !== "Enter") return;
        e.preventDefault();
        onJump(card.paneId);
      }}
      className={`block w-full text-left cursor-pointer rounded-md border border-border border-l-4 ${tone[state].edge} bg-card px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <span className="block text-sm text-foreground truncate">{card.title}</span>
      <span className="block text-xs text-muted-foreground truncate">
        {card.workspaceName} · {clock(card.since)}
        {card.reason !== null && (
          <>
            {" · "}
            <span className={tone[state].text}>{card.reason}</span>
          </>
        )}
      </span>
    </button>
  );
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
