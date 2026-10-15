import { Children, type ReactNode } from "react";

export function PaneGrid({ children }: { children: ReactNode }) {
  const columns = Children.count(children);
  return (
    <div
      data-testid="pane-grid"
      className="h-full min-h-0 grid gap-2 p-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
    >
      {children}
    </div>
  );
}
