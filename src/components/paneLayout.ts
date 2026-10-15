/** Places `newId` right after the focused pane, or at the end when nothing is focused. */
export function insertRight(order: string[], focusedId: string | null, newId: string): string[] {
  const at = focusedId === null ? -1 : order.indexOf(focusedId);
  if (at === -1) return [...order, newId];
  return [...order.slice(0, at + 1), newId, ...order.slice(at + 1)];
}
