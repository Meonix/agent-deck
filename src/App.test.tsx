import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaneProgress } from "./api/sessions";
import type { Workspace, WorkspacesClient } from "./api/workspaces";
import type { ZoomClient } from "./api/zoom";
import App from "./App";
import type { TerminalSize } from "./components/TerminalPane";
import { readSnapshot, writeSnapshot, type Snapshot } from "./components/paneSnapshot";
import { fakeAdapter, fakeSessions, type FakeAdapter, type FakeSessions } from "./test/fakes";

const ws = (id: string, name: string, missing = false): Workspace => ({ id, name, path: `/p/${name}`, missing });

function workspacesClient(items: Workspace[]): WorkspacesClient {
  return {
    list: vi.fn(async () => [...items]),
    pickFolder: vi.fn(async () => null),
    add: vi.fn(async () => ({ outcome: "added" as const, id: "x" })),
    remove: vi.fn(async () => ({ ok: true as const })),
  };
}

function setup(
  items: Workspace[],
  sessions: FakeSessions = fakeSessions(),
  size?: TerminalSize,
  more: { zoom?: ZoomClient; mac?: boolean } = {},
) {
  const adapters: FakeAdapter[] = [];
  const createTerminal = vi.fn(() => {
    const a = fakeAdapter(size);
    adapters.push(a);
    return a;
  });
  render(<App workspaces={workspacesClient(items)} sessions={sessions} createTerminal={createTerminal} {...more} />);
  return { user: userEvent.setup(), sessions, adapters, createTerminal };
}

const sidebar = () => screen.getByRole("complementary", { name: "Workspaces" });
const folderList = () => within(screen.getByRole("list", { name: "Folders" }));
const historyPanel = () => screen.getByRole("region", { name: "Session history" });
const newSessionButton = () => within(historyPanel()).getByRole("button", { name: "New Session" });
const panes = () => within(screen.getByTestId("pane-grid")).getAllByRole("region");
const GRID = new DOMRect(0, 0, 1200, 800);
type DropSide = "left" | "right" | "top" | "bottom";

/** Pixel box of a pane in a 1200 x 800 grid, from the percentages the grid places it with. */
function paneBox(title: string) {
  const { left, top, width, height } = screen.getByRole("region", { name: `agent-deck · ${title}` }).parentElement!.style;
  const [x, y, w, h] = [left, top, width, height].map(parseFloat);
  return { x: (x / 100) * GRID.width, y: (y / 100) * GRID.height, w: (w / 100) * GRID.width, h: (h / 100) * GRID.height };
}

/** A point well inside the given side of a pane. */
function sidePoint(title: string, side: DropSide) {
  const b = paneBox(title);
  const [fx, fy] = { left: [0.1, 0.5], right: [0.9, 0.5], top: [0.5, 0.1], bottom: [0.5, 0.9] }[side];
  return { clientX: b.x + b.w * fx, clientY: b.y + b.h * fy };
}

/** Presses the header of `from` and moves over `to`; releases there unless `release` is false. */
function dragPane(from: string, to: string, side: DropSide, { release = true } = {}) {
  vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(GRID);
  const header = screen.getByRole("region", { name: `agent-deck · ${from}` }).querySelector("header")!;
  const b = paneBox(from);
  fireEvent.pointerDown(header, { clientX: b.x + b.w / 2, clientY: b.y + 10, button: 0, pointerId: 1 });
  const at = sidePoint(to, side);
  fireEvent.pointerMove(window, { ...at, pointerId: 1 });
  if (release) fireEvent.pointerUp(window, { ...at, pointerId: 1 });
}


async function selectAndStart(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await folderList().findByText(name));
  await user.click(newSessionButton());
}

/** × on the pane (the only one, or `pane`), then `choice` in its Close Dialog. */
async function closeVia(user: ReturnType<typeof userEvent.setup>, choice = "Close", pane?: HTMLElement) {
  await user.click((pane ? within(pane) : screen).getByRole("button", { name: "Close pane" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: choice }));
}

describe("New Session (5.4)", () => {
  it("is disabled until a folder is selected, then offered in the Session History Panel", async () => {
    const { user } = setup([ws("a", "agent-deck")]);
    await folderList().findByText("agent-deck");
    expect(within(screen.getByRole("main")).getByRole("button", { name: "New Session" })).toBeDisabled();
    await user.click(folderList().getByText("agent-deck"));
    expect(newSessionButton()).toBeEnabled();
  });

  it("asks to select a folder while none is selected and no pane is open", async () => {
    setup([ws("a", "agent-deck")]);
    expect(await screen.findByText("No open sessions")).toBeInTheDocument();
    expect(screen.getByText("Select a folder to see its sessions.")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("button", { name: "New Session" })).toBeDisabled();
  });

  it("points to the history once a folder is selected", async () => {
    const { user } = setup([ws("a", "agent-deck")]);
    await user.click(await folderList().findByText("agent-deck"));
    expect(screen.getByText("Resume a session from its history, or start a new one.")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("button", { name: "New Session" })).toBeEnabled();
  });

  it("refuses a missing folder with Folder not found and does not open", async () => {
    const { user, sessions } = setup([ws("m", "gone", true)]);
    await selectAndStart(user, "gone");
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();
  });

  it("shows Folder not found when the backend reports the folder missing", async () => {
    const sessions = fakeSessions({ open: vi.fn(async () => Promise.reject("folder_missing")) });
    const { user, adapters } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].dispose).toHaveBeenCalled();
  });

  it("opens a pane titled after the folder, focuses it, then shows the session title", async () => {
    let resolveTitle: (t: string) => void = () => {};
    const sessions = fakeSessions({ title: vi.fn(() => new Promise<string>((r) => (resolveTitle = r))) });
    const { user, adapters } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    expect(await screen.findByRole("region", { name: "agent-deck · (untitled)" })).toBeInTheDocument();
    await act(async () => resolveTitle("Fix login"));
    expect(screen.getByRole("region", { name: "agent-deck · Fix login" })).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, undefined);
    expect(adapters[0].focus).toHaveBeenCalled();
    expect(screen.queryByText("No open sessions")).not.toBeInTheDocument();
  });

  it("starts from the empty state button too", async () => {
    const { user, sessions } = setup([ws("a", "agent-deck")]);
    await user.click(await folderList().findByText("agent-deck"));
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "New Session" }));
    await screen.findByTestId("pane-grid");
    expect(sessions.open).toHaveBeenCalledTimes(1);
  });

  it("puts each new pane right of the focused one and focuses it", async () => {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const { user } = setup([ws("a", "agent-deck")], sessions);
    const lefts = () => panes().map((p) => [p.getAttribute("aria-label"), parseFloat(p.parentElement!.style.left)]);
    await selectAndStart(user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(lefts()).toEqual([["agent-deck · p1", 0], ["agent-deck · p2", 50]]);

    act(() => panes()[0].dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p3" });
    expect(lefts()).toEqual([["agent-deck · p1", 0], ["agent-deck · p2", 50], ["agent-deck · p3", 25]]);
  });

  it("writes session output into the terminal", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.emit("hello"));
    expect(adapters[0].written).toEqual(["hello"]);
  });

  it("shows the start failure without a terminal when Claude Code did not start", async () => {
    const { user, adapters } = setup([ws("a", "agent-deck")], fakeSessions({ started: false }));
    await selectAndStart(user, "agent-deck");
    expect(await screen.findByText("Claude Code could not be started")).toBeInTheDocument();
    // The terminal made to measure the pane is not kept.
    expect(adapters).toHaveLength(1);
    expect(adapters[0].dispose).toHaveBeenCalled();
  });

  it("opens the session at the size its pane will have (M1)", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")], fakeSessions(), { cols: 132, rows: 40 });
    vi.spyOn(screen.getByRole("main"), "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 600));
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");

    expect(sessions.open).toHaveBeenCalledWith("a", 132, 40, undefined);
    const [first] = adapters;
    const probe = vi.mocked(first.open).mock.calls[0][0];
    expect([probe.style.width, probe.style.height]).toEqual(["974px", "545px"]);
    expect(probe.isConnected).toBe(false);
    expect(vi.mocked(first.fit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sessions.open).mock.invocationCallOrder[0],
    );
    expect(first.container).not.toBe(probe);
    expect(sessions.resize).not.toHaveBeenCalled();

    vi.spyOn(document.querySelector('[data-pane-body="p1"]')!, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 974, 545),
    );
    await user.click(newSessionButton());
    await vi.waitFor(() => expect(adapters).toHaveLength(2));
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.width).toBe("478px");
  });

  it("keeps earlier output and shows Session ended when the session exits", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.emit("Done."));
    act(() => sessions.opened[0].stream.exit(1));
    expect(screen.getByText("Session ended")).toBeInTheDocument();
    expect(adapters[0].written).toEqual(["Done."]);
    expect(adapters[0].dispose).not.toHaveBeenCalled();
    adapters[0].type("x");
    expect(sessions.write).not.toHaveBeenCalled();
  });

  it("closes the pane through the client after Close and removes it (SRS-FR-029)", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    await closeVia(user);
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(adapters[0].dispose).toHaveBeenCalled();
    expect(sessions.opened[0].stream.dispose).toHaveBeenCalled();
    expect(screen.getByText("No open sessions")).toBeInTheDocument();
  });
});

describe("Close pane on normal exit (1.2)", () => {
  const paneNamed = (title: string) => screen.queryByRole("region", { name: `agent-deck · ${title}` });
  const rectOf = (title: string) => {
    const { left, top, width, height } = paneNamed(title)!.parentElement!.style;
    return [left, top, width, height].map(parseFloat);
  };

  async function startPanes(count: number) {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    for (let n = 2; n <= count; n++) {
      await ctx.user.click(newSessionButton());
      await screen.findByRole("region", { name: `agent-deck · p${n}` });
    }
    return ctx;
  }

  it("closes the pane without asking and gives its space to the others (SRS-FR-083)", async () => {
    const { sessions } = await startPanes(3);
    act(() => sessions.opened[1].stream.status({ state: "Running" }));

    act(() => sessions.opened[1].stream.exit(0));

    expect(sessions.close).toHaveBeenCalledWith("p2");
    await vi.waitFor(() => expect(paneNamed("p2")).toBeNull());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Session ended")).not.toBeInTheDocument();
    expect(rectOf("p1")).toEqual([0, 0, 50, 100]);
    expect(rectOf("p3")).toEqual([50, 0, 50, 100]);
    expect(sessions.opened[1].stream.dispose).toHaveBeenCalled();
  });

  it("leaves an empty pane area when the only pane exits (SRS-FR-083)", async () => {
    const { sessions } = await startPanes(1);
    act(() => sessions.opened[0].stream.exit(0));
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.getByText("No open sessions")).toBeInTheDocument();
  });

  it("shows the layout again when the maximized pane exits (SRS-FR-083)", async () => {
    const { user, sessions } = await startPanes(2);
    await user.click(within(paneNamed("p1")!).getByRole("button", { name: "Maximize pane" }));

    act(() => sessions.opened[0].stream.exit(0));

    await vi.waitFor(() => expect(paneNamed("p1")).toBeNull());
    expect(paneNamed("p2")!.parentElement).not.toHaveClass("invisible");
    expect(sidebar()).not.toHaveAttribute("inert");
  });

  it("closes the pane under an open close confirmation", async () => {
    const { user, sessions } = await startPanes(1);
    act(() => sessions.opened[0].stream.status({ state: "Running" }));
    await user.click(screen.getByRole("button", { name: "Close pane" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => sessions.opened[0].stream.exit(0));

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the pane with Session ended when closing it after a normal exit fails", async () => {
    const { sessions } = await startPanes(1);
    vi.mocked(sessions.close).mockRejectedValueOnce("io");
    act(() => sessions.opened[0].stream.exit(0));
    expect(await screen.findByText("Session ended")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not close session");
  });

  it("keeps the pane with Session ended when the process dies from a signal (SRS-FR-028)", async () => {
    const { sessions } = await startPanes(1);
    act(() => sessions.opened[0].stream.exit(null));
    expect(screen.getByText("Session ended")).toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
  });
});

describe("Pane state (4.2 to 4.4)", () => {
  afterEach(() => vi.useRealTimers());

  async function openPane(sessions = fakeSessions({ titles: ["Scaffold Tauri app"] })) {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByTestId("pane-grid");
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  // Testing Library's async helpers wait on setTimeout, so with a fake clock the test drives the UI by hand.
  async function openWithFakeClock(sessions: FakeSessions) {
    setup([ws("a", "agent-deck")], sessions);
    const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));
    await settle();
    fireEvent.click(folderList().getByText("agent-deck"));
    fireEvent.click(newSessionButton());
    await settle();
    return { stream: sessions.opened[0].stream };
  }

  it("shows the chip, then Status unavailable after 5 s untracked, cleared by a tracked status", async () => {
    vi.useFakeTimers();
    const sessions = fakeSessions();
    const { stream } = await openWithFakeClock(sessions);
    const pane = () => within(screen.getByTestId("pane-grid"));
    expect(pane().getByText("Idle")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(4_999));
    expect(pane().queryByText("Status unavailable")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(pane().getByText("Status unavailable")).toBeInTheDocument();
    act(() => stream.status({ state: "Running" }));
    expect(pane().queryByText("Status unavailable")).not.toBeInTheDocument();
    expect(pane().getByText("Running")).toBeInTheDocument();
  });

  it("refreshes the title every 10 s and stops once the session has ended", async () => {
    vi.useFakeTimers();
    const sessions = fakeSessions({ titles: ["Fix login", "Fix login redirect"] });
    const { stream } = await openWithFakeClock(sessions);
    expect(sessions.title).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(9_999));
    expect(sessions.title).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(sessions.title).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("region", { name: "agent-deck · Fix login redirect" })).toBeInTheDocument();
    act(() => stream.exit(1));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(sessions.title).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("region", { name: "agent-deck · Fix login redirect" })).toBeInTheDocument();
  });

  it("never asks for the title of a pane that did not start", async () => {
    const sessions = fakeSessions({ started: false });
    setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(userEvent.setup(), "agent-deck");
    await screen.findByText("Claude Code could not be started");
    expect(sessions.title).not.toHaveBeenCalled();
  });

  it("leaves no timer behind once its pane is closed", async () => {
    vi.useFakeTimers();
    const sessions = fakeSessions();
    await openWithFakeClock(sessions);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Close pane" }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(sessions.close).toHaveBeenCalled();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
    // Only the session list's minute clock, which lives as long as the app.
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not refetch the first pane's title when a second pane opens", async () => {
    const sessions = fakeSessions({ titles: ["Fix login"] });
    const { user } = await openPane(sessions);
    await screen.findByRole("region", { name: "agent-deck · Fix login" });
    expect(sessions.title).toHaveBeenCalledTimes(1);
    await user.click(newSessionButton());
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    await act(async () => {});
    expect(sessions.title).toHaveBeenCalledTimes(2);
    expect(sessions.title).toHaveBeenNthCalledWith(1, "p1");
    expect(sessions.title).toHaveBeenNthCalledWith(2, "p2");
  });

  describe("Close Dialog (SRS-FR-100, SRS-FR-027)", () => {
    const dialog = () => screen.getByRole("dialog");
    const titled = () => screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });

    it("asks before closing an Idle pane, with three buttons and no warning", async () => {
      const { user, sessions, stream } = await openPane();
      await titled();
      act(() => stream.status({ state: "Idle" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(dialog()).toHaveAttribute("aria-modal", "true");
      expect(dialog()).toHaveAccessibleName("Close “Scaffold Tauri app”?");
      expect(within(dialog()).getAllByRole("button").map((b) => b.textContent)).toEqual([
        "Cancel",
        "Close",
        "Close and move to Trash",
      ]);
      expect(within(dialog()).getByRole("button", { name: "Close and move to Trash" })).toHaveClass("bg-error");
      expect(dialog()).not.toHaveTextContent("still running");
      expect(within(dialog()).getByRole("button", { name: "Cancel" })).toHaveFocus();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("asks before closing an untracked pane", async () => {
      const { user, sessions } = await openPane();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(dialog()).toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("asks before closing an ended pane", async () => {
      const { user, stream } = await openPane();
      act(() => stream.exit(1));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(dialog()).toBeInTheDocument();
    });

    it("offers no Trash for a session that has no prompt yet", async () => {
      const { user } = await openPane(fakeSessions({ title: vi.fn(() => new Promise<string>(() => {})) }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(within(dialog()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Cancel", "Close"]);
    });

    it("offers no Trash for a pane whose Claude Code did not start", async () => {
      const { user } = await openPane(fakeSessions({ started: false }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(within(dialog()).queryByRole("button", { name: "Close and move to Trash" })).not.toBeInTheDocument();
    });

    it("warns that a Running pane is still running; Cancel keeps it", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(within(dialog()).getByText("Session is still running.")).toBeInTheDocument();
      await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
      expect(screen.getByTestId("pane-grid")).toBeInTheDocument();
    });

    it("keeps the dialog and drops the warning when the pane stops being busy", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      act(() => stream.status({ state: "Idle" }));
      expect(dialog()).not.toHaveTextContent("Session is still running.");
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("keeps the dialog without the warning when the session ends", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Needs Approval" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      act(() => stream.exit(1));
      expect(dialog()).not.toHaveTextContent("Session is still running.");
    });

    it("closes a busy pane after Close", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Needs Approval", reason: "Edit a" }));
      await closeVia(user);
      expect(sessions.close).toHaveBeenCalledWith("p1");
      await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.deleteSession).not.toHaveBeenCalled();
    });

    it("cancels on Escape", async () => {
      const { user, sessions } = await openPane();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("cancels on Escape even after focus left the dialog", async () => {
      const { user } = await openPane();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      (document.activeElement as HTMLElement).blur();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("keeps Tab and Shift+Tab inside the dialog across its three buttons (M4)", async () => {
      const { user } = await openPane();
      await titled();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      const [cancel, close, trash] = within(dialog()).getAllByRole("button");
      expect(cancel).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();
      await user.tab();
      expect(trash).toHaveFocus();
      await user.tab();
      expect(cancel).toHaveFocus();
      await user.tab({ shift: true });
      expect(trash).toHaveFocus();
      await user.tab({ shift: true });
      expect(close).toHaveFocus();
    });

    it("brings focus back to Cancel when it escapes the dialog (M4)", async () => {
      const { user } = await openPane();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      act(() => screen.getByRole("button", { name: "Close pane" }).focus());
      expect(within(dialog()).getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("does not let Escape reach the terminal behind the dialog (M4)", async () => {
      const { user } = await openPane();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      const terminal = panes()[0];
      const reached = vi.fn();
      terminal.addEventListener("keydown", reached);
      const notCancelled = fireEvent.keyDown(terminal, { key: "Escape" });
      expect(notCancelled).toBe(false);
      expect(reached).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("Active Sessions (2.3)", () => {
  const since = new Date(2026, 9, 16, 14, 2).getTime();
  const activeList = () => within(sidebar()).getByRole("list", { name: "Active sessions" });
  const sessionRow = (title: string) => within(activeList()).getByText(title).closest("li")!;
  const historyRow = (title: string) =>
    within(within(historyPanel()).getByRole("list", { name: "Session history" })).getByText(title).closest("li")!;

  async function openPane(sessions = fakeSessions({ titles: ["Scaffold Tauri app"] })) {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });
    await within(activeList()).findByText("Scaffold Tauri app");
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  it("has no Status Board column (SRS-FR-031 removed)", async () => {
    setup([ws("a", "agent-deck")]);
    await folderList().findByText("agent-deck");
    expect(screen.queryByRole("complementary", { name: "Status Board" })).not.toBeInTheDocument();
    expect(screen.queryByText("Status Board")).not.toBeInTheDocument();
  });

  it("follows a pane through Needs Approval, Idle and Error on its row", async () => {
    const { stream } = await openPane();

    act(() => stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("bg-approval-bg");
    expect(within(sessionRow("Scaffold Tauri app")).getByRole("img", { name: "Needs Approval" })).toBeInTheDocument();
    expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02 · Edit src/main.rs")).toBeInTheDocument();

    act(() => stream.status({ state: "Idle", since }));
    expect(sessionRow("Scaffold Tauri app")).not.toHaveClass("bg-approval-bg");
    expect(within(sessionRow("Scaffold Tauri app")).getByRole("img", { name: "Idle" })).toBeInTheDocument();
    expect(within(sessionRow("Scaffold Tauri app")).queryByText(/14:02/)).not.toBeInTheDocument();

    act(() => stream.status({ state: "Error", since, reason: "overloaded" }));
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("bg-error-bg");
    expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02 · overloaded")).toBeInTheDocument();
  });

  it("shows the Running marker without a detail line", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Running", since, reason: "Bash npm test" }));
    const row = within(sessionRow("Scaffold Tauri app"));
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("bg-running-bg");
    expect(row.getByRole("img", { name: "Running" })).toBeInTheDocument();
    expect(row.queryByText(/14:02/)).not.toBeInTheDocument();
  });

  it("shows only the time when the state has no reason", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Error", since, reason: null }));
    expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02")).toBeInTheDocument();
  });

  it("drops the row of an Error pane the user closes (RULE-08)", async () => {
    const listed = { sessions: [{ id: "s1", title: "Scaffold Tauri app", lastActivity: since }], unreadable: 0 };
    const { user, sessions, stream } = await openPane(
      fakeSessions({ titles: ["Scaffold Tauri app"], list: vi.fn(async () => listed) }),
    );
    act(() => stream.status({ state: "Error", since, reason: "overloaded" }));
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("bg-error-bg");
    await closeVia(user);
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(within(activeList()).queryByText("Scaffold Tauri app")).not.toBeInTheDocument());
    expect(within(activeList()).getByText("No active sessions")).toBeInTheDocument();
  });

  it("keeps the Error highlight after an abnormal exit", async () => {
    const listed = { sessions: [{ id: "s1", title: "Scaffold Tauri app", lastActivity: since }], unreadable: 0 };
    const { stream } = await openPane(fakeSessions({ titles: ["Scaffold Tauri app"], list: vi.fn(async () => listed) }));
    act(() => stream.status({ state: "Running", since }));
    act(() => stream.status({ state: "Error", since, reason: "exit code 1" }));
    act(() => stream.exit(1));
    await vi.waitFor(() => expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02 · exit code 1")).toBeInTheDocument());
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("bg-error-bg");
  });

  it("does not highlight a session that ended normally or an untracked pane", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Running", tracked: false }));
    expect(sessionRow("Scaffold Tauri app")).not.toHaveClass("bg-running-bg");
    act(() => stream.status({ state: "Running", since }));
    act(() => stream.status({ state: "Ended", since }));
    expect(sessionRow("Scaffold Tauri app")).not.toHaveClass("bg-running-bg");
    expect(within(sessionRow("Scaffold Tauri app")).getByRole("img", { name: "Ended" })).toBeInTheDocument();
  });

  it("puts Folders and Active Sessions on two different tints (SRS-NFR-009)", async () => {
    setup([ws("a", "agent-deck")]);
    await folderList().findByText("agent-deck");
    expect(screen.getByRole("list", { name: "Folders" }).closest("section")).toHaveClass("bg-section-folders");
    expect(activeList().closest("section")).toHaveClass("bg-section-active");
  });

  it("shows No active sessions while no pane is open (SRS-FR-053)", async () => {
    setup([ws("a", "agent-deck")]);
    expect(await within(activeList()).findByText("No active sessions")).toBeInTheDocument();
  });

  it("keeps the Status Highlight off the history row, which stays Live (SRS-FR-012)", async () => {
    const listed = { sessions: [{ id: "s1", title: "Scaffold Tauri app", lastActivity: since }], unreadable: 0 };
    const { stream } = await openPane(fakeSessions({ titles: ["Scaffold Tauri app"], list: vi.fn(async () => listed) }));
    act(() => stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    await vi.waitFor(() => expect(within(historyRow("Scaffold Tauri app")).getByText("Live")).toBeInTheDocument());
    expect(historyRow("Scaffold Tauri app")).not.toHaveClass("bg-approval-bg");
    expect(within(historyPanel()).queryByText("14:02 · Edit src/main.rs")).not.toBeInTheDocument();
  });

  it("lists the open sessions of every folder with their folder, most urgent first (SRS-FR-051, SRS-FR-052)", async () => {
    const sessions = fakeSessions({ titles: ["Fix login bug", "Scaffold Tauri app"] });
    const { user } = setup([ws("a", "agent-deck"), ws("m", "mokairo")], sessions);
    await selectAndStart(user, "mokairo");
    await user.click(folderList().getByText("agent-deck"));
    await user.click(newSessionButton());
    await within(activeList()).findByText("Scaffold Tauri app");
    await within(activeList()).findByText("Fix login bug");
    const [login, scaffold] = sessions.opened.map((o) => o.stream);
    act(() => login.status({ state: "Running", since }));
    act(() => scaffold.status({ state: "Error", since: since + 60_000, reason: "overloaded" }));
    const texts = () => within(activeList()).getAllByRole("listitem").map((r) => r.textContent);
    expect(texts()).toEqual([expect.stringContaining("Scaffold Tauri app"), expect.stringContaining("Fix login bug")]);
    expect(within(sessionRow("Scaffold Tauri app")).getByText("agent-deck")).toBeInTheDocument();
    expect(within(sessionRow("Fix login bug")).getByText("mokairo")).toBeInTheDocument();
  });
});

describe("Status Highlight on folder rows (2.2)", () => {
  const folderRow = (name: string) => folderList().getByText(name).closest("li")!;

  async function twoFolders() {
    const ctx = setup([ws("a", "agent-deck"), ws("m", "mokairo")]);
    await selectAndStart(ctx.user, "mokairo");
    await ctx.user.click(newSessionButton());
    await ctx.user.click(newSessionButton());
    await vi.waitFor(() => expect(ctx.sessions.opened).toHaveLength(3));
    await ctx.user.click(folderList().getByText("agent-deck"));
    return ctx;
  }

  it("shows the most urgent state of an unselected folder and how many sessions are in it", async () => {
    const { sessions } = await twoFolders();
    const [first, second, third] = sessions.opened.map((o) => o.stream);

    act(() => first.status({ state: "Running" }));
    expect(folderRow("mokairo")).toHaveClass("bg-running-bg");
    expect(within(folderRow("mokairo")).getByRole("img", { name: "1 Running" })).toHaveTextContent("1");

    act(() => second.status({ state: "Running" }));
    act(() => third.status({ state: "Needs Approval" }));
    expect(folderRow("mokairo")).toHaveClass("bg-approval-bg");
    expect(within(folderRow("mokairo")).getByRole("img", { name: "1 Needs Approval" })).toHaveTextContent("1");

    act(() => second.status({ state: "Error", reason: "overloaded" }));
    expect(folderRow("mokairo")).toHaveClass("bg-error-bg");
    expect(within(folderRow("mokairo")).getByRole("img", { name: "1 Error" })).toBeInTheDocument();
    expect(folderRow("agent-deck")).not.toHaveClass("bg-error-bg");
  });

  it("highlights the selected folder too and drops the highlight when every session is Idle", async () => {
    const { user, sessions } = await twoFolders();
    await user.click(folderList().getByText("mokairo"));
    const [first] = sessions.opened.map((o) => o.stream);

    act(() => first.status({ state: "Needs Approval" }));
    expect(folderRow("mokairo")).toHaveClass("bg-approval-bg");
    expect(folderRow("mokairo")).toHaveAttribute("aria-current", "true");

    act(() => first.status({ state: "Idle" }));
    expect(folderRow("mokairo")).not.toHaveClass("bg-approval-bg");
    expect(within(folderRow("mokairo")).queryByRole("img", { name: /^\d+ (Running|Needs Approval|Error)$/ })).not.toBeInTheDocument();
  });
});

describe("Status latency (2.1, 2.2)", () => {
  afterEach(() => vi.restoreAllMocks());

  async function openPane() {
    const sessions = fakeSessions();
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByTestId("pane-grid");
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  it("records a state change with the time its Status Highlight was committed", async () => {
    const { sessions, stream } = await openPane();
    vi.spyOn(Date, "now").mockReturnValue(1_000_450);
    act(() => stream.status({ state: "Needs Approval", reason: "Edit src/main.rs", reportedAt: 1_000_200 }));
    expect(sessions.recordStatusShown).toHaveBeenCalledTimes(1);
    expect(sessions.recordStatusShown).toHaveBeenCalledWith("s1", "Needs Approval", 1_000_200, 1_000_450);
  });

  it("records each change that arrives in the same batch, in order", async () => {
    const { sessions, stream } = await openPane();
    vi.spyOn(Date, "now").mockReturnValue(5_000_000);
    act(() => {
      stream.status({ state: "Running", reportedAt: 4_999_000 });
      stream.status({ state: "Needs Approval", reason: "Bash npm test", reportedAt: 4_999_500 });
    });
    expect(vi.mocked(sessions.recordStatusShown).mock.calls).toEqual([
      ["s1", "Running", 4_999_000, 5_000_000],
      ["s1", "Needs Approval", 4_999_500, 5_000_000],
    ]);
  });

  it("does not record a message that only marks the pane tracked", async () => {
    const { sessions, stream } = await openPane();
    act(() => stream.status({ state: "Idle", reportedAt: null }));
    act(() => stream.status({ state: "Running", tracked: false, reportedAt: 7 }));
    expect(sessions.recordStatusShown).not.toHaveBeenCalled();
  });

  it("never records a shown time earlier than the report time", async () => {
    const { sessions, stream } = await openPane();
    vi.spyOn(Date, "now").mockReturnValue(1_999_000);
    act(() => stream.status({ state: "Running", reportedAt: 2_000_000 }));
    expect(sessions.recordStatusShown).toHaveBeenCalledWith("s1", "Running", 2_000_000, 2_000_000);
  });

  it("opens the report from the title bar with the share within 3 s", async () => {
    const sessions = fakeSessions({ latencyReport: vi.fn(async () => ({ within: 398, total: 400 })) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await user.click(screen.getByRole("button", { name: "Status Latency" }));
    const report = await screen.findByRole("dialog", { name: "Status Latency" });
    expect(await within(report).findByText("99.5%")).toBeInTheDocument();
    expect(within(report).getByText("398 of 400 state changes appeared within 3 s")).toBeInTheDocument();
    expect(within(report).getByText("Last 14 days")).toBeInTheDocument();
    await user.click(within(report).getByRole("button", { name: "Close report" }));
    expect(screen.queryByRole("dialog", { name: "Status Latency" })).not.toBeInTheDocument();
  });

  it("shows No data yet and no percentage without records, and Escape closes it", async () => {
    const { user, sessions } = setup([ws("a", "agent-deck")]);
    await user.click(screen.getByRole("button", { name: "Status Latency" }));
    const report = await screen.findByRole("dialog", { name: "Status Latency" });
    expect(await within(report).findByText("No data yet")).toBeInTheDocument();
    expect(within(report).queryByText(/%/)).not.toBeInTheDocument();
    expect(sessions.latencyReport).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Status Latency" })).not.toBeInTheDocument();
  });

  it("keeps focus inside the report so no key reaches a terminal behind it", async () => {
    const { user } = await openPane();
    await user.click(screen.getByRole("button", { name: "Status Latency" }));
    const report = await screen.findByRole("dialog", { name: "Status Latency" });
    await within(report).findByText("No data yet");
    expect(report).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(report).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(report).toContainElement(document.activeElement as HTMLElement);
  });
});

describe("Session list (2.1, 2.2)", () => {
  afterEach(() => vi.restoreAllMocks());
  const now = new Date(2026, 9, 16, 14, 0).getTime();
  const sessionsPanel = () => within(historyPanel()).getByRole("list", { name: "Session history" });
  const rowTexts = () => within(sessionsPanel()).getAllByRole("listitem").map((r) => r.textContent);

  function listing(sessions: { id: string; title: string; lastActivity: number }[], unreadable = 0) {
    return vi.fn(async () => ({ sessions, unreadable }));
  }

  it("shows no Session History Panel before a folder is selected (SRS-FR-007)", async () => {
    setup([ws("a", "agent-deck")]);
    await folderList().findByText("agent-deck");
    expect(screen.queryByRole("region", { name: "Session history" })).not.toBeInTheDocument();
  });

  it("opens the Session History Panel with the folder name, New Session and Close (SRS-FR-007)", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listing([]) }));
    await user.click(await folderList().findByText("agent-deck"));
    const panel = historyPanel();
    expect(within(panel).getByRole("heading", { name: "agent-deck" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "New Session" })).toBeEnabled();
    expect(within(panel).getByRole("button", { name: "Close session history" })).toBeInTheDocument();
    expect(await within(panel).findByText("No sessions yet")).toBeInTheDocument();
    expect(sidebar()).not.toContainElement(panel);
  });

  it("lists the folder's sessions newest first with their titles and times", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([
      { id: "b", title: "Scaffold Tauri app", lastActivity: now - 2 * 60_000 },
      { id: "a", title: "Write BRD and SRS", lastActivity: new Date(2026, 9, 15, 9).getTime() },
    ]);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await folderList().findByText("agent-deck"));
    await within(historyPanel()).findByRole("list", { name: "Session history" });
    expect(rowTexts()).toEqual(["Scaffold Tauri app2 min ago", "Write BRD and SRSYesterday"]);
    expect(list).toHaveBeenCalledWith("a");
    expect(sessionsPanel()).toBeInTheDocument();
  });

  it("closes the panel on Close and the panes take its width (SRS-FR-054)", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listing([]) }));
    await user.click(await folderList().findByText("agent-deck"));
    const grid = historyPanel().closest(".grid")!;
    expect(grid).toHaveClass("grid-cols-[260px_280px_1fr]");
    await user.click(within(historyPanel()).getByRole("button", { name: "Close session history" }));
    expect(screen.queryByRole("region", { name: "Session history" })).not.toBeInTheDocument();
    expect(grid).toHaveClass("grid-cols-[260px_1fr]");
  });

  it("closes on a click on the selected folder and opens and reads again on the next (SRS-FR-054)", async () => {
    const list = listing([]);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await folderList().findByText("agent-deck"));
    await within(historyPanel()).findByText("No sessions yet");
    await user.click(folderList().getByText("agent-deck"));
    expect(screen.queryByRole("region", { name: "Session history" })).not.toBeInTheDocument();
    await user.click(folderList().getByText("agent-deck"));
    expect(historyPanel()).toBeInTheDocument();
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("opens the panel and reads again when the selected folder is added again (SRS-FR-007)", async () => {
    const list = listing([]);
    const client = workspacesClient([ws("a", "agent-deck")]);
    client.pickFolder = vi.fn(async () => "/p/agent-deck");
    client.add = vi.fn(async () => ({ outcome: "alreadyPresent" as const, id: "a" }));
    const user = userEvent.setup();
    render(<App workspaces={client} sessions={fakeSessions({ list })} createTerminal={() => fakeAdapter()} />);
    await user.click(await folderList().findByText("agent-deck"));
    await within(historyPanel()).findByText("No sessions yet");
    await user.click(within(historyPanel()).getByRole("button", { name: "Close session history" }));
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    await within(historyPanel()).findByText("No sessions yet");
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("keeps the panel open on another folder and shows that folder (SRS-FR-054)", async () => {
    const { user } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list: listing([]) }));
    await user.click(await folderList().findByText("alpha"));
    await user.click(folderList().getByText("beta"));
    expect(within(historyPanel()).getByRole("heading", { name: "beta" })).toBeInTheDocument();
  });

  it("shows how many sessions could not be read", async () => {
    const list = listing([{ id: "a", title: "Init repo", lastActivity: now }], 2);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await folderList().findByText("agent-deck"));
    expect(await within(historyPanel()).findByText("2 sessions could not be read")).toBeInTheDocument();
  });

  it("says a missing folder no longer exists and does not read it", async () => {
    const list = listing([]);
    const { user } = setup([ws("m", "gone", true)], fakeSessions({ list }));
    await user.click(await folderList().findByText("gone"));
    expect(await within(historyPanel()).findByText("This folder no longer exists on disk.")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("puts a new session on top as Live and drops the label when its pane closes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([{ id: "old", title: "Init repo", lastActivity: now - 3_600_000 }]);
    const sessions = fakeSessions({ list, titles: ["Fix login"] });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    await vi.waitFor(() => expect(rowTexts()).toEqual(["Fix loginLive", "Init repo1 h ago"]));
    list.mockResolvedValue({ sessions: [{ id: "s1", title: "Fix login", lastActivity: now }, { id: "old", title: "Init repo", lastActivity: now - 3_600_000 }], unreadable: 0 });
    await closeVia(user);
    await vi.waitFor(() => expect(rowTexts()).toEqual(["Fix loginJust now", "Init repo1 h ago"]));
  });

  it("drops the Live label once the session in the pane has ended", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([{ id: "s1", title: "Fix login", lastActivity: now }]);
    const sessions = fakeSessions({ list });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    await vi.waitFor(() => expect(rowTexts()).toEqual(["Fix loginLive"]));
    act(() => sessions.opened[0].stream.exit(1));
    await vi.waitFor(() => expect(rowTexts()).toEqual(["Fix loginJust now"]));
  });

  it("shows the folder selected last even when an earlier read answers later", async () => {
    type Listing = { sessions: { id: string; title: string; lastActivity: number }[]; unreadable: number };
    let answerFirst: (v: Listing) => void = () => {};
    const list = vi.fn((id: string) =>
      id === "a"
        ? new Promise<Listing>((r) => (answerFirst = r))
        : Promise.resolve({ sessions: [{ id: "b1", title: "Beta work", lastActivity: now }], unreadable: 0 }),
    );
    const { user } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list }));
    await user.click(await folderList().findByText("alpha"));
    await user.click(folderList().getByText("beta"));
    await vi.waitFor(() => expect(rowTexts()).toEqual([expect.stringContaining("Beta work")]));
    await act(async () => answerFirst({ sessions: [{ id: "a1", title: "Alpha work", lastActivity: now }], unreadable: 0 }));
    expect(rowTexts()).toEqual([expect.stringContaining("Beta work")]);
  });
});

describe("Resume (2.1, 2.2)", () => {
  const SCAFFOLD = "11111111-1111-4111-8111-111111111111";
  const BRD = "22222222-2222-4222-8222-222222222222";
  const list = () =>
    vi.fn(async () => ({
      sessions: [
        { id: SCAFFOLD, title: "Scaffold Tauri app", lastActivity: 2_000 },
        { id: BRD, title: "Write BRD and SRS", lastActivity: 1_000 },
      ],
      unreadable: 0,
    }));
  const row = (title: string) => within(historyPanel()).getByRole("button", { name: new RegExp(title) });
  const resumeButton = () => within(historyPanel()).getByRole("button", { name: "Resume" });

  async function selectRow(user: ReturnType<typeof userEvent.setup>, folder: string, title: string) {
    await user.click(await folderList().findByText(folder));
    await user.click(await within(historyPanel()).findByRole("button", { name: new RegExp(title) }));
  }

  it("offers Resume only on the selected row", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: list() }));
    await user.click(await folderList().findByText("agent-deck"));
    await within(historyPanel()).findByRole("button", { name: /Scaffold/ });
    expect(within(historyPanel()).queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
    expect(row("Scaffold")).toHaveAttribute("aria-pressed", "false");
    await user.click(row("Scaffold"));
    expect(row("Scaffold")).toHaveAttribute("aria-pressed", "true");
    expect(resumeButton()).toBeInTheDocument();
    await user.click(row("Write BRD"));
    expect(within(historyPanel()).getAllByRole("button", { name: "Resume" })).toHaveLength(1);
  });

  it("clears the selection when another folder is selected", async () => {
    const { user } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list: list() }));
    await selectRow(user, "alpha", "Scaffold");
    expect(resumeButton()).toBeInTheDocument();
    await user.click(folderList().getByText("beta"));
    await within(historyPanel()).findByRole("button", { name: /Scaffold/ });
    expect(within(historyPanel()).queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("opens the session with its id in a focused pane titled after the row", async () => {
    const title = vi.fn(() => new Promise<string>(() => {}));
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")], fakeSessions({ list: list(), title }));
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    expect(await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" })).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, SCAFFOLD);
    expect(adapters[0].focus).toHaveBeenCalled();
    expect(panes()).toHaveLength(1);
    expect(row("Scaffold")).toHaveTextContent("Live");
    expect(within(historyPanel()).getByRole("list", { name: "Session history" }).querySelectorAll("li")).toHaveLength(2);
  });

  it("focuses the pane that already holds the session instead of opening another", async () => {
    const sessions = fakeSessions({ list: list(), title: vi.fn(async (id: string) => (id === "p1" ? "Scaffold Tauri app" : "Other")) });
    const { user, adapters } = setup([ws("a", "agent-deck")], sessions);
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });
    await user.click(newSessionButton());
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    const focusedLabel = () => panes().find((p) => p.classList.contains("ring-2"))?.getAttribute("aria-label");
    expect(focusedLabel()).not.toBe("agent-deck · Scaffold Tauri app");

    const focusCalls = vi.mocked(adapters[0].focus).mock.calls.length;
    await user.click(resumeButton());
    expect(adapters[0].focus).toHaveBeenCalledTimes(focusCalls + 1);
    expect(sessions.open).toHaveBeenCalledTimes(2);
    expect(panes()).toHaveLength(2);
    expect(focusedLabel()).toBe("agent-deck · Scaffold Tauri app");
  });

  it("moves keyboard focus to the pane even when it is already the focused one", async () => {
    const { user, adapters } = setup([ws("a", "agent-deck")], fakeSessions({ list: list() }));
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    await screen.findByRole("region", { name: /agent-deck/ });
    const focusCalls = vi.mocked(adapters[0].focus).mock.calls.length;
    await user.click(resumeButton());
    expect(adapters[0].focus).toHaveBeenCalledTimes(focusCalls + 1);
  });

  it("shows Folder not found when the backend reports the folder missing", async () => {
    const sessions = fakeSessions({ list: list(), open: vi.fn(async () => Promise.reject("folder_missing")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
  });

  it("opens no second pane when the backend says the session is already open", async () => {
    const sessions = fakeSessions({ list: list(), open: vi.fn(async () => Promise.reject("already_open")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    expect(await screen.findByText("Could not open session")).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
  });

  it("shows the generic message when the backend rejects the session id", async () => {
    const sessions = fakeSessions({ list: list(), open: vi.fn(async () => Promise.reject("invalid_session")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    expect(await screen.findByText("Could not open session")).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
  });

  it("resumes in the workspace the row belongs to", async () => {
    const { user, sessions } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list: list() }));
    await selectRow(user, "beta", "Scaffold");
    await user.click(resumeButton());
    await vi.waitFor(() => expect(sessions.open).toHaveBeenCalledWith("b", 80, 24, SCAFFOLD));
  });
});

describe("Split layout (2.1 to 2.3)", () => {
  const rectOf = (pane: HTMLElement) => {
    const { left, top, width, height } = pane.parentElement!.style;
    return [left, top, width, height].map(parseFloat);
  };
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  // New Session opens to the right of the focused pane, which is the pane opened last.
  const newSession = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: `agent-deck · ${title}` });
  };

  async function startOne() {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    return ctx;
  }

  it("puts the new session to the right of the focused pane and focuses it (SRS-FR-021)", async () => {
    const { user, sessions, adapters } = await startOne();
    await newSession(user, "p2");
    expect(sessions.open).toHaveBeenLastCalledWith("a", 80, 24, undefined);
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 50, 100]);
    expect(rectOf(paneNamed("p2"))).toEqual([50, 0, 50, 100]);
    expect(adapters[1].focus).toHaveBeenCalled();
    expect(paneNamed("p2")).toHaveClass("ring-2");
  });

  it("has no Split right or Split down button on a pane (SRS-FR-022 removed)", async () => {
    await startOne();
    expect(within(paneNamed("p1")).queryByRole("button", { name: "Split right" })).not.toBeInTheDocument();
    expect(within(paneNamed("p1")).queryByRole("button", { name: "Split down" })).not.toBeInTheDocument();
  });

  it("splits only the right half when a pane is dropped below the second one", async () => {
    const { user } = await startOne();
    await newSession(user, "p2");
    await newSession(user, "p3");
    dragPane("p3", "p2", "bottom");
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 50, 100]);
    expect(rectOf(paneNamed("p2"))).toEqual([50, 0, 50, 50]);
    expect(rectOf(paneNamed("p3"))).toEqual([50, 50, 50, 50]);
  });

  it("splits the focused pane to the right from the sidebar", async () => {
    const { user } = await startOne();
    await newSession(user, "p2");
    dragPane("p2", "p1", "bottom");
    act(() => paneNamed("p1").dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p3" });
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 50, 50]);
    expect(rectOf(paneNamed("p3"))).toEqual([50, 0, 50, 50]);
    expect(rectOf(paneNamed("p2"))).toEqual([0, 50, 100, 50]);
  });

  it("keeps the terminals mounted when the layout changes shape", async () => {
    const { user, adapters } = await startOne();
    const before = vi.mocked(adapters[0].open).mock.calls.length;
    await newSession(user, "p2");
    await newSession(user, "p3");
    dragPane("p3", "p2", "bottom");
    expect(vi.mocked(adapters[0].open).mock.calls.length).toBe(before);
    expect(adapters[0].container!.isConnected).toBe(true);
  });

  describe("divider", () => {
    async function twoPanes() {
      const ctx = await startOne();
      await newSession(ctx.user, "p2");
      vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1200, 800));
      return screen.getByRole("separator");
    }
    const widths = () => [rectOf(paneNamed("p1"))[2], rectOf(paneNamed("p2"))[2]];

    it("is a vertical separator for a right split", async () => {
      const divider = await twoPanes();
      expect(divider).toHaveAttribute("aria-orientation", "vertical");
    });

    it("moves with the pointer", async () => {
      const divider = await twoPanes();
      fireEvent.pointerDown(divider, { clientX: 600, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 800, clientY: 100, pointerId: 1 });
      fireEvent.pointerUp(divider, { clientX: 800, clientY: 100, pointerId: 1 });
      expect(widths()[0]).toBeCloseTo(66.67, 1);
      expect(widths()[1]).toBeCloseTo(33.33, 1);
    });

    it("stops following the pointer after release", async () => {
      const divider = await twoPanes();
      fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
      fireEvent.pointerUp(divider, { clientX: 600, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 800, pointerId: 1 });
      expect(widths()).toEqual([50, 50]);
    });

    it("leaves each side at least 200 px wide", async () => {
      const divider = await twoPanes();
      fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 1150, pointerId: 1 });
      expect(widths()[1]).toBeCloseTo((200 / 1200) * 100, 5);
      fireEvent.pointerMove(divider, { clientX: 10, pointerId: 1 });
      expect(widths()[0]).toBeCloseTo((200 / 1200) * 100, 5);
    });

    it("keeps the panes nested in the far side at least 200 px wide", async () => {
      const { user } = await startOne();
      await newSession(user, "p2");
      await newSession(user, "p3");
      vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1200, 800));
      const divider = screen.getAllByRole("separator")[0];
      fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 1150, pointerId: 1 });
      expect(rectOf(paneNamed("p2"))[2]).toBeGreaterThanOrEqual((200 / 1200) * 100 - 1e-9);
      expect(rectOf(paneNamed("p3"))[2]).toBeGreaterThanOrEqual((200 / 1200) * 100 - 1e-9);
      expect(rectOf(paneNamed("p1"))[2]).toBeCloseTo((800 / 1200) * 100, 5);
    });

    it("stops following the pointer when it is cancelled", async () => {
      const divider = await twoPanes();
      fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
      fireEvent.pointerCancel(divider, { pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 800, pointerId: 1 });
      expect(widths()).toEqual([50, 50]);
    });

    it("leaves each side at least 120 px tall for a down split", async () => {
      const { user } = await startOne();
      await newSession(user, "p2");
      dragPane("p2", "p1", "bottom");
      vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1200, 800));
      const divider = screen.getByRole("separator");
      expect(divider).toHaveAttribute("aria-orientation", "horizontal");
      fireEvent.pointerDown(divider, { clientY: 400, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientY: 790, pointerId: 1 });
      expect(rectOf(paneNamed("p2"))[3]).toBeCloseTo((120 / 800) * 100, 5);
    });
  });

  it("sizes the new session from half of the pane it splits", async () => {
    const { user, sessions, adapters } = await startOne();
    const body = document.querySelector('[data-pane-body="p1"]')!;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 974, 545));
    await newSession(user, "p2");
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.width).toBe("478px");
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.height).toBe("545px");
    expect(sessions.open).toHaveBeenCalledTimes(2);
  });

  it("lets the remaining pane fill the area when its neighbour closes", async () => {
    const { user } = await startOne();
    await newSession(user, "p2");
    await closeVia(user, "Close", paneNamed("p2"));
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · p2" })).not.toBeInTheDocument());
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 100, 100]);
  });
});

describe("Drag a pane (3.1 to 3.3)", () => {
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  const wrapper = (title: string) => paneNamed(title).parentElement!;
  const rectOf = (title: string) => {
    const { left, top, width, height } = wrapper(title).style;
    return [left, top, width, height].map(parseFloat);
  };
  const zones = () => document.querySelector("[data-drop-target]");
  const header = (title: string) => paneNamed(title).querySelector("header")!;

  async function start(count: number) {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    for (let n = 2; n <= count; n++) {
      await ctx.user.click(newSessionButton());
      await screen.findByRole("region", { name: `agent-deck · p${n}` });
    }
    vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(GRID);
    return ctx;
  }

  it("shows the Drop Zones of the pane under the pointer with that side lit (SRS-FR-080)", async () => {
    await start(2);
    dragPane("p1", "p2", "bottom", { release: false });

    expect(zones()).toHaveAttribute("data-drop-target", "p2");
    expect(zones()!.querySelectorAll("[data-drop-side]")).toHaveLength(4);
    expect(zones()!.querySelector("[data-active]")).toHaveAttribute("data-drop-side", "bottom");
    expect(wrapper("p1")).toHaveClass("opacity-50");

    fireEvent.pointerMove(window, { ...sidePoint("p2", "right"), pointerId: 1 });
    expect(zones()!.querySelector("[data-active]")).toHaveAttribute("data-drop-side", "right");
  });

  it("shows no Drop Zone with only one pane (SRS-FR-080)", async () => {
    await start(1);
    fireEvent.pointerDown(header("p1"), { clientX: 600, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 600, clientY: 700, pointerId: 1 });
    expect(zones()).toBeNull();
    expect(wrapper("p1")).not.toHaveClass("opacity-50");
  });

  it("starts no drag from a header button (SRS-FR-080)", async () => {
    await start(2);
    fireEvent.pointerDown(within(paneNamed("p1")).getByRole("button", { name: "Close pane" }), { clientX: 580, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { ...sidePoint("p2", "bottom"), pointerId: 1 });
    expect(zones()).toBeNull();
  });

  it("starts no drag while a pane is maximized", async () => {
    const { user } = await start(2);
    await user.click(within(paneNamed("p1")).getByRole("button", { name: "Maximize pane" }));
    fireEvent.pointerDown(header("p1"), { clientX: 300, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 900, clientY: 700, pointerId: 1 });
    expect(zones()).toBeNull();
    expect(wrapper("p1")).not.toHaveClass("opacity-50");
  });

  it("does not start a drag before the pointer moves more than 4 px", async () => {
    await start(2);
    fireEvent.pointerDown(header("p1"), { clientX: 300, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 303, clientY: 12, pointerId: 1 });
    expect(wrapper("p1")).not.toHaveClass("opacity-50");
  });

  it("moves the dropped pane to that side, splitting the target in half (SRS-FR-081)", async () => {
    const { sessions, adapters } = await start(2);
    act(() => sessions.opened[0].stream.status({ state: "Running" }));
    const opens = vi.mocked(adapters[0].open).mock.calls.length;
    const focusCalls = vi.mocked(adapters[0].focus).mock.calls.length;

    dragPane("p1", "p2", "bottom");

    expect(rectOf("p2")).toEqual([0, 0, 100, 50]);
    expect(rectOf("p1")).toEqual([0, 50, 100, 50]);
    expect(zones()).toBeNull();
    expect(wrapper("p1")).not.toHaveClass("opacity-50");
    expect(within(paneNamed("p1")).getByText("Running")).toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
    expect(vi.mocked(adapters[0].open).mock.calls.length).toBe(opens);
    expect(adapters[0].container!.isConnected).toBe(true);
    expect(adapters[0].focus).toHaveBeenCalledTimes(focusCalls + 1);
  });

  it("gives the old place of the moved pane to the others (SRS-FR-081)", async () => {
    await start(3);
    dragPane("p3", "p2", "bottom");
    dragPane("p3", "p1", "left");
    expect(rectOf("p3")).toEqual([0, 0, 25, 100]);
    expect(rectOf("p1")).toEqual([25, 0, 25, 100]);
    expect(rectOf("p2")).toEqual([50, 0, 50, 100]);
  });

  it("keeps the layout when the pane is released over itself or outside the panes (SRS-FR-082)", async () => {
    await start(2);
    const before = [rectOf("p1"), rectOf("p2")];
    dragPane("p1", "p1", "bottom");
    expect([rectOf("p1"), rectOf("p2")]).toEqual(before);

    dragPane("p1", "p2", "bottom", { release: false });
    fireEvent.pointerMove(window, { clientX: -50, clientY: 400, pointerId: 1 });
    expect(zones()).toBeNull();
    fireEvent.pointerUp(window, { clientX: -50, clientY: 400, pointerId: 1 });
    expect([rectOf("p1"), rectOf("p2")]).toEqual(before);
  });

  it("cancels the drag on Esc (SRS-FR-082)", async () => {
    await start(2);
    const before = [rectOf("p1"), rectOf("p2")];
    dragPane("p1", "p2", "bottom", { release: false });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(zones()).toBeNull();
    expect(wrapper("p1")).not.toHaveClass("opacity-50");
    fireEvent.pointerUp(window, { ...sidePoint("p2", "bottom"), pointerId: 1 });
    expect([rectOf("p1"), rectOf("p2")]).toEqual(before);
  });
});

describe("Reopen panes at launch (2.2 to 2.4)", () => {
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  const wrapper = (title: string) => paneNamed(title).parentElement!;
  const rectOf = (title: string) => {
    const { left, top, width, height } = wrapper(title).style;
    return [left, top, width, height].map((v) => Math.round(parseFloat(v)));
  };
  const titledSessions = () => {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    return sessions;
  };
  const remembered = () => Object.values(readSnapshot()?.panes ?? {}).map((p) => p.sessionId);

  async function firstLaunch(count: number, sessions = titledSessions()) {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    for (let n = 2; n <= count; n++) {
      await ctx.user.click(newSessionButton());
      await screen.findByRole("region", { name: `agent-deck · p${n}` });
    }
    return ctx;
  }

  function relaunch(items = [ws("a", "agent-deck")], sessions = titledSessions()) {
    cleanup();
    return setup(items, sessions);
  }

  function saved(panes: Record<string, string>, layout: Snapshot["layout"]) {
    writeSnapshot({
      version: 1,
      layout,
      panes: Object.fromEntries(
        Object.entries(panes).map(([id, workspaceId]) => [id, { workspaceId, sessionId: `old-${id}`, title: `Saved ${id}` }]),
      ),
    });
  }
  const row = (a: string, b: string, c?: string): Snapshot["layout"] => {
    const tail: Snapshot["layout"] = c ? { split: "right", ratio: 0.5, first: { pane: b }, second: { pane: c } } : { pane: b };
    return { split: "right", ratio: 0.5, first: { pane: a }, second: tail };
  };

  it("remembers the panes as they open, resize and close (SRS-FR-084)", async () => {
    const { user } = await firstLaunch(2);
    await vi.waitFor(() => expect(remembered()).toEqual(["s1", "s2"]));

    vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(GRID);
    const divider = screen.getByRole("separator");
    fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 360, pointerId: 1 });
    fireEvent.pointerUp(divider, { clientX: 360, pointerId: 1 });
    expect(readSnapshot()!.layout).toMatchObject({ split: "right", ratio: 0.3 });

    await closeVia(user, "Close", paneNamed("p2"));
    await vi.waitFor(() => expect(remembered()).toEqual(["s1"]));
  });

  it("remembers the session Claude Code moved to after /clear (SRS-FR-084)", async () => {
    const sessions = titledSessions();
    await firstLaunch(1, sessions);
    await vi.waitFor(() => expect(remembered()).toEqual(["s1"]));
    act(() => sessions.opened[0].stream.session("after-clear"));
    expect(remembered()).toEqual(["after-clear"]);
  });

  it("does not remember a new session that never got a prompt, nor an ended one (SRS-FR-084)", async () => {
    const sessions = fakeSessions({ titles: ["(untitled)"] });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    await vi.waitFor(() => expect(sessions.title).toHaveBeenCalled());
    expect(readSnapshot()).toBeNull();

    act(() => sessions.opened[0].stream.status({ state: "Running" }));
    expect(remembered()).toEqual(["s1"]);
    act(() => sessions.opened[0].stream.exit(1));
    expect(readSnapshot()).toBeNull();
  });

  it("keeps the saved panes while the folder list has not loaded", async () => {
    saved({ x1: "a" }, { pane: "x1" });
    const before = localStorage.getItem("adOpenPanes");
    const client = workspacesClient([]);
    client.list = vi.fn(() => new Promise<Workspace[]>(() => {}));
    render(<App workspaces={client} sessions={fakeSessions()} createTerminal={() => fakeAdapter()} />);
    await act(async () => {});
    expect(localStorage.getItem("adOpenPanes")).toBe(before);
  });

  it("resumes the remembered sessions in their places, unmaximized and without a shell (SRS-FR-085)", async () => {
    const first = await firstLaunch(2);
    vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(GRID);
    const divider = screen.getByRole("separator");
    fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 360, pointerId: 1 });
    fireEvent.pointerUp(divider, { clientX: 360, pointerId: 1 });
    await first.user.click(within(paneNamed("p1")).getByRole("button", { name: "Open shell" }));
    await first.user.click(within(paneNamed("p2")).getByRole("button", { name: "Maximize pane" }));

    const { sessions } = relaunch();

    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(vi.mocked(sessions.open).mock.calls.map((c) => c[3])).toEqual(["s1", "s2"]);
    expect(rectOf("p1")).toEqual([0, 0, 30, 100]);
    expect(rectOf("p2")).toEqual([30, 0, 70, 100]);
    expect(wrapper("p2")).not.toHaveClass("fixed");
    expect(sessions.openShell).not.toHaveBeenCalled();
    expect(paneNamed("p2")).toHaveClass("ring-2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaves out the pane of a missing folder and reports it (SRS-FR-086)", async () => {
    saved({ x1: "a", x2: "b", x3: "a" }, row("x1", "x2", "x3"));
    const { sessions } = relaunch([ws("a", "agent-deck"), ws("b", "mokairo", true)]);

    expect(await screen.findByRole("alert")).toHaveTextContent("1 sessions could not be reopened");
    expect(vi.mocked(sessions.open).mock.calls.map((c) => c[3])).toEqual(["old-x1", "old-x3"]);
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(rectOf("p1")).toEqual([0, 0, 50, 100]);
    expect(rectOf("p2")).toEqual([50, 0, 50, 100]);
  });

  it("counts a folder no longer in the list and a session that cannot be resumed (SRS-FR-086)", async () => {
    saved({ x1: "a", x2: "gone", x3: "a" }, row("x1", "x2", "x3"));
    const sessions = titledSessions();
    vi.mocked(sessions.open).mockRejectedValueOnce("invalid_session");
    relaunch([ws("a", "agent-deck")], sessions);

    expect(await screen.findByRole("alert")).toHaveTextContent("2 sessions could not be reopened");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    expect(rectOf("p1")).toEqual([0, 0, 100, 100]);
  });

  it("counts a session whose Claude Code does not start and closes its pane (SRS-FR-086)", async () => {
    saved({ x1: "a", x2: "a" }, row("x1", "x2"));
    const sessions = fakeSessions({ started: false });
    relaunch([ws("a", "agent-deck")], sessions);

    expect(await screen.findByRole("alert")).toHaveTextContent("2 sessions could not be reopened");
    expect(sessions.close).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
  });
});

describe("Maximize pane (2.1 to 2.4)", () => {
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  const wrapper = (title: string) => paneNamed(title).parentElement!;
  const button = (title: string, name: string) => within(paneNamed(title)).getByRole("button", { name });
  const styleOf = (title: string) => wrapper(title).getAttribute("style");

  async function threePanes() {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await ctx.user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p2" });
    await ctx.user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p3" });
    dragPane("p3", "p2", "bottom");
    return ctx;
  }

  it("covers the window with the maximized pane and hides the others in place (SRS-FR-041)", async () => {
    const { user } = await threePanes();
    const before = { p1: styleOf("p1"), p3: styleOf("p3") };

    await user.click(button("p2", "Maximize pane"));

    expect(wrapper("p2")).toHaveClass("fixed");
    for (const title of ["p1", "p3"] as const) {
      expect(wrapper(title)).toHaveClass("invisible");
      expect(wrapper(title)).toHaveAttribute("inert");
      expect(styleOf(title)).toBe(before[title]);
    }
    expect(sidebar()).toHaveAttribute("inert");
    expect(historyPanel()).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Hide sidebar" })).toHaveAttribute("inert");
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(button("p2", "Restore pane")).toBeInTheDocument();
  });

  it("moves the keyboard into the pane it maximizes", async () => {
    const { user, adapters } = await threePanes();
    fireEvent.focus(paneNamed("p1"));
    const focusCalls = vi.mocked(adapters[1].focus).mock.calls.length;

    await user.click(button("p2", "Maximize pane"));

    expect(vi.mocked(adapters[1].focus).mock.calls.length).toBe(focusCalls + 1);
    expect(paneNamed("p2")).toHaveClass("ring-2");
    expect(paneNamed("p1")).not.toHaveClass("ring-2");
  });

  it("outlines only the pane the user clicks into (SRS-FR-087)", async () => {
    await threePanes();

    fireEvent.focus(paneNamed("p2"));

    expect(paneNamed("p2")).toHaveClass("ring-2", "ring-ring");
    for (const title of ["p1", "p3"]) expect(paneNamed(title)).not.toHaveClass("ring-2");
  });

  it("keeps an error toast above the maximized pane", async () => {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await ctx.user.click(button("p1", "Maximize pane"));
    vi.mocked(sessions.open).mockRejectedValueOnce("spawn failed");

    await ctx.user.click(newSessionButton());

    const toast = await screen.findByRole("alert");
    expect(wrapper("p1")).toHaveClass("z-10");
    expect(toast).toHaveClass("z-20");
  });

  it("brings back the same layout on Restore (SRS-FR-042)", async () => {
    const { user } = await threePanes();
    const before = ["p1", "p2", "p3"].map(styleOf);

    await user.click(button("p2", "Maximize pane"));
    await user.click(button("p2", "Restore pane"));

    expect(["p1", "p2", "p3"].map(styleOf)).toEqual(before);
    for (const title of ["p1", "p2", "p3"]) {
      expect(wrapper(title)).not.toHaveClass("fixed");
      expect(wrapper(title)).not.toHaveClass("invisible");
      expect(wrapper(title)).not.toHaveAttribute("inert");
    }
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(button("p2", "Maximize pane")).toBeInTheDocument();
  });

  it("fits the terminal to the new size on maximize and back on restore (SRS-FR-043)", async () => {
    const { user, sessions, adapters } = await threePanes();
    adapters[1].size = { cols: 200, rows: 50 };

    await user.click(button("p2", "Maximize pane"));
    expect(sessions.resize).toHaveBeenLastCalledWith("p2", 200, 50);

    adapters[1].size = { cols: 80, rows: 24 };
    await user.click(button("p2", "Restore pane"));
    expect(sessions.resize).toHaveBeenLastCalledWith("p2", 80, 24);
  });

  it("restores the layout before a new pane opens (SRS-FR-046)", async () => {
    const { user } = await threePanes();
    await user.click(button("p1", "Maximize pane"));

    await user.click(newSessionButton());

    await screen.findByRole("region", { name: "agent-deck · p4" });
    expect(wrapper("p1")).not.toHaveClass("fixed");
    expect(wrapper("p2")).not.toHaveClass("invisible");
    expect(sidebar()).not.toHaveAttribute("inert");
    const rect = (title: string) => ["left", "width"].map((k) => parseFloat(wrapper(title).style.getPropertyValue(k)));
    expect(rect("p4")[0]).toBeCloseTo(rect("p1")[0] + rect("p1")[1]);
  });

  const badge = (title: string) => within(paneNamed(title)).queryByRole("button", { name: /needs? you$/ });

  it("counts the other sessions that need the user on the maximized pane (SRS-FR-044)", async () => {
    const { user, sessions } = await threePanes();
    const [p1, p2, p3] = sessions.opened.map((o) => o.stream);
    await user.click(button("p1", "Maximize pane"));

    act(() => p1.status({ state: "Needs Approval" }));
    act(() => p3.status({ state: "Running" }));
    expect(badge("p1")).not.toBeInTheDocument();

    act(() => p3.status({ state: "Needs Approval" }));
    expect(badge("p1")).toHaveAccessibleName("1 session needs you");
    expect(badge("p1")).toHaveTextContent("1 need you");
    expect(badge("p1")).toHaveClass("bg-approval-bg");

    act(() => p2.status({ state: "Error", reason: "overloaded" }));
    expect(badge("p1")).toHaveAccessibleName("2 sessions need you");
    expect(badge("p1")).toHaveClass("bg-error-bg");
    expect(badge("p2")).not.toBeInTheDocument();
  });

  it("restores and focuses the most urgent session when the badge is clicked (SRS-FR-045)", async () => {
    const { user, sessions, adapters } = await threePanes();
    const [, p2, p3] = sessions.opened.map((o) => o.stream);
    await user.click(button("p1", "Maximize pane"));
    act(() => p2.status({ state: "Needs Approval", since: new Date(2026, 9, 17, 14, 0).getTime() }));
    act(() => p3.status({ state: "Error", since: new Date(2026, 9, 17, 14, 5).getTime() }));
    // A browser ignores focus() inside an inert subtree, so the fake records whether the pane was still inert.
    const focusedWhileInert: boolean[] = [];
    vi.mocked(adapters[2].focus).mockImplementation(() => focusedWhileInert.push(wrapper("p3").hasAttribute("inert")));

    await user.click(badge("p1")!);

    expect(wrapper("p1")).not.toHaveClass("fixed");
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(focusedWhileInert).toEqual([false]);
    expect(badge("p1")).not.toBeInTheDocument();
  });

  it("shows the other panes again when the maximized pane is closed", async () => {
    const { user } = await threePanes();
    await user.click(button("p2", "Maximize pane"));

    await closeVia(user, "Close", screen.getByRole("region", { name: "agent-deck · p2" }));

    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · p2" })).not.toBeInTheDocument());
    expect(wrapper("p1")).not.toHaveClass("invisible");
    expect(wrapper("p3")).not.toHaveAttribute("inert");
    expect(sidebar()).not.toHaveAttribute("inert");
  });

  const header = (title: string) => paneNamed(title).querySelector("header")!;

  it("maximizes a pane when its header is double-clicked (SRS-FR-066)", async () => {
    const { user } = await threePanes();
    const before = { p1: styleOf("p1"), p3: styleOf("p3") };

    await user.dblClick(header("p2"));

    expect(wrapper("p2")).toHaveClass("fixed");
    for (const title of ["p1", "p3"] as const) {
      expect(wrapper(title)).toHaveClass("invisible");
      expect(wrapper(title)).toHaveAttribute("inert");
      expect(styleOf(title)).toBe(before[title]);
    }
    expect(sidebar()).toHaveAttribute("inert");
    expect(button("p2", "Restore pane")).toBeInTheDocument();
  });

  it("leaves the pane as it is on a double-click inside the terminal or on a header button (SRS-FR-066)", async () => {
    const { user } = await threePanes();

    await user.dblClick(paneNamed("p2").querySelector("[data-pane-body]")!);
    await user.dblClick(within(paneNamed("p2")).getByRole("button", { name: /^(Open|Hide|Show) shell$/ }));

    expect(wrapper("p2")).not.toHaveClass("fixed");
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(button("p2", "Maximize pane")).toBeInTheDocument();
  });

  // A browser sends dblclick to whatever is under the second press, even when the first click moved it there.
  it("toggles nothing extra when the first press of a double-click hit a header button (SRS-FR-066)", async () => {
    await threePanes();
    const maximizeP2 = button("p2", "Maximize pane");
    fireEvent.mouseDown(maximizeP2, { detail: 1 });
    fireEvent.click(maximizeP2, { detail: 1 });
    fireEvent.mouseDown(header("p2"), { detail: 2 });
    fireEvent.dblClick(header("p2"), { detail: 2 });
    expect(wrapper("p2")).toHaveClass("fixed");

    fireEvent.mouseDown(header("p1"), { detail: 1 });
    fireEvent.mouseLeave(header("p1"));
    fireEvent.mouseDown(button("p2", "Restore pane"), { detail: 1 });
    fireEvent.click(button("p2", "Restore pane"), { detail: 1 });
    fireEvent.mouseDown(header("p1"), { detail: 2 });
    fireEvent.dblClick(header("p1"), { detail: 2 });
    expect(wrapper("p1")).not.toHaveClass("fixed");
  });

  it("restores the same layout when the maximized header is double-clicked (SRS-FR-067)", async () => {
    const { user } = await threePanes();
    const before = ["p1", "p2", "p3"].map(styleOf);

    await user.dblClick(header("p2"));
    expect(wrapper("p2")).toHaveClass("fixed");
    await user.dblClick(header("p2"));

    expect(["p1", "p2", "p3"].map(styleOf)).toEqual(before);
    for (const title of ["p1", "p2", "p3"]) {
      expect(wrapper(title)).not.toHaveClass("fixed");
      expect(wrapper(title)).not.toHaveAttribute("inert");
    }
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(button("p2", "Maximize pane")).toBeInTheDocument();
  });
});

describe("Text Size (2.1, 2.2)", () => {
  afterEach(() => localStorage.clear());

  function zoomSetup(stored?: string, mac = false) {
    if (stored !== undefined) localStorage.setItem("adTextSize", stored);
    const zoom = { setZoom: vi.fn(async (_scale: number) => {}) };
    const ctx = setup([ws("a", "agent-deck")], fakeSessions(), undefined, { zoom, mac });
    return { ...ctx, zoom };
  }
  const zooms = (zoom: { setZoom: ReturnType<typeof vi.fn> }) => zoom.setZoom.mock.calls.map(([scale]) => scale);
  async function press(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = { ctrlKey: true }, target: Element | Document = document) {
    let notPrevented = true;
    await act(async () => {
      notPrevented = fireEvent.keyDown(target, { key, ...mods });
    });
    return notPrevented;
  }

  it("applies the stored Text Size on launch (SRS-FR-071)", async () => {
    const { zoom } = zoomSetup("1.3");
    await vi.waitFor(() => expect(zooms(zoom)).toEqual([1.3]));
  });

  it("enlarges by 10 points per press and stores the size (SRS-FR-068, SRS-FR-071)", async () => {
    const { zoom } = zoomSetup();
    await vi.waitFor(() => expect(zooms(zoom)).toEqual([1]));

    await press("=");
    await press("+");

    expect(zooms(zoom)).toEqual([1, 1.1, 1.2]);
    expect(localStorage.getItem("adTextSize")).toBe("1.2");
  });

  it("stops at 200% and still keeps the key from the pane (SRS-FR-068)", async () => {
    const { zoom } = zoomSetup("2");
    await vi.waitFor(() => expect(zooms(zoom)).toEqual([2]));

    expect(await press("=")).toBe(false);

    expect(zooms(zoom)).toEqual([2]);
  });

  it("shrinks and resets (SRS-FR-069, SRS-FR-070)", async () => {
    const { zoom } = zoomSetup();
    await press("-");
    await press("0");

    expect(zooms(zoom)).toEqual([1, 0.9, 1]);
    expect(localStorage.getItem("adTextSize")).toBe("1");
  });

  it("takes the shortcut from a focused pane without passing it on (SRS-FR-068)", async () => {
    const { user, zoom } = zoomSetup();
    await selectAndStart(user, "agent-deck");
    const pane = (await screen.findAllByRole("region")).find((r) => r.querySelector("[data-pane-body]"))!;
    const paneHeard = vi.fn();
    pane.addEventListener("keydown", paneHeard);

    expect(await press("=", { ctrlKey: true }, pane.querySelector("[data-pane-body]")!)).toBe(false);

    expect(paneHeard).not.toHaveBeenCalled();
    expect(zooms(zoom)).toEqual([1, 1.1]);
  });

  it("uses Cmd on macOS and leaves Ctrl to the terminal (SRS-FR-068)", async () => {
    const { zoom } = zoomSetup(undefined, true);
    await vi.waitFor(() => expect(zooms(zoom)).toEqual([1]));

    expect(await press("-", { ctrlKey: true })).toBe(true);
    await press("=", { metaKey: true });

    expect(zooms(zoom)).toEqual([1, 1.1]);
  });

  it("keeps the old size when the zoom fails", async () => {
    const { zoom } = zoomSetup();
    await vi.waitFor(() => expect(zooms(zoom)).toEqual([1]));
    zoom.setZoom.mockRejectedValueOnce(new Error("not allowed"));

    await press("=");
    await press("=");

    expect(zooms(zoom)).toEqual([1, 1.1, 1.1]);
    expect(localStorage.getItem("adTextSize")).toBe("1.1");
  });

  it("fits every session terminal and Pane Shell after a change (SRS-FR-072)", async () => {
    const { user, sessions, adapters } = zoomSetup();
    await selectAndStart(user, "agent-deck");
    const pane = await screen.findByRole("region", { name: /^agent-deck · / });
    await user.click(within(pane).getByRole("button", { name: "Open shell" }));
    await vi.waitFor(() => expect(adapters).toHaveLength(2));
    const [session, shell] = adapters;
    session.size = { cols: 72, rows: 20 };
    shell.size = { cols: 72, rows: 6 };

    await press("=");

    await vi.waitFor(() => expect(sessions.resize).toHaveBeenLastCalledWith(sessions.opened[0].pane.paneId, 72, 20));
    expect(sessions.shellResize).toHaveBeenLastCalledWith(sessions.opened[0].pane.paneId, 72, 6);
  });
});

describe("Sidebar toggle (2.13)", () => {
  const toggle = (name: "Hide sidebar" | "Show sidebar") => screen.getByRole("button", { name });
  const sidebarGone = () => expect(screen.queryByRole("complementary", { name: "Workspaces" })).not.toBeInTheDocument();
  async function press(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean }, target: Element | Document = document) {
    let notPrevented = true;
    await act(async () => {
      notPrevented = fireEvent.keyDown(target, { key, ...mods });
    });
    return notPrevented;
  }

  it("starts shown, hides and shows with the button, and keeps the selected folder (SRS-FR-088, SRS-FR-090)", async () => {
    const { user } = setup([ws("a", "agent-deck")]);
    await user.click(await folderList().findByText("agent-deck"));
    const grid = sidebar().parentElement!;
    expect(grid.className).toContain("260px");
    expect(toggle("Hide sidebar")).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle("Hide sidebar"));

    sidebarGone();
    expect(grid.className).not.toContain("260px");
    expect(toggle("Show sidebar")).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle("Show sidebar"));

    expect(folderList().getByText("agent-deck").closest("[aria-current]")).toHaveAttribute("aria-current", "true");
    expect(grid.className).toContain("260px");
  });

  it("takes Cmd+B from a focused pane on macOS and leaves the focus there (SRS-FR-089)", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions(), undefined, { mac: true });
    await selectAndStart(user, "agent-deck");
    const pane = (await screen.findAllByRole("region")).find((r) => r.querySelector("[data-pane-body]"))!;
    fireEvent.focus(pane);
    const paneHeard = vi.fn();
    pane.addEventListener("keydown", paneHeard);

    expect(await press("b", { metaKey: true }, pane.querySelector("[data-pane-body]")!)).toBe(false);

    expect(paneHeard).not.toHaveBeenCalled();
    sidebarGone();
    expect(pane).toHaveClass("ring-2");

    await press("b", { metaKey: true });
    expect(sidebar()).toBeInTheDocument();
  });

  it("leaves Ctrl+B and Ctrl+H to the terminal on macOS (SRS-FR-089)", async () => {
    setup([ws("a", "agent-deck")], fakeSessions(), undefined, { mac: true });
    await folderList().findByText("agent-deck");

    expect(await press("b", { ctrlKey: true })).toBe(true);
    expect(await press("h", { ctrlKey: true })).toBe(true);

    expect(sidebar()).toBeInTheDocument();
  });

  it("uses Ctrl+B on Windows (SRS-FR-089)", async () => {
    setup([ws("a", "agent-deck")]);
    await folderList().findByText("agent-deck");

    expect(await press("b", { ctrlKey: true })).toBe(false);

    sidebarGone();
  });
});

describe("Jump from Active Sessions (2.4)", () => {
  const since = new Date(2026, 9, 16, 14, 2).getTime();
  const rowButton = (title: string) =>
    within(within(within(sidebar()).getByRole("list", { name: "Active sessions" })).getByText(title).closest("li")!).getByRole(
      "button",
    );
  const historyRowButton = (title: string) =>
    within(within(historyPanel()).getByRole("list", { name: "Session history" })).getByRole("button", { name: new RegExp(title) });

  async function twoPanesSecondAsking() {
    const listed = { sessions: [{ id: "old", title: "Old work", lastActivity: 1 }], unreadable: 0 };
    const sessions = fakeSessions({ titles: ["First", "Second"], list: vi.fn(async () => listed) });
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await ctx.user.click(newSessionButton());
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    await within(sidebar()).findByText("Second");
    await within(historyPanel()).findByText("Old work");
    act(() => ctx.sessions.opened[1].stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    fireEvent.focus(panes()[0]);
    expect(panes()[0]).toHaveClass("ring-2");
    return { ...ctx, focusCalls: vi.mocked(ctx.adapters[1].focus).mock.calls.length };
  }

  // The Focus Outline moves onto the pane asking for approval, over its status border (SRS-FR-087).
  function expectJumpedToSecond(adapters: FakeAdapter[], focusCalls: number) {
    expect(panes()[0]).not.toHaveClass("ring-2");
    expect(panes()[1]).toHaveClass("ring-2", "border-approval");
    expect(vi.mocked(adapters[1].focus).mock.calls.length).toBe(focusCalls + 1);
  }

  it("focuses the pane of the clicked row and sends the next key to it (SRS-FR-037)", async () => {
    const { user, sessions, adapters, focusCalls } = await twoPanesSecondAsking();

    await user.click(rowButton("Second"));

    expectJumpedToSecond(adapters, focusCalls);
    adapters[1].type("1");
    expect(sessions.write).toHaveBeenLastCalledWith("p2", "1");
  });

  it("jumps with Enter and keeps that Enter from reaching the terminal", async () => {
    const { adapters, focusCalls } = await twoPanesSecondAsking();

    const notPrevented = fireEvent.keyDown(rowButton("Second"), { key: "Enter" });

    expect(notPrevented).toBe(false);
    expectJumpedToSecond(adapters, focusCalls);
  });

  it("shows a focus ring on a session row reached with the keyboard", async () => {
    await twoPanesSecondAsking();
    expect(rowButton("Second")).toHaveClass("focus-visible:ring-2");
  });

  it("jumps from an Idle row too (SRS-FR-037)", async () => {
    const { user, adapters } = await twoPanesSecondAsking();
    fireEvent.focus(panes()[1]);
    const calls = vi.mocked(adapters[0].focus).mock.calls.length;

    await user.click(rowButton("First"));

    expect(vi.mocked(adapters[0].focus).mock.calls.length).toBe(calls + 1);
    expect(panes()[0]).toHaveClass("ring-2");
  });

  it("does not jump from a history row, which offers Resume instead", async () => {
    const { user, adapters } = await twoPanesSecondAsking();
    const calls = adapters.map((a) => vi.mocked(a.focus).mock.calls.length);

    await user.click(historyRowButton("Second"));

    expect(adapters.map((a) => vi.mocked(a.focus).mock.calls.length)).toEqual(calls);
    expect(panes()[0]).toHaveClass("ring-2");
    expect(within(historyPanel()).getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

});

describe("Row Focus Mark (2.5)", () => {
  const row = (title: string) =>
    within(within(sidebar()).getByRole("list", { name: "Active sessions" })).getByText(title).closest("li")!;
  const marked = () =>
    within(within(sidebar()).getByRole("list", { name: "Active sessions" }))
      .queryAllByRole("listitem")
      .filter((li) => li.getAttribute("aria-current") === "true");

  async function twoIdlePanes() {
    const sessions = fakeSessions({ titles: ["First", "Second"] });
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await ctx.user.click(newSessionButton());
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    await within(sidebar()).findByText("Second");
    return ctx;
  }

  it("marks only the row of the idle pane the user clicks into (SRS-FR-099)", async () => {
    await twoIdlePanes();

    fireEvent.focus(panes()[1]);

    expect(marked()).toEqual([row("Second")]);
    expect(row("Second")).toHaveClass("ring-2", "ring-inset", "ring-ring");
    expect(row("First")).not.toHaveClass("ring-2");
  });

  it("keeps the Running highlight under the mark (SRS-FR-099)", async () => {
    const { sessions } = await twoIdlePanes();
    act(() => sessions.opened[0].stream.status({ state: "Running" }));

    fireEvent.focus(panes()[0]);

    expect(row("First")).toHaveClass("bg-running-bg", "ring-2", "ring-ring");
    expect(row("First")).toHaveAttribute("aria-current", "true");
  });

  it("moves the mark to the row the user jumps from (SRS-FR-099)", async () => {
    const { user } = await twoIdlePanes();
    fireEvent.focus(panes()[1]);

    await user.click(within(row("First")).getByRole("button"));

    expect(marked()).toEqual([row("First")]);
  });

  it("marks no row once the focused pane has closed (SRS-FR-099)", async () => {
    const { sessions } = await twoIdlePanes();
    fireEvent.focus(panes()[1]);

    act(() => sessions.opened[1].stream.exit(0));
    await vi.waitFor(() => expect(panes()).toHaveLength(1));

    expect(marked()).toEqual([]);
    expect(row("First")).not.toHaveClass("ring-2");
  });
});

describe("Delete a session (2.2 to 2.4)", () => {
  type Row = { id: string; title: string; lastActivity: number };

  /** `before`: rows already on disk ahead of the two old sessions, such as the one a pane will open as "s1". */
  async function folderWithSessions(over: Partial<FakeSessions> = {}, before: Row[] = []) {
    let rows: Row[] = [
      ...before,
      { id: "old", title: "Old work", lastActivity: 2 },
      { id: "keep", title: "Init repo", lastActivity: 1 },
    ];
    const sessions = fakeSessions({
      titles: ["Live work"],
      list: vi.fn(async () => ({ sessions: [...rows], unreadable: 0 })),
      deleteSession: vi.fn(async (_ws: string, id: string) => {
        rows = rows.filter((r) => r.id !== id);
      }),
      ...over,
    });
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await ctx.user.click(await folderList().findByText("agent-deck"));
    await within(historyPanel()).findByText("Old work");
    return { ...ctx, drop: (id: string) => (rows = rows.filter((r) => r.id !== id)) };
  }

  const pick = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(within(historyPanel()).getByText(title));
    await user.click(within(historyPanel()).getByRole("button", { name: "Delete" }));
  };

  it("asks before deleting and Cancel keeps the session (SRS-FR-048)", async () => {
    const { user, sessions } = await folderWithSessions();

    await pick(user, "Old work");

    const dialog = screen.getByRole("dialog", { name: "Move “Old work” to Trash?" });
    expect(within(dialog).getByText("You can restore it from the Trash.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    expect(within(historyPanel()).getByText("Old work")).toBeInTheDocument();
  });

  it("moves the session to the Trash and reads the list again (SRS-FR-047)", async () => {
    const { user, sessions } = await folderWithSessions();

    await pick(user, "Old work");
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "old", undefined);
    await vi.waitFor(() => expect(within(historyPanel()).queryByText("Old work")).not.toBeInTheDocument());
    expect(within(historyPanel()).getByText("Init repo")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ends an open session and closes its pane as part of the delete (SRS-FR-049)", async () => {
    const { user, sessions } = await folderWithSessions();
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await within(historyPanel()).findByText("Live work");

    await pick(user, "Live work");

    const dialog = screen.getByRole("dialog", { name: "Close “Live work” and move it to Trash?" });
    expect(within(dialog).getByText("The session will be ended and its pane closed.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close and move" }));

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", "p1");
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Live work" })).not.toBeInTheDocument());
  });

  it("keeps the session and says so when it cannot be moved (SRS-FR-050)", async () => {
    const { user } = await folderWithSessions({ deleteSession: vi.fn(async () => Promise.reject("locked")) });

    await pick(user, "Old work");
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Session could not be deleted");
    expect(within(historyPanel()).getByText("Old work")).toBeInTheDocument();
  });

  it("ignores a second Delete while the first one is still running", async () => {
    let finish: () => void = () => {};
    const { user, sessions } = await folderWithSessions({
      deleteSession: vi.fn(() => new Promise<void>((r) => (finish = r))),
    });

    await pick(user, "Old work");
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));
    await user.click(within(historyPanel()).getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessions.deleteSession).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it("leaves a pane that runs another session alone", async () => {
    const { user } = await folderWithSessions({ deleteSession: vi.fn(async () => Promise.reject("wrong_pane")) });
    await user.click(newSessionButton());
    await within(historyPanel()).findByText("Live work");

    await pick(user, "Live work");
    await user.click(screen.getByRole("button", { name: "Close and move" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Session could not be deleted");
    expect(screen.getByRole("region", { name: "agent-deck · Live work" })).toBeInTheDocument();
  });

  it("removes the pane of a session that had already ended", async () => {
    const { user, sessions } = await folderWithSessions({
      list: vi.fn(async () => ({
        sessions: [
          { id: "s1", title: "Live work", lastActivity: 3 },
          { id: "old", title: "Old work", lastActivity: 2 },
        ],
        unreadable: 0,
      })),
    });
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    act(() => sessions.opened[0].stream.exit(1));

    await pick(user, "Live work");
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", undefined);
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Live work" })).not.toBeInTheDocument());
  });

  it("keeps the session in the history when its pane is closed with Close (SRS-FR-029)", async () => {
    const { user, sessions } = await folderWithSessions({}, [{ id: "s1", title: "Live work", lastActivity: 3 }]);
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await within(historyPanel()).findByText("Live work");

    await closeVia(user);

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    expect(within(historyPanel()).getByText("Live work")).toBeInTheDocument();
  });

  it("closes the pane and moves its session to the Trash with no second question (SRS-FR-101)", async () => {
    const { user, sessions } = await folderWithSessions({}, [{ id: "s1", title: "Live work", lastActivity: 3 }]);
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await within(historyPanel()).findByText("Live work");
    act(() => sessions.opened[0].stream.status({ state: "Running" }));

    await closeVia(user, "Close and move to Trash");

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", "p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    await vi.waitFor(() => expect(within(historyPanel()).queryByText("Live work")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("moves the session of an ended pane to the Trash (SRS-FR-101)", async () => {
    const { user, sessions } = await folderWithSessions();
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    act(() => sessions.opened[0].stream.exit(1));

    await closeVia(user, "Close and move to Trash");

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", undefined);
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
  });

  it("closes the pane but keeps the session when it cannot be moved (SRS-FR-102)", async () => {
    const { user } = await folderWithSessions({ deleteSession: vi.fn(async () => Promise.reject("locked")) }, [{ id: "s1", title: "Live work", lastActivity: 3 }]);
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await within(historyPanel()).findByText("Live work");

    await closeVia(user, "Close and move to Trash");

    expect(await screen.findByRole("alert")).toHaveTextContent("Session could not be deleted");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(within(historyPanel()).getByText("Live work")).toBeInTheDocument();
  });

  it("still closes the pane when a Delete of its session is already running (SRS-FR-101)", async () => {
    let finish: () => void = () => {};
    const { user, sessions } = await folderWithSessions(
      { deleteSession: vi.fn(() => new Promise<void>((r) => (finish = r))) },
      [{ id: "s1", title: "Live work", lastActivity: 3 }],
    );
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await within(historyPanel()).findByText("Live work");
    await pick(user, "Live work");
    await user.click(screen.getByRole("button", { name: "Close and move" }));

    await closeVia(user, "Close and move to Trash");

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(sessions.deleteSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => finish());
  });

  it("treats a session that is no longer on disk as deleted", async () => {
    const ctx = await folderWithSessions();
    vi.mocked(ctx.sessions.deleteSession).mockImplementationOnce(async (_ws, id) => {
      ctx.drop(id);
      throw "not_found";
    });

    await pick(ctx.user, "Old work");
    await ctx.user.click(screen.getByRole("button", { name: "Move to Trash" }));

    await vi.waitFor(() => expect(within(historyPanel()).queryByText("Old work")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Delete selected sessions (1.1, 1.2)", () => {
  type Row = { id: string; title: string; lastActivity: number };

  async function folderWithSessions(over: Partial<FakeSessions> = {}, items = [ws("a", "agent-deck")]) {
    let rows: Row[] = [
      { id: "s-a", title: "Scaffold Tauri app", lastActivity: 3 },
      { id: "s-b", title: "Fix login bug", lastActivity: 2 },
      { id: "s-c", title: "Init repo", lastActivity: 1 },
    ];
    const sessions = fakeSessions({
      titles: ["Live work"],
      list: vi.fn(async (workspaceId: string) => ({ sessions: workspaceId === "a" ? [...rows] : [], unreadable: 0 })),
      deleteSession: vi.fn(async (_ws: string, id: string) => {
        rows = rows.filter((r) => r.id !== id);
      }),
      ...over,
    });
    const ctx = setup(items, sessions);
    await ctx.user.click(await folderList().findByText("agent-deck"));
    await within(historyPanel()).findByText("Scaffold Tauri app");
    return ctx;
  }

  const box = (title: string) => within(historyPanel()).getByRole("checkbox", { name: `Select ${title}` });
  const bar = (name: string | RegExp) => within(historyPanel()).queryByRole("button", { name });

  it("ticks rows into the selection without opening anything (SRS-FR-073, SRS-FR-074)", async () => {
    const { user, sessions } = await folderWithSessions();
    expect(bar(/^Delete selected/)).not.toBeInTheDocument();
    expect(bar("Select all")).not.toBeInTheDocument();

    await user.click(box("Scaffold Tauri app"));
    await user.click(box("Fix login bug"));

    expect(bar("Delete selected (2)")).toBeInTheDocument();
    expect(bar("Select all")).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();

    await user.click(box("Scaffold Tauri app"));
    expect(bar("Delete selected (1)")).toBeInTheDocument();
    await user.click(box("Fix login bug"));
    expect(bar(/^Delete selected/)).not.toBeInTheDocument();
  });

  it("selects every listed session with Select all (SRS-FR-075)", async () => {
    const { user } = await folderWithSessions();
    await user.click(box("Init repo"));

    await user.click(bar("Select all")!);

    expect(bar("Delete selected (3)")).toBeInTheDocument();
    for (const title of ["Scaffold Tauri app", "Fix login bug", "Init repo"]) expect(box(title)).toBeChecked();
  });

  it("empties the selection on a switch of folder and on close (SRS-FR-076)", async () => {
    const { user } = await folderWithSessions({}, [ws("a", "agent-deck"), ws("b", "mokairo")]);
    await user.click(box("Scaffold Tauri app"));
    await user.click(box("Fix login bug"));

    await user.click(folderList().getByText("mokairo"));
    await user.click(folderList().getByText("agent-deck"));
    await within(historyPanel()).findByText("Scaffold Tauri app");
    expect(box("Scaffold Tauri app")).not.toBeChecked();
    expect(bar(/^Delete selected/)).not.toBeInTheDocument();

    await user.click(box("Fix login bug"));
    await user.click(within(historyPanel()).getByRole("button", { name: "Close session history" }));
    await user.click(folderList().getByText("agent-deck"));
    await within(historyPanel()).findByText("Fix login bug");
    expect(box("Fix login bug")).not.toBeChecked();
  });

  it("asks once and Cancel keeps everything (SRS-FR-077)", async () => {
    const { user, sessions } = await folderWithSessions();
    await user.click(box("Init repo"));
    await user.click(bar("Select all")!);

    await user.click(bar("Delete selected (3)")!);

    const dialog = screen.getByRole("dialog", { name: "Move 3 sessions to Trash?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    expect(bar("Delete selected (3)")).toBeInTheDocument();
  });

  it("closes the open one and deletes each selected session in turn (SRS-FR-077, SRS-FR-078)", async () => {
    const { user, sessions } = await folderWithSessions();
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await within(historyPanel()).findByText("Live work");
    await user.click(box("Live work"));
    await user.click(box("Fix login bug"));
    await user.click(box("Init repo"));

    await user.click(bar("Delete selected (3)")!);
    const dialog = screen.getByRole("dialog", { name: "Close 1 open sessions and move 3 sessions to Trash?" });
    await user.click(within(dialog).getByRole("button", { name: "Close and move" }));

    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(3));
    expect(vi.mocked(sessions.deleteSession).mock.calls).toEqual([
      ["a", "s1", "p1"],
      ["a", "s-b", undefined],
      ["a", "s-c", undefined],
    ]);
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Live work" })).not.toBeInTheDocument());
    await vi.waitFor(() => expect(within(historyPanel()).queryByText("Init repo")).not.toBeInTheDocument());
    expect(within(historyPanel()).queryByText("Fix login bug")).not.toBeInTheDocument();
    expect(within(historyPanel()).getByText("Scaffold Tauri app")).toBeInTheDocument();
    expect(bar(/^Delete selected/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deletes one session at a time and takes no other delete meanwhile (SRS-FR-078)", async () => {
    const finish: (() => void)[] = [];
    const { user, sessions } = await folderWithSessions({
      deleteSession: vi.fn(() => new Promise<void>((r) => finish.push(r))),
    });
    await user.click(box("Init repo"));
    await user.click(box("Fix login bug"));
    await user.click(bar("Delete selected (2)")!);
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));

    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(1));
    expect(bar("Delete selected (2)")).toBeDisabled();
    await user.click(within(historyPanel()).getByText("Scaffold Tauri app"));
    await user.click(within(historyPanel()).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => finish[0]());
    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(2));
    await act(async () => finish[1]());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the selection bar below the rows, so ticking moves no row (SRS-FR-074)", async () => {
    const { user } = await folderWithSessions();
    const rowsBefore = within(historyPanel()).getByRole("list", { name: "Session history" });

    await user.click(box("Init repo"));

    const deleteSelected = bar("Delete selected (1)")!;
    expect(rowsBefore.compareDocumentPosition(deleteSelected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rowsBefore.contains(deleteSelected)).toBe(false);
  });

  it("keeps the ones that could not be moved ticked and counts the rest (SRS-FR-079)", async () => {
    let rows = ["s-a", "s-b", "s-c"];
    const { user } = await folderWithSessions({
      deleteSession: vi.fn(async (_ws: string, id: string) => {
        if (id === "s-b") throw "locked";
        rows = rows.filter((r) => r !== id);
      }),
      list: vi.fn(async () => ({
        sessions: [
          { id: "s-a", title: "Scaffold Tauri app", lastActivity: 3 },
          { id: "s-b", title: "Fix login bug", lastActivity: 2 },
          { id: "s-c", title: "Init repo", lastActivity: 1 },
        ].filter((r) => rows.includes(r.id)),
        unreadable: 0,
      })),
    });
    await user.click(box("Init repo"));
    await user.click(bar("Select all")!);

    await user.click(bar("Delete selected (3)")!);
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("2 of 3 sessions deleted");
    await vi.waitFor(() => expect(within(historyPanel()).queryByText("Init repo")).not.toBeInTheDocument());
    expect(box("Fix login bug")).toBeChecked();
    expect(bar("Delete selected (1)")).toBeInTheDocument();
  });
});

describe("Diagnostics report (2.1)", () => {
  afterEach(() => vi.useRealTimers());

  it("reports terminals, title timers and live panes to the diagnostic log every minute", async () => {
    vi.useFakeTimers();
    const diag = { log: vi.fn(async () => {}), report: vi.fn(async () => {}) };
    const sessions = fakeSessions();
    render(<App workspaces={workspacesClient([ws("a", "agent-deck")])} sessions={sessions} createTerminal={() => fakeAdapter()} diag={diag} />);
    const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));
    await settle();
    fireEvent.click(folderList().getByText("agent-deck"));
    fireEvent.click(newSessionButton());
    await settle();

    expect(diag.report).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(diag.report).toHaveBeenLastCalledWith({ terminals: 1, expectedTerminals: 1, titleTimers: 1, livePanes: 1 });

    act(() => sessions.opened[0].stream.exit(1));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(diag.report).toHaveBeenLastCalledWith({ terminals: 1, expectedTerminals: 1, titleTimers: 0, livePanes: 0 });
  });
});

describe("Stashed Sessions (CR-011)", () => {
  const stashList = () => within(sidebar()).getByRole("list", { name: "Stashed sessions" });
  const stashRow = (title: string) => within(stashList()).getByText(title).closest("li")!;
  const stashed = (sessionId: string, title: string, workspaceId = "a", workspaceName = "agent-deck", stashedAt = 1) => ({
    sessionId,
    workspaceId,
    workspaceName,
    title,
    stashedAt,
  });
  const seed = (...rows: ReturnType<typeof stashed>[]) =>
    localStorage.setItem("adStashedSessions", JSON.stringify({ version: 1, sessions: rows }));
  /** A history that still holds these sessions, so the launch check keeps their rows (SRS-FR-112). */
  const onDisk = (...ids: string[]) =>
    vi.fn(async () => ({ sessions: ids.map((id) => ({ id, title: id, lastActivity: 1 })), unreadable: 0 }));
  const stored = () => JSON.parse(localStorage.getItem("adStashedSessions") ?? "null")?.sessions as { sessionId: string }[];

  it("shows No stashed sessions while nothing is stashed (SRS-FR-107)", async () => {
    setup([ws("a", "agent-deck")]);
    expect(await within(stashList()).findByText("No stashed sessions")).toBeInTheDocument();
  });

  it("lists the stashed sessions kept from the last launch, in order, with their folder (SRS-FR-106, SRS-FR-111)", async () => {
    seed(stashed("s2", "Scaffold Tauri app", "a", "agent-deck", 2), stashed("s1", "Fix login bug", "b", "mokairo", 1));
    setup([ws("a", "agent-deck"), ws("b", "mokairo")], fakeSessions({ list: onDisk("s1", "s2") }));
    await folderList().findByText("agent-deck");
    const rows = within(stashList()).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Scaffold Tauri app"),
      expect.stringContaining("Fix login bug"),
    ]);
    expect(within(stashRow("Fix login bug")).getByText("mokairo")).toBeInTheDocument();
    expect(within(sidebar()).getByText("Stashed Sessions · 2")).toBeInTheDocument();
  });

  it("puts Stashed Sessions on its own tint (SRS-NFR-010)", async () => {
    setup([ws("a", "agent-deck")]);
    await folderList().findByText("agent-deck");
    expect(stashList().closest("section")).toHaveClass("bg-section-stash");
  });

  async function openPane(sessions = fakeSessions({ titles: ["Fix login bug"] }), title = "Fix login bug") {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: `agent-deck · ${title}` });
    return { ...ctx, stream: sessions.opened[0].stream };
  }
  const stashButton = () => screen.getByRole("button", { name: "Stash session" });

  it("puts Stash just left of Maximize, before ×, on every pane (SRS-FR-103)", async () => {
    await openPane();
    const header = screen.getByRole("region", { name: "agent-deck · Fix login bug" }).querySelector("header")!;
    const names = within(header)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"))
      .slice(-3);
    expect(names).toEqual(["Stash session", "Maximize pane", "Close pane"]);
    expect(stashButton()).toBeEnabled();
  });

  it("disables Stash while the session has no history yet (SRS-FR-103)", async () => {
    const { user, sessions } = await openPane(fakeSessions({ title: vi.fn(() => new Promise<string>(() => {})) }), "(untitled)");
    expect(stashButton()).toBeDisabled();
    await user.click(stashButton());
    expect(sessions.close).not.toHaveBeenCalled();
    expect(within(stashList()).getByText("No stashed sessions")).toBeInTheDocument();
  });

  it("closes an idle pane without the Close Dialog and stashes its session (SRS-FR-104)", async () => {
    const { user, sessions, stream } = await openPane();
    act(() => stream.status({ state: "Idle" }));
    await user.click(stashButton());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Fix login bug" })).not.toBeInTheDocument());
    expect(sessions.close).toHaveBeenCalledWith("p1");
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    expect(within(stashRow("Fix login bug")).getByText("agent-deck")).toBeInTheDocument();
    expect(stored()).toEqual([expect.objectContaining({ sessionId: "s1", workspaceId: "a", title: "Fix login bug" })]);
  });

  it("does not stash a pane whose close failed", async () => {
    const { user } = await openPane(fakeSessions({ titles: ["Fix login bug"], close: vi.fn(async () => Promise.reject("io")) }));
    await user.click(stashButton());
    await screen.findByText(/Could not close session/);
    expect(screen.getByRole("region", { name: "agent-deck · Fix login bug" })).toBeInTheDocument();
    expect(within(stashList()).getByText("No stashed sessions")).toBeInTheDocument();
  });

  it("asks before stashing a Running pane; Cancel keeps it, Stash stashes it (SRS-FR-105)", async () => {
    const { user, sessions, stream } = await openPane();
    act(() => stream.status({ state: "Running" }));
    await user.click(stashButton());
    const dialog = screen.getByRole("dialog", { name: "Stash “Fix login bug”?" });
    expect(within(dialog).getByText("Session is still running.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(sessions.close).not.toHaveBeenCalled();
    expect(within(stashList()).getByText("No stashed sessions")).toBeInTheDocument();

    await user.click(stashButton());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Stash" }));
    await within(stashList()).findByText("Fix login bug");
    expect(sessions.close).toHaveBeenCalledWith("p1");
  });

  it("asks before stashing a pane whose shell runs a command (SRS-FR-105)", async () => {
    const { user } = await openPane(
      fakeSessions({ titles: ["Fix login bug"], shellActivity: vi.fn(async () => ({ busy: true, command: "npm run dev" })) }),
    );
    await user.click(screen.getByRole("button", { name: "Open shell" }));
    await user.click(stashButton());
    const dialog = await screen.findByRole("dialog", { name: "Stash “Fix login bug”?" });
    expect(within(dialog).getByText("A command is still running in the shell.")).toBeInTheDocument();
  });

  it("resumes a stashed session in a new pane and drops its row (SRS-FR-108, SRS-FR-109)", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ titles: ["Fix login bug"], list: onDisk("old-1") }));
    await user.click(await within(stashList()).findByRole("button", { name: /^Fix login bug/ }));
    expect(await screen.findByRole("region", { name: "agent-deck · Fix login bug" })).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledWith("a", expect.any(Number), expect.any(Number), "old-1");
    expect(within(stashList()).getByText("No stashed sessions")).toBeInTheDocument();
    expect(stored()).toEqual([]);
  });

  it("refuses a Missing folder with Folder not found and keeps the row (SRS-FR-108)", async () => {
    seed(stashed("old-1", "Fix login bug", "b", "mokairo"));
    const { user, sessions } = setup([ws("a", "agent-deck"), ws("b", "mokairo", true)]);
    await folderList().findByText("mokairo");
    await user.click(within(stashList()).getByRole("button", { name: /^Fix login bug/ }));
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();
    expect(within(stashList()).getByText("Fix login bug")).toBeInTheDocument();
  });

  it("refuses a folder no longer in the list with Folder not found and keeps the row", async () => {
    seed(stashed("old-1", "Fix login bug", "gone", "mokairo"));
    const { user, sessions } = setup([ws("a", "agent-deck")]);
    await user.click(await within(stashList()).findByRole("button", { name: /^Fix login bug/ }));
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();
    expect(within(stashRow("Fix login bug")).getByText("mokairo")).toBeInTheDocument();
  });

  it("keeps the row when Claude Code does not start", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ started: false, list: onDisk("old-1") }));
    await user.click(await within(stashList()).findByRole("button", { name: /^Fix login bug/ }));
    await screen.findByText("Claude Code could not be started");
    expect(within(stashList()).getByText("Fix login bug")).toBeInTheDocument();
  });

  it("drops the row when the session is resumed from the Session History Panel (SRS-FR-109)", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const list = vi.fn(async () => ({ sessions: [{ id: "old-1", title: "Fix login bug", lastActivity: 1 }], unreadable: 0 }));
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list, titles: ["Fix login bug"] }));
    await user.click(await folderList().findByText("agent-deck"));
    await user.click(await within(historyPanel()).findByRole("button", { name: /Fix login bug/ }));
    await user.click(within(historyPanel()).getByRole("button", { name: "Resume" }));
    await screen.findByRole("region", { name: "agent-deck · Fix login bug" });
    expect(within(stashList()).getByText("No stashed sessions")).toBeInTheDocument();
  });

  it("drops the row of a session deleted from the Session History Panel (SRS-FR-112)", async () => {
    seed(stashed("old-1", "Fix login bug"));
    let rows = [{ id: "old-1", title: "Fix login bug", lastActivity: 1 }];
    const sessions = fakeSessions({
      list: vi.fn(async () => ({ sessions: [...rows], unreadable: 0 })),
      deleteSession: vi.fn(async () => void (rows = [])),
    });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await user.click(await folderList().findByText("agent-deck"));
    await user.click(await within(historyPanel()).findByRole("button", { name: /Fix login bug/ }));
    await user.click(within(historyPanel()).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));
    await within(stashList()).findByText("No stashed sessions");
  });

  it("keeps the row when the delete fails", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const sessions = fakeSessions({
      list: vi.fn(async () => ({ sessions: [{ id: "old-1", title: "Fix login bug", lastActivity: 1 }], unreadable: 0 })),
      deleteSession: vi.fn(async () => Promise.reject("locked")),
    });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await user.click(await folderList().findByText("agent-deck"));
    await user.click(await within(historyPanel()).findByRole("button", { name: /Fix login bug/ }));
    await user.click(within(historyPanel()).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));
    await screen.findByText("Session could not be deleted");
    expect(within(stashList()).getByText("Fix login bug")).toBeInTheDocument();
  });

  it("drops at launch the rows whose history is gone, asking only folders that can answer (SRS-FR-112)", async () => {
    seed(
      stashed("gone", "Trashed elsewhere", "a"),
      stashed("here", "Still on disk", "a"),
      stashed("far", "In a missing folder", "b", "mokairo"),
    );
    const list = vi.fn(async () => ({ sessions: [{ id: "here", title: "Still on disk", lastActivity: 1 }], unreadable: 0 }));
    setup([ws("a", "agent-deck"), ws("b", "mokairo", true)], fakeSessions({ list }));
    await vi.waitFor(() => expect(within(stashList()).queryByText("Trashed elsewhere")).not.toBeInTheDocument());
    expect(within(stashList()).getByText("Still on disk")).toBeInTheDocument();
    expect(within(stashList()).getByText("In a missing folder")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith("a");
    expect(list).not.toHaveBeenCalledWith("b");
  });

  it("keeps the rows when the launch listing fails", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const list = vi.fn(async () => Promise.reject("io"));
    setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await vi.waitFor(() => expect(list).toHaveBeenCalledWith("a"));
    await act(async () => {});
    expect(within(stashList()).getByText("Fix login bug")).toBeInTheDocument();
  });

  it("removes a row with × without opening it or touching its history (SRS-FR-110)", async () => {
    seed(stashed("s1", "Fix login bug"));
    const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ list: onDisk("s1") }));
    await within(stashList()).findByText("Fix login bug");
    await user.click(within(stashRow("Fix login bug")).getByRole("button", { name: "Remove Fix login bug from stash" }));
    expect(within(stashList()).getByText("No stashed sessions")).toBeInTheDocument();
    expect(stored()).toEqual([]);
    expect(sessions.open).not.toHaveBeenCalled();
    expect(sessions.deleteSession).not.toHaveBeenCalled();
  });
});

describe("Progress tracking (SRS-FR-113, SRS-FR-130)", () => {
  const state = (over: Partial<PaneProgress> = {}): PaneProgress => ({
    tracking: "unset",
    checkpoints: [],
    collapsed: false,
    updating: false,
    failed: false,
    ...over,
  });
  const PROMPT = "Track progress for this session?";

  async function started() {
    const { user, sessions } = setup([ws("a", "agent-deck")]);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    return { user, sessions, stream: sessions.opened[0].stream };
  }

  it("shows nothing about progress before the first message", async () => {
    await started();
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Track progress" })).not.toBeInTheDocument();
  });

  it("asks on a new session, and Track calls the client", async () => {
    const { user, sessions, stream } = await started();
    act(() => stream.progress(state()));
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(sessions.setProgressTracking).toHaveBeenCalledExactlyOnceWith("p1", true);
  });

  it("No calls the client with false", async () => {
    const { user, sessions, stream } = await started();
    act(() => stream.progress(state()));
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(sessions.setProgressTracking).toHaveBeenCalledExactlyOnceWith("p1", false);
  });

  it("does not ask on a resumed session that is off", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const list = vi.fn(async () => ({ sessions: [{ id, title: "Scaffold", lastActivity: 1 }], unreadable: 0 }));
    const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await folderList().findByText("agent-deck"));
    await user.click(await within(historyPanel()).findByRole("button", { name: /Scaffold/ }));
    await user.click(within(historyPanel()).getByRole("button", { name: "Resume" }));
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.progress(state({ tracking: "off" })));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Track progress" })).toHaveAttribute("aria-pressed", "false");
  });

  it("the header button toggles tracking through the client", async () => {
    const { user, sessions, stream } = await started();
    act(() => stream.progress(state({ tracking: "on" })));
    await user.click(screen.getByRole("button", { name: "Track progress" }));
    expect(sessions.setProgressTracking).toHaveBeenLastCalledWith("p1", false);
  });

  it("shows the strip from the stream and passes the collapsed state through", async () => {
    const { user, sessions, stream } = await started();
    const checkpoints = [{ summary: "Read the log", result: "", done: false, startedAt: "09:12" }];
    act(() => stream.progress(state({ tracking: "on", checkpoints })));
    expect(screen.getByText("Progress · 0/1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse progress" }));
    expect(sessions.setProgressCollapsed).toHaveBeenCalledExactlyOnceWith("p1", true);
    act(() => stream.progress(state({ tracking: "on", checkpoints, collapsed: true })));
    expect(screen.getByText("Progress · 0/1 · Read the log")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand progress" }));
    expect(sessions.setProgressCollapsed).toHaveBeenLastCalledWith("p1", false);
  });
});
