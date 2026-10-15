import { tauriWorkspacesClient } from "./api/workspaces";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";

function App() {
  return (
    <div className="h-screen relative flex flex-col bg-background text-foreground font-sans">
      <div className="h-9 flex items-center px-4 border-b border-border bg-card">
        <span className="text-sm font-medium text-foreground">agent-deck</span>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr]">
        <WorkspaceSidebar client={tauriWorkspacesClient} />
      </div>
    </div>
  );
}

export default App;
