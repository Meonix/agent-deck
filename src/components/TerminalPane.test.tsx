import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAdapter, fakeSessions, fakeStream, type FakeAdapter } from "../test/fakes";
import { TerminalPane, UNTITLED, type PaneEntry } from "./TerminalPane";

function entry(adapter: FakeAdapter | null, over: Partial<PaneEntry> = {}): PaneEntry {
  return {
    pane: { paneId: "p1", sessionId: "s1", started: adapter !== null },
    workspaceId: "w",
    openedAt: 1,
    workspaceName: "agent-deck",
    adapter,
    stream: fakeStream(),
    openedSize: { cols: 80, rows: 24 },
    ended: false,
    title: UNTITLED,
    graceOver: false,
    status: { state: "Idle", since: 1, reason: null, tracked: false, reportedAt: null },
    shell: null,
    shellFailed: false,
    prompted: false,
    goal: null,
    ...over,
  };
}

function renderPane(e: PaneEntry, client = fakeSessions(), on = { focus: vi.fn(), close: vi.fn(), setGoal: vi.fn() }, focused = true) {
  const view = render(
    <TerminalPane entry={e} client={client} focused={focused} maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} onFocus={on.focus} onClose={on.close} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={on.setGoal} />,
  );
  return { client, on, view };
}

const flush = () => act(async () => {});

/** Returns a function that fires the observer callback, as a layout change would. */
function stubResizeObserver() {
  let callback: () => void = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  return () => callback();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TerminalPane (5.3)", () => {
  it("opens the terminal in the pane body and focuses it", async () => {
    const adapter = fakeAdapter();
    renderPane(entry(adapter));
    await flush();
    expect(adapter.open).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(adapter.focus).toHaveBeenCalled();
  });

  it("sends typed input to the session", async () => {
    const adapter = fakeAdapter();
    const { client } = renderPane(entry(adapter));
    await flush();
    adapter.type("hi\r");
    expect(client.write).toHaveBeenCalledWith("p1", "hi\r");
  });

  it("resizes the session when the terminal size changes on a resize observation", async () => {
    const observe = stubResizeObserver();
    const adapter = fakeAdapter({ cols: 80, rows: 24 });
    const { client } = renderPane(entry(adapter));
    await flush();
    expect(client.resize).not.toHaveBeenCalled();

    adapter.size = { cols: 132, rows: 40 };
    act(() => observe());
    expect(client.resize).toHaveBeenCalledWith("p1", 132, 40);

    act(() => observe());
    expect(client.resize).toHaveBeenCalledTimes(1);
  });

  it("fits right after opening and resizes when the pane differs from the opened size", async () => {
    const adapter = fakeAdapter({ cols: 100, rows: 30 });
    const { client } = renderPane(entry(adapter));
    await flush();
    expect(client.resize).toHaveBeenCalledWith("p1", 100, 30);
  });

  it("explains a start failure and takes no input", async () => {
    renderPane(entry(null));
    await flush();
    expect(screen.getByText("Claude Code could not be started")).toBeInTheDocument();
    expect(screen.getByText("Check that Claude Code is installed and on your PATH.")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("keeps the terminal and shows Session ended once the session has ended", async () => {
    const adapter = fakeAdapter();
    const { client, view } = renderPane(entry(adapter));
    await flush();
    view.rerender(
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} />,
    );
    expect(screen.getByText("Session ended")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(adapter.dispose).not.toHaveBeenCalled();
    adapter.type("x");
    expect(client.write).not.toHaveBeenCalled();
  });

  it("refits an ended terminal without resizing the gone session", async () => {
    const observe = stubResizeObserver();
    const adapter = fakeAdapter();
    const { client } = renderPane(entry(adapter, { ended: true }));
    await flush();
    adapter.size = { cols: 132, rows: 40 };
    act(() => observe());
    expect(adapter.fit).toHaveBeenCalledTimes(2);
    expect(client.resize).not.toHaveBeenCalled();
  });

  it("opens xterm in a container without padding, so the fit matches the visible area", async () => {
    const adapter = fakeAdapter();
    renderPane(entry(adapter));
    await flush();
    expect(adapter.container).not.toBeNull();
    expect(adapter.container!.className).not.toMatch(/(^|\s)p[xytrbl]?-/);
  });

  it("sends binary input such as mouse reports to the session, until it ends", async () => {
    const adapter = fakeAdapter();
    const { client, view } = renderPane(entry(adapter));
    await flush();
    adapter.sendBinary("\x1b[M #!");
    expect(client.write).toHaveBeenCalledWith("p1", "\x1b[M #!");
    view.rerender(
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} />,
    );
    adapter.sendBinary("\x1b[M #!");
    expect(client.write).toHaveBeenCalledTimes(1);
  });

  it("asks the parent to close it from the close button", async () => {
    const user = userEvent.setup();
    const { on } = renderPane(entry(fakeAdapter()));
    await user.click(screen.getByRole("button", { name: "Close pane" }));
    expect(on.close).toHaveBeenCalledWith("p1");
  });

  it("shows the state chip with the state name", () => {
    renderPane(entry(fakeAdapter(), { status: { state: "Running", since: 1, reason: null, tracked: true, reportedAt: null } }));
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("shows the pane title from the entry", () => {
    renderPane(entry(fakeAdapter(), { title: "Fix login" }));
    expect(screen.getByRole("region", { name: "agent-deck · Fix login" })).toBeInTheDocument();
  });

  it("shows Status unavailable once the grace period is over for an untracked pane", () => {
    renderPane(entry(fakeAdapter(), { graceOver: true }));
    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Idle")).not.toBeInTheDocument();
  });

  it("prefers Not started, then Ended, over Status unavailable", () => {
    const first = renderPane(entry(null, { graceOver: true }));
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.queryByText("Status unavailable")).not.toBeInTheDocument();
    first.view.unmount();
    renderPane(entry(fakeAdapter(), { graceOver: true, ended: true }));
    expect(screen.getByText("Ended", { selector: "span.border" })).toBeInTheDocument();
    expect(screen.queryByText("Status unavailable")).not.toBeInTheDocument();
  });

  it("keeps the Error chip and border after an abnormal exit (M1)", () => {
    renderPane(
      entry(fakeAdapter(), { ended: true, status: { state: "Error", since: 1, reason: "exit code 1", tracked: true, reportedAt: null } }),
    );
    expect(screen.getByText("Error", { selector: "span.border" })).toBeInTheDocument();
    expect(screen.queryByText("Ended", { selector: "span.border" })).not.toBeInTheDocument();
    expect(screen.getByRole("region").className).toContain("border-error");
    expect(screen.getByText("Session ended")).toBeInTheDocument();
  });

  it("shows the Ended badge after a normal exit", () => {
    renderPane(entry(fakeAdapter(), { ended: true, status: { state: "Ended", since: 1, reason: null, tracked: true, reportedAt: null } }));
    expect(screen.getByText("Ended", { selector: "span.border" })).toBeInTheDocument();
    expect(screen.getByRole("region").className).not.toContain("border-error");
  });

  it("colours the border by state and doubles it for Needs Approval", () => {
    const at = (status: PaneEntry["status"]) => {
      const { view } = renderPane(entry(fakeAdapter(), { status }));
      const cls = screen.getByRole("region").className;
      view.unmount();
      return cls;
    };
    const s = (state: PaneEntry["status"]["state"], tracked = true) => ({ state, since: 1, reason: null, tracked, reportedAt: null });
    expect(at(s("Needs Approval"))).toContain("border-approval");
    expect(at(s("Needs Approval"))).toContain("border-2");
    expect(at(s("Running"))).toContain("border-running");
    expect(at(s("Error"))).toContain("border-error");
    expect(at(s("Running"))).not.toContain("border-2");
    expect(at(s("Idle"))).toContain("border-border");
    expect(at(s("Running", false))).toContain("border-border");
    expect(at(s("Idle"))).not.toContain("border-ring");
  });

  it("puts the Focus Outline outside the status border of the focused pane only (SRS-FR-087)", () => {
    const at = (state: PaneEntry["status"]["state"], focused: boolean) => {
      const status = { state, since: 1, reason: null, tracked: true, reportedAt: null };
      const { view } = renderPane(entry(fakeAdapter(), { status }), undefined, undefined, focused);
      const cls = screen.getByRole("region").className.split(/\s+/);
      view.unmount();
      return cls;
    };
    expect(at("Idle", true)).toEqual(expect.arrayContaining(["ring-2", "ring-ring", "ring-offset-1"]));
    expect(at("Idle", false)).not.toContain("ring-2");
    expect(at("Needs Approval", true)).toEqual(expect.arrayContaining(["border-approval", "border-2", "ring-2", "ring-ring"]));
    expect(at("Error", false)).not.toContain("ring-2");
  });
});

describe("TerminalPane header in a narrow pane", () => {
  it("never shrinks the buttons and lets the chip truncate first", () => {
    renderPane(entry(fakeAdapter()));
    for (const name of ["Maximize pane", "Close pane"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("shrink-0");
    }
    expect(screen.getByText("Idle")).toHaveClass("min-w-0", "truncate");
  });
});

describe("Goal Line (SRS-FR-092, SRS-FR-093)", () => {
  const goalGroup = () => screen.queryByRole("group", { name: "Session goal" });

  it("has no Goal Line without a goal", () => {
    renderPane(entry(fakeAdapter()));
    expect(goalGroup()).toBeNull();
  });

  it("has no Goal Line for an empty goal", () => {
    renderPane(entry(fakeAdapter(), { goal: "" }));
    expect(goalGroup()).toBeNull();
  });

  it("shows a short goal whole", () => {
    renderPane(entry(fakeAdapter(), { goal: "Fix resume" }));
    expect(goalGroup()).toHaveTextContent("Fix resume");
    expect(goalGroup()).not.toHaveTextContent("…");
  });

  it("cuts a long goal to 79 characters and an ellipsis, with the whole goal as title", () => {
    const goal = "a".repeat(120);
    renderPane(entry(fakeAdapter(), { goal }));
    const text = screen.getByTitle(goal);
    expect(text).toHaveTextContent(`${"a".repeat(79)}…`);
    expect(text.textContent).toHaveLength(80);
    expect(screen.getByRole("button", { name: "Edit goal" })).toBeInTheDocument();
  });

  it("keeps an 80-character goal whole", () => {
    const goal = "b".repeat(80);
    renderPane(entry(fakeAdapter(), { goal }));
    expect(screen.getByTitle(goal).textContent).toBe(goal);
  });

  it("does not maximize on a double-click on the Goal Line", async () => {
    const onMaximize = vi.fn();
    render(
      <TerminalPane entry={entry(fakeAdapter(), { goal: "Fix resume" })} client={fakeSessions()} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={onMaximize} onRestore={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} />,
    );
    await userEvent.dblClick(goalGroup()!);
    expect(onMaximize).not.toHaveBeenCalled();
  });

  it("edits: Edit goal opens an input holding the goal, Enter saves the trimmed text", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Old goal");
    await userEvent.clear(input);
    await userEvent.type(input, "  New goal  {Enter}");
    expect(on.setGoal).toHaveBeenCalledWith("p1", "New goal");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("does not save blank text on Enter", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "   {Enter}");
    expect(on.setGoal).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(goalGroup()).toHaveTextContent("Old goal");
  });

  it("restores the old goal on Esc", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    await userEvent.type(screen.getByRole("textbox"), "abc{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(goalGroup()).toHaveTextContent("Old goal");
    expect(on.setGoal).not.toHaveBeenCalled();
  });

  it("cancels on blur", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    await userEvent.type(screen.getByRole("textbox"), "abc");
    await userEvent.tab();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(on.setGoal).not.toHaveBeenCalled();
  });
});
