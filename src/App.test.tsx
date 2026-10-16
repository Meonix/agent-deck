import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Workspace, WorkspacesClient } from "./api/workspaces";
import App from "./App";
import type { TerminalSize } from "./components/TerminalPane";
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

function setup(items: Workspace[], sessions: FakeSessions = fakeSessions(), size?: TerminalSize) {
  const adapters: FakeAdapter[] = [];
  const createTerminal = vi.fn(() => {
    const a = fakeAdapter(size);
    adapters.push(a);
    return a;
  });
  render(<App workspaces={workspacesClient(items)} sessions={sessions} createTerminal={createTerminal} />);
  return { user: userEvent.setup(), sessions, adapters, createTerminal };
}

const sidebar = () => screen.getByRole("complementary", { name: "Workspaces" });
const board = () => screen.getByRole("complementary", { name: "Status Board" });
const newSessionButton = () => within(sidebar()).getByRole("button", { name: "New Session" });
const panes = () => within(screen.getByTestId("pane-grid")).getAllByRole("region");

async function selectAndStart(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(sidebar()).findByText(name));
  await user.click(newSessionButton());
}

describe("New Session (5.4)", () => {
  it("is disabled until a folder is selected", async () => {
    const { user } = setup([ws("a", "agent-deck")]);
    await within(sidebar()).findByText("agent-deck");
    expect(newSessionButton()).toBeDisabled();
    await user.click(within(sidebar()).getByText("agent-deck"));
    expect(newSessionButton()).toBeEnabled();
  });

  it("shows No open sessions while a folder exists but no pane is open", async () => {
    setup([ws("a", "agent-deck")]);
    expect(await screen.findByText("No open sessions")).toBeInTheDocument();
    expect(screen.getByText("Resume a session from the list, or start a new one.")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("button", { name: "New Session" })).toBeInTheDocument();
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
    expect(sessions.open).toHaveBeenCalledWith("a", 80, 24);
    expect(adapters[0].focus).toHaveBeenCalled();
    expect(screen.queryByText("No open sessions")).not.toBeInTheDocument();
  });

  it("starts from the empty state button too", async () => {
    const { user, sessions } = setup([ws("a", "agent-deck")]);
    await user.click(await within(sidebar()).findByText("agent-deck"));
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "New Session" }));
    await screen.findByTestId("pane-grid");
    expect(sessions.open).toHaveBeenCalledTimes(1);
  });

  it("puts each new pane right of the focused one and focuses it", async () => {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const { user } = setup([ws("a", "agent-deck")], sessions);
    const labels = () => panes().map((p) => p.getAttribute("aria-label"));
    await selectAndStart(user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(labels()).toEqual(["agent-deck · p1", "agent-deck · p2"]);
    expect(screen.getByTestId("pane-grid").style.gridTemplateColumns).toBe("repeat(2, minmax(0,1fr))");

    act(() => panes()[0].dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
    await user.click(newSessionButton());
    await screen.findByRole("region", { name: "agent-deck · p3" });
    expect(labels()).toEqual(["agent-deck · p1", "agent-deck · p3", "agent-deck · p2"]);
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

    expect(sessions.open).toHaveBeenCalledWith("a", 132, 40);
    const [first] = adapters;
    const probe = vi.mocked(first.open).mock.calls[0][0];
    expect([probe.style.width, probe.style.height]).toEqual(["974px", "545px"]);
    expect(probe.isConnected).toBe(false);
    expect(vi.mocked(first.fit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sessions.open).mock.invocationCallOrder[0],
    );
    expect(first.container).not.toBe(probe);
    expect(sessions.resize).not.toHaveBeenCalled();

    await user.click(newSessionButton());
    await vi.waitFor(() => expect(adapters).toHaveLength(2));
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.width).toBe("478px");
  });

  it("keeps earlier output and shows Session ended when the session exits", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.emit("Done."));
    act(() => sessions.opened[0].stream.exit(0));
    expect(screen.getByText("Session ended")).toBeInTheDocument();
    expect(adapters[0].written).toEqual(["Done."]);
    expect(adapters[0].dispose).not.toHaveBeenCalled();
    adapters[0].type("x");
    expect(sessions.write).not.toHaveBeenCalled();
  });

  it("closes the pane through the client and removes it", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    await user.click(screen.getByRole("button", { name: "Close pane" }));
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(adapters[0].dispose).toHaveBeenCalled();
    expect(sessions.opened[0].stream.dispose).toHaveBeenCalled();
    expect(screen.getByText("No open sessions")).toBeInTheDocument();
  });
});

describe("Status Board and pane state (4.2 to 4.4)", () => {
  afterEach(() => vi.useRealTimers());

  const section = (name: string) => within(board()).getByText(name).closest("div")!.parentElement!;
  const since = new Date(2026, 9, 16, 14, 2).getTime();

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
    fireEvent.click(within(sidebar()).getByText("agent-deck"));
    fireEvent.click(newSessionButton());
    await settle();
    return { stream: sessions.opened[0].stream };
  }

  it("shows three empty sections when no pane is open", async () => {
    setup([ws("a", "agent-deck")]);
    await within(sidebar()).findByText("agent-deck");
    expect(within(board()).getByText("Status Board")).toBeInTheDocument();
    const names = within(board()).getAllByText(/^(Needs Approval|Error|Running)$/).map((n) => n.textContent);
    expect(names).toEqual(["Needs Approval", "Error", "Running"]);
    expect(within(board()).getAllByText("Nothing here")).toHaveLength(3);
  });

  it("follows a pane through Needs Approval, Idle and Error", async () => {
    const { stream } = await openPane();
    await vi.waitFor(() => expect(screen.getAllByText("Scaffold Tauri app").length).toBeGreaterThan(0));
    act(() => stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    expect(within(section("Needs Approval")).getByText("Scaffold Tauri app")).toBeInTheDocument();
    expect(within(board()).getByText(/agent-deck · 14:02 ·/)).toHaveTextContent("agent-deck · 14:02 · Edit src/main.rs");
    expect(within(board()).getAllByText("Nothing here")).toHaveLength(2);

    act(() => stream.status({ state: "Idle", since }));
    expect(within(board()).queryByRole("article")).not.toBeInTheDocument();
    expect(within(board()).getAllByText("Nothing here")).toHaveLength(3);

    act(() => stream.status({ state: "Error", since, reason: "overloaded" }));
    expect(within(section("Error")).getByText("Scaffold Tauri app")).toBeInTheDocument();
    expect(within(board()).getByRole("article")).toHaveTextContent("agent-deck · 14:02 · overloaded");
  });

  it("omits the reason part when there is none", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Running", since, reason: null }));
    expect(within(board()).getByRole("article")).toHaveTextContent(/^Scaffold Tauri appagent-deck · 14:02$/);
  });

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

  it("shows the session title in the pane header and on the card", async () => {
    const { stream } = await openPane(fakeSessions({ titles: ["Fix login"] }));
    await screen.findByRole("region", { name: "agent-deck · Fix login" });
    act(() => stream.status({ state: "Running" }));
    expect(within(board()).getByText("Fix login")).toBeInTheDocument();
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
    act(() => stream.exit(0));
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
    expect(sessions.close).toHaveBeenCalled();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
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

  describe("confirm close", () => {
    it("dismisses the dialog when the pane stops being busy", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      act(() => stream.status({ state: "Idle" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("dismisses the dialog when the session ends", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Needs Approval" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      act(() => stream.exit(0));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("cancels on Escape even after focus left the dialog", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      (document.activeElement as HTMLElement).blur();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("asks before closing a Running pane; Cancel keeps it", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(within(dialog).getByText("Session is still running. Close anyway?")).toBeInTheDocument();
      expect(within(dialog).getByText(/agent-deck · .* will be ended\./)).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
      expect(screen.getByTestId("pane-grid")).toBeInTheDocument();
    });

    it("closes the pane after Close", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Needs Approval", reason: "Edit a" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
      expect(sessions.close).toHaveBeenCalledWith("p1");
      await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("cancels on Escape", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("closes an Idle pane at once", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Idle" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).toHaveBeenCalledWith("p1");
    });

    it("closes an untracked pane at once", async () => {
      const { user, sessions } = await openPane();
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).toHaveBeenCalledWith("p1");
    });
  });
});
