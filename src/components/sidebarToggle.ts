/** The Sidebar shortcut: Cmd+B on macOS, Ctrl+B elsewhere (SRS-FR-089). */

type ToggleKeys = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** The other modifier stays with the terminal, as for the Zoom shortcut. */
export function sidebarShortcut(e: ToggleKeys, mac: boolean): boolean {
  const modifier = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  return modifier && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b";
}
