import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAdapter, fakeSessions, fakeStream, type FakeAdapter } from "../test/fakes";
import type { PaneProgress } from "../api/sessions";
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
    progress: null,
    ...over,
  };
}

function renderPane(e: PaneEntry, client = fakeSessions(), on = { focus: vi.fn(), close: vi.fn(), setGoal: vi.fn(), setTracking: vi.fn(), setCollapsed: vi.fn() }, focused = true) {
  const view = render(
    <TerminalPane entry={e} client={client} focused={focused} maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={on.focus} onClose={on.close} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={on.setGoal} onSetTracking={on.setTracking} onSetCollapsed={on.setCollapsed} />,
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
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />,
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
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />,
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

describe("TerminalPane attention and dimming (app-theme)", () => {
  const classes = (state: PaneEntry["status"]["state"], focused: boolean, maximized = false) => {
    const status = { state, since: 1, reason: null, tracked: true, reportedAt: null };
    const view = render(
      <TerminalPane entry={entry(fakeAdapter(), { status })} client={fakeSessions()} focused={focused} maximized={maximized} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />,
    );
    const cls = screen.getByRole("region").className.split(/\s+/);
    view.unmount();
    return cls;
  };

  it("adds the glow to a Needs Approval pane and doubles the Error border", () => {
    expect(classes("Needs Approval", false)).toEqual(expect.arrayContaining(["border-2", "after:shadow-approval-glow"]));
    expect(classes("Error", false)).toEqual(expect.arrayContaining(["border-error", "border-2"]));
    expect(classes("Running", false)).not.toContain("after:shadow-approval-glow");
  });

  it("dims a pane that is neither focused, maximized, Needs Approval nor Error", () => {
    expect(classes("Running", false)).toContain("opacity-pane-dim");
    expect(classes("Idle", false)).toContain("opacity-pane-dim");
    expect(classes("Running", true)).not.toContain("opacity-pane-dim");
    expect(classes("Needs Approval", false)).not.toContain("opacity-pane-dim");
    expect(classes("Error", false)).not.toContain("opacity-pane-dim");
    expect(classes("Running", false, true)).not.toContain("opacity-pane-dim");
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

describe("Target Box (SRS-FR-092)", () => {
  const box = () => screen.getByRole("textbox", { name: "Session target" });

  it("is empty with a placeholder before the session has a goal", () => {
    renderPane(entry(fakeAdapter()));
    expect(box()).toHaveValue("");
    expect(box()).toHaveAttribute("placeholder", "Target — filled from your first prompt");
  });

  it("is empty with a placeholder for a cleared goal", () => {
    renderPane(entry(fakeAdapter(), { goal: "" }));
    expect(box()).toHaveValue("");
  });

  it("shows a multi-line goal whole, in red", () => {
    const goal = "Fix resume\n1. read the log\n2. write a test\n3. fix\n4. ship";
    renderPane(entry(fakeAdapter(), { goal }));
    expect(box()).toHaveValue(goal);
    expect(box()).toHaveClass("text-goal");
  });

  it("grows with its text up to 3 lines, then scrolls", () => {
    const scrollHeight = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(52);
    renderPane(entry(fakeAdapter(), { goal: "a\nb\nc\nd\ne" }));
    expect(box().style.height).toBe("52px");
    expect(box()).toHaveClass("max-h-[calc(4.25rem+1px)]", "overflow-y-auto", "leading-5", "py-1", "border-b");
    scrollHeight.mockRestore();
  });

  it("does not maximize on a double-click in the box", async () => {
    const onMaximize = vi.fn();
    render(
      <TerminalPane entry={entry(fakeAdapter(), { goal: "Fix resume" })} client={fakeSessions()} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={onMaximize} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />,
    );
    await userEvent.dblClick(box());
    expect(onMaximize).not.toHaveBeenCalled();
  });
});

describe("Edit in the Target Box (SRS-FR-093)", () => {
  const box = () => screen.getByRole("textbox", { name: "Session target" });

  it("saves the trimmed text when the box loses focus", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.clear(box());
    await userEvent.type(box(), "  New goal  ");
    expect(on.setGoal).not.toHaveBeenCalled();
    await userEvent.click(document.body);
    expect(on.setGoal).toHaveBeenCalledExactlyOnceWith("p1", "New goal");
  });

  it("does not save when the text did not change", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.click(box());
    await userEvent.click(document.body);
    expect(on.setGoal).not.toHaveBeenCalled();
  });

  it("saves an empty text", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.clear(box());
    await userEvent.click(document.body);
    expect(on.setGoal).toHaveBeenCalledExactlyOnceWith("p1", "");
  });

  it("saves text typed before the session has a goal", async () => {
    const { on } = renderPane(entry(fakeAdapter()));
    await userEvent.type(box(), "Fix resume");
    await userEvent.click(document.body);
    expect(on.setGoal).toHaveBeenCalledExactlyOnceWith("p1", "Fix resume");
  });

  it("Escape brings back the old text and saves nothing", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old goal" }));
    await userEvent.type(box(), "abc{Escape}");
    expect(box()).toHaveValue("Old goal");
    expect(box()).not.toHaveFocus();
    expect(on.setGoal).not.toHaveBeenCalled();
  });

  it("Enter adds a line instead of saving", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Fix" }));
    await userEvent.type(box(), "{Enter}more");
    expect(box()).toHaveValue("Fix\nmore");
    expect(box()).toHaveFocus();
    expect(on.setGoal).not.toHaveBeenCalled();
  });

  it("shows a new goal from the session while not editing, and keeps a draft while editing", async () => {
    const e = entry(fakeAdapter(), { goal: null });
    const { view } = renderPane(e);
    const rerender = (goal: string) =>
      view.rerender(
        <TerminalPane entry={{ ...e, goal }} client={fakeSessions()} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />,
      );
    rerender("First prompt");
    expect(box()).toHaveValue("First prompt");
    await userEvent.type(box(), " edited");
    rerender("Other");
    expect(box()).toHaveValue("First prompt edited");
  });

  it("does not overwrite a goal that arrives while the box is focused but untouched", async () => {
    const e = entry(fakeAdapter(), { goal: null });
    const setGoal = vi.fn();
    const pane = (goal: string | null) => (
      <TerminalPane entry={{ ...e, goal }} client={fakeSessions()} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={setGoal} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />
    );
    const view = render(pane(null));
    await userEvent.click(box());
    view.rerender(pane("fix X"));
    await userEvent.click(document.body);
    expect(setGoal).not.toHaveBeenCalled();
    expect(box()).toHaveValue("fix X");
  });

  it("saves an edit made after an Escape that fired no blur", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { goal: "Old" }));
    const blur = vi.spyOn(HTMLTextAreaElement.prototype, "blur").mockImplementation(() => {});
    await userEvent.type(box(), "x{Escape}");
    blur.mockRestore();
    await userEvent.type(box(), " new");
    await userEvent.click(document.body);
    expect(on.setGoal).toHaveBeenCalledExactlyOnceWith("p1", "Old new");
  });
});

function progress(over: Partial<PaneProgress> = {}): PaneProgress {
  return { tracking: "on", checkpoints: [], collapsed: false, updating: false, failed: false, ...over };
}

const cp = (summary: string, done: boolean, result = "", startedAt = "09:00") => ({ summary, result, done, startedAt });

describe("Tracking button and prompt (SRS-FR-113 to SRS-FR-116)", () => {
  const button = () => screen.getByRole("button", { name: "Track progress" });

  it("renders nothing about progress while the state is unknown", () => {
    renderPane(entry(fakeAdapter()));
    expect(screen.queryByText("Track progress for this session?")).toBeNull();
    expect(screen.queryByRole("region", { name: "Progress" })).toBeNull();
  });

  it("puts the Tracking button right before Stash, pressed only while on", () => {
    renderPane(entry(fakeAdapter(), { progress: progress({ tracking: "on" }) }));
    expect(button()).toHaveAttribute("aria-pressed", "true");
    expect(button()).toHaveAttribute("title", "Track progress");
    expect(button().nextElementSibling).toBe(screen.getByRole("button", { name: "Stash session" }));
  });

  it("turns tracking off from an on button and on from an off one", async () => {
    const { on, view } = renderPane(entry(fakeAdapter(), { progress: progress({ tracking: "on" }) }));
    await userEvent.click(button());
    expect(on.setTracking).toHaveBeenLastCalledWith("p1", false);
    view.unmount();
    const off = renderPane(entry(fakeAdapter(), { progress: progress({ tracking: "off" }) }));
    expect(button()).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button());
    expect(off.on.setTracking).toHaveBeenLastCalledWith("p1", true);
  });

  it("does not maximize on a double-click of the button", async () => {
    const onMaximize = vi.fn();
    render(
      <TerminalPane entry={entry(fakeAdapter(), { progress: progress() })} client={fakeSessions()} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={onMaximize} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />,
    );
    await userEvent.dblClick(button());
    expect(onMaximize).not.toHaveBeenCalled();
  });

  it("asks while unset, and Track and No answer it", async () => {
    const { on, view } = renderPane(entry(fakeAdapter(), { progress: progress({ tracking: "unset" }) }));
    expect(screen.getByText("Track progress for this session?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(on.setTracking).toHaveBeenLastCalledWith("p1", true);
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(on.setTracking).toHaveBeenLastCalledWith("p1", false);
    view.unmount();
  });

  it("does not ask once tracking is on or off", () => {
    for (const tracking of ["on", "off"] as const) {
      const { view } = renderPane(entry(fakeAdapter(), { progress: progress({ tracking }) }));
      expect(screen.queryByText("Track progress for this session?")).toBeNull();
      view.unmount();
    }
  });

  it("keeps focus in the terminal when a prompt button is pressed", () => {
    renderPane(entry(fakeAdapter(), { progress: progress({ tracking: "unset" }) }));
    const notPrevented = fireEvent.mouseDown(screen.getByRole("button", { name: "Track" }));
    expect(notPrevented).toBe(false);
  });
});

describe("Progress Strip (SRS-FR-118 to SRS-FR-123, SRS-FR-128)", () => {
  const region = () => screen.getByRole("region", { name: "Progress" });
  const three = [cp("Read the log", true, "found it", "09:01"), cp("Write a test", false, "", "09:05"), cp("Fix it", false, "", "09:09")];

  it("is absent with no checkpoints, while off, and while unset", () => {
    for (const p of [progress(), progress({ tracking: "off", checkpoints: three }), progress({ tracking: "unset", checkpoints: three })]) {
      const { view } = renderPane(entry(fakeAdapter(), { progress: p }));
      expect(screen.queryByRole("region", { name: "Progress" })).toBeNull();
      view.unmount();
    }
  });

  it("shows the count and a row per checkpoint with mark, summary, result and time", () => {
    renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three }) }));
    expect(within(region()).getByText("Progress · 1/3")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Checkpoints" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("✓")).toHaveClass("text-running");
    expect(within(rows[0]).getByText("Read the log")).toBeInTheDocument();
    expect(within(rows[0]).getByText("found it")).toHaveClass("text-muted-foreground");
    expect(within(rows[0]).getByText("09:01")).toBeInTheDocument();
    expect(within(rows[1]).getByText("●")).toHaveClass("text-approval");
    expect(within(rows[1]).queryByText("found it")).toBeNull();
  });

  it("is read-only", () => {
    renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three }) }));
    expect(within(region()).queryAllByRole("textbox")).toHaveLength(0);
    expect(region().querySelector("[contenteditable], input, textarea")).toBeNull();
  });

  it("caps the list at four rows and scrolls past them", () => {
    renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three }) }));
    const list = screen.getByRole("list", { name: "Checkpoints" });
    expect(list).toHaveClass("overflow-y-auto");
    expect(list.style.maxHeight).toBe("calc(1px + 6rem)");
    expect(within(list).getAllByRole("listitem")[0].style.height).toBe("1.5rem");
  });

  // jsdom has no layout: rows are 24px tall inside a 96px window, and scrollTop is recorded.
  function stubLayout() {
    const top = new WeakMap<Element, number>();
    const sets: number[] = [];
    const rowIndex = (el: Element) => Array.from(el.parentElement?.children ?? []).indexOf(el);
    const protos: [string, PropertyDescriptor][] = [
      ["offsetTop", { configurable: true, get(this: HTMLElement) { return this.tagName === "LI" ? rowIndex(this) * 24 : 0; } }],
      ["offsetHeight", { configurable: true, get(this: HTMLElement) { return this.tagName === "LI" ? 24 : 0; } }],
      ["clientHeight", { configurable: true, get(this: HTMLElement) { return this.tagName === "UL" ? 96 : 0; } }],
      [
        "scrollTop",
        {
          configurable: true,
          get(this: Element) { return top.get(this) ?? 0; },
          set(this: Element, v: number) { top.set(this, v); sets.push(v); },
        },
      ],
    ];
    const saved = protos.map(([k]) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k) ?? Object.getOwnPropertyDescriptor(Element.prototype, k)] as const);
    protos.forEach(([k, d]) => Object.defineProperty(HTMLElement.prototype, k, d));
    const scrollIntoView = vi.fn();
    const originalSiv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    return {
      sets,
      scrollIntoView,
      restore() {
        saved.forEach(([k, d]) => (d ? Object.defineProperty(HTMLElement.prototype, k, d) : delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k]));
        Element.prototype.scrollIntoView = originalSiv;
      },
    };
  }

  const paneFor = (e: PaneEntry) => (
    <TerminalPane entry={e} client={fakeSessions()} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onToggleShell={vi.fn()} onResizeShell={vi.fn()} onDismissShellFailure={vi.fn()} onSetGoal={vi.fn()} onSetTracking={vi.fn()} onSetCollapsed={vi.fn()} />
  );
  const many = (n: number) => Array.from({ length: n }, (_, i) => cp(`step ${i}`, i < n - 1, "", "09:00"));

  it("keeps the last not-done row visible inside the list after each change, without scrollIntoView", () => {
    const layout = stubLayout();
    try {
      const e = entry(fakeAdapter(), { progress: progress({ checkpoints: many(6) }) });
      const { view } = renderPane(e);
      expect(layout.sets).toEqual([48]);
      view.rerender(paneFor({ ...e, progress: progress({ checkpoints: many(7) }) }));
      expect(layout.sets).toEqual([48, 72]);
      expect(layout.scrollIntoView).not.toHaveBeenCalled();
    } finally {
      layout.restore();
    }
  });

  it("scrolls up when the not-done row is above the window, and leaves a visible row alone", () => {
    const layout = stubLayout();
    try {
      const e = entry(fakeAdapter(), { progress: progress({ checkpoints: [cp("open", false), ...many(6).slice(0, 5)] }) });
      const { view } = renderPane(e);
      expect(layout.sets).toEqual([]);
      const list = screen.getByRole("list", { name: "Checkpoints" });
      list.scrollTop = 120;
      view.rerender(paneFor({ ...e, progress: progress({ checkpoints: [cp("open", false), ...many(6).slice(0, 5)] }) }));
      expect(layout.sets).toEqual([120, 0]);
    } finally {
      layout.restore();
    }
  });

  it("scrolls the list again after a collapse and expand", () => {
    const layout = stubLayout();
    try {
      const cps = many(10);
      const e = entry(fakeAdapter(), { progress: progress({ checkpoints: cps }) });
      const { view } = renderPane(e);
      expect(layout.sets).toEqual([144]);
      view.rerender(paneFor({ ...e, progress: progress({ checkpoints: cps, collapsed: true }) }));
      view.rerender(paneFor({ ...e, progress: progress({ checkpoints: cps, collapsed: false }) }));
      expect(layout.sets).toEqual([144, 144]);
    } finally {
      layout.restore();
    }
  });

  it("shows an updating dot and a failure note", () => {
    const { view } = renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three, updating: true }) }));
    expect(within(region()).getByLabelText("Updating")).toBeInTheDocument();
    expect(within(region()).queryByText("Couldn't update")).toBeNull();
    view.unmount();
    renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three, failed: true }) }));
    expect(within(region()).getByText("Couldn't update")).toBeInTheDocument();
    expect(within(region()).queryByLabelText("Updating")).toBeNull();
  });

  it("collapses to one line with the last not-done summary", async () => {
    const { on } = renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three }) }));
    await userEvent.click(screen.getByRole("button", { name: "Collapse progress" }));
    expect(on.setCollapsed).toHaveBeenCalledExactlyOnceWith("p1", true);
  });

  it("renders the collapsed line without the list, and omits the tail when all are done", async () => {
    const { on, view } = renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: three, collapsed: true }) }));
    expect(within(region()).getByText("Progress · 1/3 · Fix it")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Checkpoints" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand progress" }));
    expect(on.setCollapsed).toHaveBeenCalledExactlyOnceWith("p1", false);
    view.unmount();
    renderPane(entry(fakeAdapter(), { progress: progress({ checkpoints: [cp("a", true)], collapsed: true }) }));
    expect(within(region()).getByText("Progress · 1/1")).toBeInTheDocument();
  });
});
