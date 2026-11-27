import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAdapter, fakeSessions, fakeStream, type FakeAdapter } from "../test/fakes";
import css from "../index.css?raw";
import { TerminalPane, UNTITLED, type PaneEntry } from "./TerminalPane";
import { labels } from "../labels";
import { initialChat } from "./chatState";

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
    status: { state: "Idle", since: 1, reason: null, tracked: false },
    chat: initialChat,
    activity: null,
    shell: null,
    shellFailed: false,
    prompted: false,
    view: "term",
    returnView: "term",
    sentPrompts: [],
    ...over,
  };
}

function renderPane(e: PaneEntry, client = fakeSessions(), on = { focus: vi.fn(), close: vi.fn() }, focused = true) {
  const view = render(
    <TerminalPane entry={e} client={client} focused={focused} maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={on.focus} onClose={on.close} onChooseView={vi.fn()} onDismissShellFailure={vi.fn()} onSent={vi.fn()} />,
  );
  return { client, on, view };
}

const flush = () => act(async () => {});
/** The Term layer of the only pane, which holds the Session ended note. */
const termLayer = () => document.querySelector<HTMLElement>("[data-view=term]")!;

/** Returns a function that fires every observer callback, as a layout change would. */
function stubResizeObserver() {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  return () => callbacks.forEach((cb) => cb());
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
    for (const view of ["term", "chat"]) {
      const layer = document.querySelector<HTMLElement>(`[data-view="${view}"]`)!;
      expect(within(layer).getByText(labels.startFailed)).toBeInTheDocument();
      expect(within(layer).getByText(labels.startFailedHint)).toBeInTheDocument();
    }
    expect(screen.getByText(labels.notStarted)).toBeInTheDocument();
  });

  it("keeps the terminal and shows Session ended once the session has ended", async () => {
    const adapter = fakeAdapter();
    const { client, view } = renderPane(entry(adapter));
    await flush();
    view.rerender(
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onChooseView={vi.fn()} onDismissShellFailure={vi.fn()} onSent={vi.fn()} />,
    );
    expect(within(termLayer()).getByText(labels.sessionEnded)).toBeInTheDocument();
    expect(screen.getByText(labels.state["Ended"])).toBeInTheDocument();
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
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onChooseView={vi.fn()} onDismissShellFailure={vi.fn()} onSent={vi.fn()} />,
    );
    adapter.sendBinary("\x1b[M #!");
    expect(client.write).toHaveBeenCalledTimes(1);
  });

  it("asks the parent to close it from the close button", async () => {
    const user = userEvent.setup();
    const { on } = renderPane(entry(fakeAdapter()));
    await user.click(screen.getByRole("button", { name: labels.closePane }));
    expect(on.close).toHaveBeenCalledWith("p1");
  });

  it("shows the state chip with the state name", () => {
    renderPane(entry(fakeAdapter(), { status: { state: "Running", since: 1, reason: null, tracked: true } }));
    expect(screen.getByText(labels.state["Running"])).toBeInTheDocument();
  });

  it("shows the pane title from the entry", () => {
    renderPane(entry(fakeAdapter(), { title: "Fix login" }));
    expect(screen.getByRole("region", { name: "agent-deck · Fix login" })).toBeInTheDocument();
  });

  it("shows Status unavailable once the grace period is over for an untracked pane", () => {
    renderPane(entry(fakeAdapter(), { graceOver: true }));
    expect(screen.getByText(labels.statusUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(labels.state["Idle"])).not.toBeInTheDocument();
  });

  it("prefers Not started, then Ended, over Status unavailable", () => {
    const first = renderPane(entry(null, { graceOver: true }));
    expect(screen.getByText(labels.notStarted)).toBeInTheDocument();
    expect(screen.queryByText(labels.statusUnavailable)).not.toBeInTheDocument();
    first.view.unmount();
    renderPane(entry(fakeAdapter(), { graceOver: true, ended: true }));
    expect(screen.getByText(labels.state["Ended"], { selector: "span.chip" })).toBeInTheDocument();
    expect(screen.queryByText(labels.statusUnavailable)).not.toBeInTheDocument();
  });

  it("keeps the Error chip and border after an abnormal exit (M1)", () => {
    renderPane(
      entry(fakeAdapter(), { ended: true, status: { state: "Error", since: 1, reason: "exit code 1", tracked: true } }),
    );
    expect(screen.getByText(labels.state["Error"], { selector: "span.chip" })).toBeInTheDocument();
    expect(screen.queryByText(labels.state["Ended"], { selector: "span.chip" })).not.toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveClass("pane-err");
    expect(within(termLayer()).getByText(labels.sessionEnded)).toBeInTheDocument();
  });

  it("shows the Ended badge after a normal exit", () => {
    renderPane(entry(fakeAdapter(), { ended: true, status: { state: "Ended", since: 1, reason: null, tracked: true } }));
    expect(screen.getByText(labels.state["Ended"], { selector: "span.chip" })).toBeInTheDocument();
    expect(screen.getByRole("region")).not.toHaveClass("pane-err");
  });

  it("frames only a Needs Approval or Error pane, and only while its status is tracked", () => {
    const at = (status: PaneEntry["status"]) => {
      const { view } = renderPane(entry(fakeAdapter(), { status }), undefined, undefined, false);
      const cls = screen.getByRole("region").className.split(/\s+/);
      view.unmount();
      return cls;
    };
    const s = (state: PaneEntry["status"]["state"], tracked = true) => ({ state, since: 1, reason: null, tracked });
    expect(at(s("Needs Approval"))).toContain("pane-app");
    expect(at(s("Error"))).toContain("pane-err");
    for (const cls of [at(s("Running")), at(s("Idle")), at(s("Needs Approval", false))]) {
      expect(cls).not.toContain("pane-app");
      expect(cls).not.toContain("pane-err");
    }
  });

  it("puts the Focus Outline on the focused pane only (SRS-FR-087)", () => {
    const at = (state: PaneEntry["status"]["state"], focused: boolean) => {
      const status = { state, since: 1, reason: null, tracked: true };
      const { view } = renderPane(entry(fakeAdapter(), { status }), undefined, undefined, focused);
      const cls = screen.getByRole("region").className.split(/\s+/);
      view.unmount();
      return cls;
    };
    expect(at("Idle", true)).toContain("pane-focus");
    expect(at("Idle", false)).not.toContain("pane-focus");
    expect(at("Needs Approval", true)).toEqual(expect.arrayContaining(["pane-app", "pane-focus"]));
    expect(at("Error", false)).not.toContain("pane-focus");
  });
});

describe("Pane frames in index.css (app-theme)", () => {
  const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("draws the Needs Approval and Error frames as a 2px inset line with no glow", () => {
    expect(rule(".pane-app::after")).toMatch(/inset 0 0 0 2px var\(--approval\)/);
    expect(rule(".pane-err::after")).toMatch(/inset 0 0 0 2px var\(--error\)/);
    expect(css).not.toMatch(/approval-glow/);
  });

  it("draws the Focus Outline as a 2px --ring outline outside the card (SRS-FR-087)", () => {
    expect(rule(".pane-focus")).toMatch(/outline:\s*2px solid var\(--ring\)/);
    expect(rule(".pane-focus")).toMatch(/outline-offset:\s*2px/);
    expect(css).not.toMatch(/\.pane-focus[^{]*::after/);
  });

  it("rounds the attention ring with the card", () => {
    expect(rule(".pane-frame::after")).toMatch(/border-radius:\s*inherit/);
  });
});

describe("TerminalPane attention and dimming (app-theme)", () => {
  const classes = (state: PaneEntry["status"]["state"], focused: boolean, maximized = false) => {
    const status = { state, since: 1, reason: null, tracked: true };
    const view = render(
      <TerminalPane entry={entry(fakeAdapter(), { status })} client={fakeSessions()} focused={focused} maximized={maximized} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onChooseView={vi.fn()} onDismissShellFailure={vi.fn()} onSent={vi.fn()} />,
    );
    const cls = screen.getByRole("region").className.split(/\s+/);
    view.unmount();
    return cls;
  };

  it("frames a Needs Approval pane with no glow, and an Error pane", () => {
    expect(classes("Needs Approval", false)).toContain("pane-app");
    expect(classes("Needs Approval", false).join(" ")).not.toMatch(/glow/);
    expect(classes("Error", false)).toContain("pane-err");
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
    for (const name of [labels.maximizePane, labels.closePane]) {
      expect(screen.getByRole("button", { name })).toHaveClass("shrink-0");
    }
    expect(screen.getByText(labels.state["Idle"])).toHaveClass("min-w-0", "truncate");
  });
});

describe("No Target Box (CR-015)", () => {
  it("shows no Session target box, whatever goal the entry carries", () => {
    for (const goal of ["Fix resume", null]) {
      const { view } = renderPane({ ...entry(fakeAdapter()), goal } as unknown as PaneEntry);
      expect(screen.queryByRole("textbox", { name: "Session target" })).toBeNull();
      view.unmount();
    }
  });
});

describe("No Progress Tracking (CR-015)", () => {
  it("shows no tracking prompt, Track progress button or Progress strip, whatever the entry carries", () => {
    const stray = { tracking: "unset", checkpoints: [], collapsed: false, updating: false, failed: false };
    const on = { ...stray, tracking: "on", checkpoints: [{ summary: "Read the log", result: "", done: false, startedAt: "09:12" }] };
    for (const progress of [stray, on]) {
      const { view } = renderPane({ ...entry(fakeAdapter()), progress } as unknown as PaneEntry);
      expect(screen.queryByText("Track progress for this session?")).toBeNull();
      expect(screen.queryByRole("button", { name: "Track progress" })).toBeNull();
      expect(screen.queryByRole("region", { name: "Progress" })).toBeNull();
      view.unmount();
    }
  });
});

describe("TerminalPane header", () => {
  it("names the state as a chip when it needs the user, as a coloured word otherwise (SRS-NFR-014)", () => {
    const look = (state: PaneEntry["status"]["state"]) => {
      const { view } = renderPane(entry(fakeAdapter(), { status: { state, since: 1, reason: null, tracked: true } }));
      const cls = screen.getByText(labels.state[state]).className.split(/\s+/);
      view.unmount();
      return cls;
    };
    expect(look("Needs Approval")).toEqual(expect.arrayContaining(["chip", "chip-app"]));
    expect(look("Error")).toEqual(expect.arrayContaining(["chip", "chip-err"]));
    expect(look("Running")).toContain("w-busy");
    expect(look("Idle")).toContain("w-ready");
  });

  const header = () => screen.getByRole("region").querySelector("header")!;
  const mark = () => header().querySelector("[aria-hidden='true']")!;

  it("sets the header text in the UI font, not the terminal one (Fonts work offline)", () => {
    renderPane(entry(fakeAdapter()));
    expect(header()).toHaveClass("font-sans");
    expect(header()).not.toHaveClass("font-mono");
  });

  it("leads the title with the state dot, or a muted icon when the status is unavailable", () => {
    const status = (state: PaneEntry["status"]["state"], tracked = true) => ({ state, since: 1, reason: null, tracked });
    const { view } = renderPane(entry(fakeAdapter(), { status: status("Needs Approval") }));
    expect(mark()).toHaveClass("dot", "dot-app");
    view.unmount();
    renderPane(entry(fakeAdapter(), { graceOver: true, status: status("Running", false) }));
    expect(mark()).toHaveClass("text-muted-foreground");
    expect(mark()).not.toHaveClass("rounded-full");
  });
});

describe("Pane header with View Switch (SRS-FR-030)", () => {
  const header = () => screen.getByRole("region").querySelector("header")!;
  const viewSwitch = () => within(header()).getByRole("group", { name: labels.viewSwitch });
  const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  it("reads the title, then the state chip, the View Switch, Để dành, Phóng to and × in that order", () => {
    renderPane(entry(fakeAdapter(), { title: "Scaffold Tauri app", status: { state: "Running", since: 1, reason: null, tracked: true } }));
    expect(header()).toHaveTextContent(/^agent-deck · Scaffold Tauri app/);
    const order = [
      screen.getByText(labels.state["Running"]),
      viewSwitch(),
      screen.getByRole("button", { name: labels.stashSession }),
      screen.getByRole("button", { name: labels.maximizePane }),
      screen.getByRole("button", { name: labels.closePane }),
    ];
    for (let i = 1; i < order.length; i++) expect(before(order[i - 1], order[i])).toBe(true);
  });

  it("lets the title give way first, then the state chip, then the View Switch, never the buttons", () => {
    renderPane(entry(fakeAdapter()));
    expect(screen.getByText(/^agent-deck ·/).parentElement).toHaveClass("flex-1", "basis-0", "min-w-0", "truncate");
    expect(screen.getByText(labels.state["Idle"])).toHaveClass("min-w-0", "shrink-[10]", "truncate");
    expect(viewSwitch()).toHaveClass("min-w-0");
    expect(viewSwitch()).not.toHaveClass("shrink-0");
  });

  it("drops Plan in a narrow header and keeps Để dành, Phóng to and ×", async () => {
    const observe = stubResizeObserver();
    renderPane(entry(fakeAdapter()));
    await flush();
    const width = vi.spyOn(header(), "getBoundingClientRect");
    const items = () => within(viewSwitch()).getAllByRole("button").map((b) => b.textContent);

    width.mockReturnValue(new DOMRect(0, 0, 250, 40));
    act(() => observe());
    expect(items()).toEqual([labels.views.chat, labels.views.term, labels.views.shell]);
    for (const name of [labels.stashSession, labels.maximizePane, labels.closePane]) {
      expect(within(header()).getByRole("button", { name })).toBeInTheDocument();
    }

    width.mockReturnValue(new DOMRect(0, 0, 600, 40));
    act(() => observe());
    expect(items()).toEqual(["Chat", "Term", "Shell", "Plan"]);
  });

  it("shows Term pressed on a new pane", () => {
    renderPane(entry(fakeAdapter()));
    expect(within(viewSwitch()).getByRole("button", { name: labels.views.term })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Shell view focus", () => {
  function paneWith(view: "term" | "shell", adapter: FakeAdapter, shellAdapter: FakeAdapter, client = fakeSessions()) {
    const e = entry(adapter, { view, shell: { adapter: shellAdapter, stream: fakeStream(), activity: null } });
    return (
      <TerminalPane entry={e} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onChooseView={vi.fn()} onDismissShellFailure={vi.fn()} onSent={vi.fn()} />
    );
  }

  // No user path shows Shell without an action in its own pane today; this guards the effect directly.
  it("leaves the keyboard in another pane when Shell is shown", async () => {
    const adapter = fakeAdapter();
    const shellAdapter = fakeAdapter();
    const client = fakeSessions();
    const other = document.body.appendChild(document.createElement("section"));
    other.setAttribute("data-pane", "p2");
    const elsewhere = other.appendChild(document.createElement("textarea"));
    try {
      const { rerender } = render(paneWith("term", adapter, shellAdapter, client));
      await flush();
      elsewhere.focus();
      rerender(paneWith("shell", adapter, shellAdapter, client));
      await flush();
      expect(elsewhere).toHaveFocus();
    } finally {
      other.remove();
    }
  });
});
