import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listenForDrops } from "./components/dropTargets";
import { tauriDiagClient } from "./api/diag";
import { tauriSessionsClient } from "./api/sessions";
import { tauriWorkspacesClient } from "./api/workspaces";
import { tauriZoomClient } from "./api/zoom";
import App from "./App";
import { createXtermAdapter } from "./components/xtermAdapter";
import { installErrorHooks } from "./diagnostics";
import "./index.css";

installErrorHooks(tauriDiagClient, window);

const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
const applyScheme = () => document.documentElement.classList.toggle("dark", darkScheme.matches);
applyScheme();
darkScheme.addEventListener("change", applyScheme);

listenForDrops((cb) => getCurrentWebview().onDragDropEvent(cb));

const mac = navigator.userAgent.includes("Mac");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App
      workspaces={tauriWorkspacesClient}
      sessions={tauriSessionsClient}
      createTerminal={() => createXtermAdapter({ mac })}
      diag={tauriDiagClient}
      zoom={tauriZoomClient}
      mac={mac}
    />
  </React.StrictMode>,
);
