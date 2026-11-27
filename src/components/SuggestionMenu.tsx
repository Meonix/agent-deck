import { File, Folder } from "lucide-react";
import { useEffect } from "react";
import type { CommandSource } from "../api/sessions";
import { labels } from "../labels";
import { ICON } from "./icon";
import type { MenuView } from "./useSuggestionMenu";

const TAG: Record<CommandSource, string | null> = {
  builtin: null,
  "user-skill": labels.tagSkill,
  "workspace-skill": labels.tagSkill,
  "user-command": labels.tagCommand,
  "workspace-command": labels.tagCommand,
  plugin: labels.tagPlugin,
};

const ROW = "mx-1 rounded-row px-3 h-8 flex items-center gap-2 cursor-default";

/** The "/" or "@" menu above the Composer field (design cr016 #composer-menus). */
export function SuggestionMenu({ menu, choose }: { menu: MenuView; choose(index: number): void }) {
  const activeId = `${menu.id}-${menu.active}`;
  useEffect(() => {
    // jsdom has no scrollIntoView.
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const row = (i: number, body: React.ReactNode) => (
    <div
      key={i}
      id={`${menu.id}-${i}`}
      role="option"
      aria-selected={i === menu.active}
      className={`${ROW} ${i === menu.active ? "pick-on" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        choose(i);
      }}
    >
      {body}
    </div>
  );

  // 18.25rem: the heading and 8 rows of h-8 fit; more rows scroll.
  return (
    <div
      id={menu.id}
      role="listbox"
      aria-label={menu.heading}
      className="menu absolute bottom-full left-0 z-20 mb-1 max-h-[18.25rem] w-[380px] max-w-full overflow-y-auto py-1"
    >
      <div aria-hidden title={menu.heading} className="truncate px-3 py-1 side-label">
        {menu.heading}
      </div>
      {menu.kind === "command"
        ? menu.rows.map((c, i) => {
            const tag = TAG[c.source];
            return row(
              i,
              <>
                <span className="max-w-[70%] shrink-0 truncate font-mono">/{c.name}</span>
                <span className="sub min-w-0 truncate text-[12px]">
                  {tag && `${tag} · `}
                  {c.description}
                </span>
              </>,
            );
          })
        : menu.rows.map((f, i) =>
            row(
              i,
              <>
                {f.dir ? <Folder {...ICON} className="shrink-0" /> : <File {...ICON} className="shrink-0" />}
                <span className="min-w-0 truncate font-mono text-[12px]">{f.path}</span>
              </>,
            ),
          )}
    </div>
  );
}
