import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

const STOPS = "button:not(:disabled), input:not(:disabled)";

type Options = {
  /** False while a dialog stacked above owns the keys: listeners off, focus left where that dialog puts it. */
  active?: boolean;
  /** Where focus goes when the hook ends, read then; null sends it nowhere. Defaults to what had focus at activation. */
  returnTo?: RefObject<HTMLElement | null>;
};

/**
 * Keeps keys and focus inside a modal dialog: initial focus, Tab cycling, Esc, a guard against focus leaving,
 * and focus back where it came from once the dialog goes.
 */
export function useModalFocus(
  dialog: RefObject<HTMLElement | null>,
  initial: RefObject<HTMLElement | null>,
  onEscape: () => void,
  { active = true, returnTo }: Options = {},
) {
  const latest = useRef({ onEscape, returnTo });
  useLayoutEffect(() => {
    latest.current = { onEscape, returnTo };
  });
  /** What had focus at activation; undefined until the first activation. */
  const before = useRef<Element | null | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    if (before.current === undefined) {
      before.current = document.activeElement;
      initial.current?.focus();
    }
    // Capture phase on the document, so neither Esc nor Tab reaches a terminal behind the scrim.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return latest.current.onEscape();
      const stops = [...(dialog.current?.querySelectorAll<HTMLElement>(STOPS) ?? [])];
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = at === -1 ? (e.shiftKey ? stops.length - 1 : 0) : at + (e.shiftKey ? -1 : 1);
      stops[(next + stops.length) % stops.length]?.focus();
    };
    const onFocus = (e: FocusEvent) => {
      if (!dialog.current?.contains(e.target as Node)) initial.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, [active, dialog, initial]);

  // Declared after the listeners, so they are gone before focus moves back: the guard would pull it in again.
  useEffect(
    () => () => {
      if (before.current === undefined) return;
      const { returnTo } = latest.current;
      const to = returnTo ? returnTo.current : before.current;
      before.current = undefined;
      if (to instanceof HTMLElement && to.isConnected) to.focus();
    },
    [],
  );
}
