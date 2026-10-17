import React from "react";
import ReactDOM from "react-dom/client";
import { tauriDiagClient } from "./api/diag";
import { tauriSessionsClient } from "./api/sessions";
import { tauriWorkspacesClient } from "./api/workspaces";
import App from "./App";
import { createXtermAdapter } from "./components/xtermAdapter";
import { installErrorHooks } from "./diagnostics";
import "./index.css";

installErrorHooks(tauriDiagClient, window);

const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
const applyScheme = () => document.documentElement.classList.toggle("dark", darkScheme.matches);
applyScheme();
darkScheme.addEventListener("change", applyScheme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App
      workspaces={tauriWorkspacesClient}
      sessions={tauriSessionsClient}
      createTerminal={createXtermAdapter}
      diag={tauriDiagClient}
    />
  </React.StrictMode>,
);
