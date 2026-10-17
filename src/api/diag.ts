import { invoke } from "@tauri-apps/api/core";
import type { DiagClient } from "../diagnostics";

export const tauriDiagClient: DiagClient = {
  log: (level, source, message) => invoke<void>("diag_log", { level, source, message }),
  report: (report) => invoke<void>("diag_report", { report }),
};
