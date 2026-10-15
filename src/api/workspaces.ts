import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type Workspace = { id: string; name: string; path: string; missing: boolean };
export type AddResult = { outcome: "added" | "alreadyPresent"; id: string };
export type RemoveResult =
  | { ok: true }
  | { ok: false; reason: "has_open_panes" | "not_found" | "io"; message?: string };

export interface WorkspacesClient {
  list(): Promise<Workspace[]>;
  pickFolder(): Promise<string | null>;
  add(path: string): Promise<AddResult>;
  remove(id: string): Promise<RemoveResult>;
}

export const tauriWorkspacesClient: WorkspacesClient = {
  list: () => invoke<Workspace[]>("list_workspaces"),

  async pickFolder() {
    const picked = await open({ directory: true, multiple: false });
    return typeof picked === "string" ? picked : null;
  },

  add: (path) => invoke<AddResult>("add_workspace", { path }),

  async remove(id) {
    try {
      await invoke<void>("remove_workspace", { id });
      return { ok: true };
    } catch (e) {
      const message = String(e);
      if (message === "has_open_panes" || message === "not_found") {
        return { ok: false, reason: message };
      }
      return { ok: false, reason: "io", message };
    }
  },
};
