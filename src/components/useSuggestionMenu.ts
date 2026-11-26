import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CommandItem, FileEntry, FileList } from "../api/sessions";
import { labels } from "../labels";
import { apply, BUILTIN_COMMANDS, matchCommands, matchFiles, mergeCommands, trigger } from "./suggestions";

export type SuggestSource = { commands(): Promise<CommandItem[]>; files(): Promise<FileList> };

export type MenuView = { id: string; heading: string; active: number } & (
  | { kind: "command"; rows: CommandItem[] }
  | { kind: "file"; rows: FileEntry[] }
);

// null while the fetch is pending; a failed command fetch holds [] so the built-ins still show.
type Held = { kind: "command"; items: CommandItem[] | null } | { kind: "file"; list: FileList | null };

const pending = (kind: "command" | "file"): Held => (kind === "command" ? { kind, items: null } : { kind, list: null });

/** The "/" and "@" menus of the Composer (SRS-FR-159, SRS-FR-160; design.md › Choosing, Loading). */
export function useSuggestionMenu(
  source: SuggestSource,
  text: string,
  caret: number,
  onApply: (next: { text: string; caret: number }) => void,
): {
  menu: MenuView | null;
  onKey(e: KeyboardEvent<HTMLTextAreaElement>): boolean;
  choose(index: number): void;
} {
  const id = useId();
  const t = trigger(text, caret);
  const kind = t?.kind ?? null;

  const [held, setHeld] = useState<Held | null>(null);
  if ((held?.kind ?? null) !== kind) setHeld(kind && pending(kind));

  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!t && dismissed !== null) setDismissed(null);

  const sourceRef = useRef(source);
  sourceRef.current = source;
  useEffect(() => {
    if (!kind) return;
    let live = true;
    if (kind === "command") {
      sourceRef.current.commands().then(
        (items) => live && setHeld({ kind, items }),
        () => live && setHeld({ kind, items: [] }),
      );
    } else {
      sourceRef.current.files().then(
        (list) => live && setHeld({ kind, list }),
        () => {},
      );
    }
    return () => {
      live = false;
    };
  }, [kind]);

  const query = t?.query ?? "";
  const view = useMemo((): Omit<MenuView, "id" | "active"> | null => {
    if (!held || held.kind !== kind) return null;
    if (held.kind === "command") {
      if (!held.items) return null;
      return { kind: "command", heading: labels.menuCommands, rows: matchCommands(mergeCommands(BUILTIN_COMMANDS, held.items), query) };
    }
    if (!held.list) return null;
    return { kind: "file", heading: labels.menuFiles(held.list.folder), rows: matchFiles(held.list.entries, query) };
  }, [held, kind, query]);

  const highlightKey = `${kind}:${query}`;
  const [highlight, setHighlight] = useState({ key: "", index: 0 });

  const shown = t && view && view.rows.length > 0 && dismissed !== `${t.kind}:${t.start}` ? view : null;
  const menu = shown && ({ ...shown, id, active: highlight.key === highlightKey ? Math.min(highlight.index, shown.rows.length - 1) : 0 } as MenuView);

  const choose = (index: number) => {
    if (!t || !menu) return;
    if (menu.kind === "command") {
      const row = menu.rows[index];
      if (row) onApply(apply(text, t, { kind: "command", name: row.name }));
    } else {
      const row = menu.rows[index];
      if (row) onApply(apply(text, t, { kind: "file", entry: row }));
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!t || !menu || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false;
    const n = menu.rows.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight({ key: highlightKey, index: (menu.active + step + n) % n });
    } else if (e.key === "Tab" || e.key === "Enter") {
      choose(menu.active);
    } else if (e.key === "Escape") {
      setDismissed(`${t.kind}:${t.start}`);
    } else {
      return false;
    }
    e.preventDefault();
    return true;
  };

  return { menu, onKey, choose };
}
