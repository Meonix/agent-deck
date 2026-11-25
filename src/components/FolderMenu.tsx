import { Copy, Ellipsis, FolderMinus, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Workspace } from "../api/workspaces";
import { labels } from "../labels";
import { ICON } from "./icon";
import { useToast } from "./Toast";

const MENU_W = 220;
const ITEM =
  "flex h-8 w-full items-center gap-2 px-3 text-left text-[13px] outline-none hover:bg-muted focus-visible:bg-muted";

/** ⋯ on a workspace row and the Folder Menu it opens (SRS-FR-143). */
export function FolderMenu({ workspace, onRemove, hidden }: { workspace: Workspace; onRemove(id: string): void; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const showToast = useToast();

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);

  // Fixed to the viewport, so the Sidebar's scroll box cannot clip it.
  const show = () => {
    const r = button.current!.getBoundingClientRect();
    setAt({ top: r.bottom + 4, left: Math.max(4, Math.min(r.left, window.innerWidth - MENU_W - 4)) });
    setOpen(true);
  };
  // Near the window's bottom it opens upward instead; measured before paint.
  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    const r = button.current.getBoundingClientRect();
    const h = menu.current.offsetHeight;
    if (r.bottom + 4 + h > window.innerHeight) setAt((cur) => cur && { ...cur, top: Math.max(4, r.top - h - 4) });
  }, [open]);

  // A hidden ⋯ cannot take focus back, so this one only closes.
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  useEffect(() => {
    if (!open) return;
    items(menu.current).find((i) => i.getAttribute("aria-disabled") !== "true")?.focus();
    const outside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menu.current?.contains(target) || button.current?.contains(target)) return;
      setOpen(false);
      // A click on something focusable, a terminal included, keeps that focus; anywhere else focus goes back to ⋯.
      setTimeout(() => {
        if (document.activeElement === document.body || document.activeElement === null) button.current?.focus();
      });
    };
    // The position is measured once on open, so anything that moves ⋯ closes the menu; capture sees every scroller.
    document.addEventListener("mousedown", outside);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const all = items(menu.current);
      const step = e.key === "ArrowDown" ? 1 : -1;
      all[(all.indexOf(document.activeElement as HTMLElement) + step + all.length) % all.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const copyPath = () => {
    close();
    // The webview may refuse the clipboard; say so rather than fail silently (SRS-FR-144).
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(workspace.path))
      .catch(() => showToast(labels.copyPathFailed));
  };

  return (
    <>
      <button
        ref={button}
        aria-label={labels.folderMenu(workspace.name)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : show())}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Ellipsis {...ICON} />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={labels.folderMenu(workspace.name)}
          onKeyDown={onKeyDown}
          style={at ?? undefined}
          className="menu fixed z-20 w-[220px] py-1"
        >
          {/* Shown, not yet usable: the Files View comes with backlog item 44 (SRS-FR-174). */}
          <button role="menuitem" tabIndex={-1} aria-disabled="true" className={`${ITEM} cursor-default text-muted-foreground`}>
            <FolderOpen {...ICON} />
            {labels.viewFiles}
          </button>
          <button role="menuitem" tabIndex={-1} onClick={copyPath} className={`${ITEM} text-foreground`}>
            <Copy {...ICON} />
            {labels.copyPath}
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              close();
              onRemove(workspace.id);
            }}
            className={`${ITEM} w-err`}
          >
            <FolderMinus {...ICON} />
            {labels.removeFolder}
          </button>
        </div>
      )}
    </>
  );
}

function items(menu: HTMLElement | null): HTMLElement[] {
  return menu ? [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')] : [];
}
