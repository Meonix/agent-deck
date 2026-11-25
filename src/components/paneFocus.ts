/**
 * Whether a view of the pane around `inside` may take the keyboard on its own: nothing has it,
 * or it is already in this pane. Otherwise the user has moved on to another pane.
 */
export function mayTakeFocus(inside: Element | null): boolean {
  const active = document.activeElement;
  if (!active || active === document.body) return true;
  return inside?.closest("[data-pane]")?.contains(active) ?? false;
}
