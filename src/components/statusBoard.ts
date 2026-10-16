import type { PaneEntry } from "./TerminalPane";

export type BoardState = "Needs Approval" | "Error" | "Running";
export type Card = { paneId: string; workspaceName: string; title: string; since: number; reason: string | null };

// Section order of the board.
export const BOARD_STATES: BoardState[] = ["Needs Approval", "Error", "Running"];

export function boardCards(entries: PaneEntry[]): Record<BoardState, Card[]> {
  const cards: Record<BoardState, Card[]> = { "Needs Approval": [], Error: [], Running: [] };
  for (const { pane, workspaceName, title, status } of entries) {
    if (!status.tracked || !(status.state in cards)) continue;
    cards[status.state as BoardState].push({
      paneId: pane.paneId,
      workspaceName,
      title,
      since: status.since,
      reason: status.reason,
    });
  }
  return cards;
}
