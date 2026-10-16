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
    expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, undefined);
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
    expect(within(board()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(board()).getAllByText("Nothing here")).toHaveLength(3);

    act(() => stream.status({ state: "Error", since, reason: "overloaded" }));
    expect(within(section("Error")).getByText("Scaffold Tauri app")).toBeInTheDocument();
    expect(within(board()).getByRole("button")).toHaveTextContent("agent-deck · 14:02 · overloaded");
  });

  it("removes the card of an Error pane the user closes (M7)", async () => {
    const { user, sessions, stream } = await openPane();
    act(() => stream.status({ state: "Error", since, reason: "overloaded" }));
    expect(within(section("Error")).getByRole("button")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close pane" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(within(board()).queryByRole("button")).not.toBeInTheDocument());
    expect(within(board()).getAllByText("Nothing here")).toHaveLength(3);
  });

  it("keeps the Error card and header chip after an abnormal exit (M7, M1)", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Running", since }));
    act(() => stream.status({ state: "Error", since, reason: "exit code 1" }));
    act(() => stream.exit(1));
    expect(within(section("Error")).getByRole("button")).toHaveTextContent("exit code 1");
    const pane = within(screen.getByTestId("pane-grid"));
    expect(pane.getByText("Error", { selector: "span.border" })).toBeInTheDocument();
    expect(pane.queryByText("Ended", { selector: "span.border" })).not.toBeInTheDocument();
    expect(pane.getByText("Session ended")).toBeInTheDocument();
  });

  it("shows no card for a pane whose session ended normally (M7)", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Running", since }));
    act(() => stream.status({ state: "Ended", since }));
    act(() => stream.exit(0));
    expect(within(board()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(board()).getAllByText("Nothing here")).toHaveLength(3);
    expect(within(screen.getByTestId("pane-grid")).getByText("Ended", { selector: "span.border" })).toBeInTheDocument();
  });

  it("omits the reason part when there is none", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Running", since, reason: null }));
    expect(within(board()).getByRole("button")).toHaveTextContent(/^Scaffold Tauri appagent-deck · 14:02$/);
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

    it("keeps Tab and Shift+Tab inside the dialog (M4)", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      const dialog = within(screen.getByRole("dialog"));
      const cancel = dialog.getByRole("button", { name: "Cancel" });
      const close = dialog.getByRole("button", { name: "Close" });
      expect(cancel).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();
      await user.tab();
      expect(cancel).toHaveFocus();
      await user.tab({ shift: true });
      expect(close).toHaveFocus();
      await user.tab({ shift: true });
      expect(cancel).toHaveFocus();
    });

    it("brings focus back to Cancel when it escapes the dialog (M4)", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      act(() => screen.getByRole("button", { name: "Close pane" }).focus());
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("does not let Escape reach the terminal behind the dialog (M4)", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: "Close pane" }));
      const terminal = panes()[0];
      const reached = vi.fn();
      terminal.addEventListener("keydown", reached);
      const notCancelled = fireEvent.keyDown(terminal, { key: "Escape" });
      expect(notCancelled).toBe(false);
      expect(reached).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

describe("Status latency (2.1, 2.2)", () => {
  afterEach(() => vi.restoreAllMocks());

  async function openPane() {
    const sessions = fakeSessions();
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByTestId("pane-grid");
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  it("records a state change with the time the board committed it", async () => {
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
  const sessionsPanel = () => within(sidebar()).getByRole("list", { name: "Sessions" });
  const rowTexts = () => within(sessionsPanel()).getAllByRole("listitem").map((r) => r.textContent);

  function listing(sessions: { id: string; title: string; lastActivity: number }[], unreadable = 0) {
    return vi.fn(async () => ({ sessions, unreadable }));
  }

  it("asks to select a folder first", async () => {
    setup([ws("a", "agent-deck")]);
    expect(await within(sidebar()).findByText("Select a folder to see its sessions.")).toBeInTheDocument();
  });

  it("lists the folder's sessions newest first with their titles and times", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([
      { id: "b", title: "Scaffold Tauri app", lastActivity: now - 2 * 60_000 },
      { id: "a", title: "Write BRD and SRS", lastActivity: new Date(2026, 9, 15, 9).getTime() },
    ]);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await within(sidebar()).findByText("agent-deck"));
    await within(sidebar()).findByRole("list", { name: "Sessions" });
    expect(rowTexts()).toEqual(["Scaffold Tauri app2 min ago", "Write BRD and SRSYesterday"]);
    expect(list).toHaveBeenCalledWith("a");
    expect(sessionsPanel()).toBeInTheDocument();
  });

  it("reads the list again every time the folder is selected", async () => {
    const list = listing([]);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await within(sidebar()).findByText("agent-deck"));
    await within(sidebar()).findByText("No sessions yet");
    await user.click(within(sidebar()).getByText("agent-deck"));
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("shows how many sessions could not be read", async () => {
    const list = listing([{ id: "a", title: "Init repo", lastActivity: now }], 2);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await user.click(await within(sidebar()).findByText("agent-deck"));
    expect(await within(sidebar()).findByText("2 sessions could not be read")).toBeInTheDocument();
  });

  it("says a missing folder no longer exists and does not read it", async () => {
    const list = listing([]);
    const { user } = setup([ws("m", "gone", true)], fakeSessions({ list }));
    await user.click(await within(sidebar()).findByText("gone"));
    expect(await within(sidebar()).findByText("This folder no longer exists on disk.")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Close pane" }));
    await vi.waitFor(() => expect(rowTexts()).toEqual(["Fix loginJust now", "Init repo1 h ago"]));
  });

  it("drops the Live label once the session in the pane has ended", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([{ id: "s1", title: "Fix login", lastActivity: now }]);
    const sessions = fakeSessions({ list });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    await vi.waitFor(() => expect(rowTexts()).toEqual(["Fix loginLive"]));
    act(() => sessions.opened[0].stream.exit(0));
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
    await user.click(await within(sidebar()).findByText("alpha"));
    await user.click(within(sidebar()).getByText("beta"));
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
  const row = (title: string) => within(sidebar()).getByRole("button", { name: new RegExp(title) });
  const resumeButton = () => within(sidebar()).getByRole("button", { name: "Resume" });

  async function selectRow(user: ReturnType<typeof userEvent.setup>, folder: string, title: string) {
    await user.click(await within(sidebar()).findByText(folder));
    await user.click(await within(sidebar()).findByRole("button", { name: new RegExp(title) }));
  }

  it("offers Resume only on the selected row", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: list() }));
    await user.click(await within(sidebar()).findByText("agent-deck"));
    await within(sidebar()).findByRole("button", { name: /Scaffold/ });
    expect(within(sidebar()).queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
    expect(row("Scaffold")).toHaveAttribute("aria-pressed", "false");
    await user.click(row("Scaffold"));
    expect(row("Scaffold")).toHaveAttribute("aria-pressed", "true");
    expect(resumeButton()).toBeInTheDocument();
    await user.click(row("Write BRD"));
    expect(within(sidebar()).getAllByRole("button", { name: "Resume" })).toHaveLength(1);
  });

  it("clears the selection when another folder is selected", async () => {
    const { user } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list: list() }));
    await selectRow(user, "alpha", "Scaffold");
    expect(resumeButton()).toBeInTheDocument();
    await user.click(within(sidebar()).getByText("beta"));
    await within(sidebar()).findByRole("button", { name: /Scaffold/ });
    expect(within(sidebar()).queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
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
    expect(within(sidebar()).getByRole("list", { name: "Sessions" }).querySelectorAll("li")).toHaveLength(2);
  });

  it("focuses the pane that already holds the session instead of opening another", async () => {
    const sessions = fakeSessions({ list: list(), title: vi.fn(async (id: string) => (id === "p1" ? "Scaffold Tauri app" : "Other")) });
    const { user, adapters } = setup([ws("a", "agent-deck")], sessions);
    await selectRow(user, "agent-deck", "Scaffold");
    await user.click(resumeButton());
    await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });
    await user.click(newSessionButton());
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    const focusedLabel = () => panes().find((p) => p.classList.contains("border-ring"))?.getAttribute("aria-label");
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
  const splitDown = (pane: HTMLElement) => within(pane).getByRole("button", { name: "Split down" });
  const splitRight = (pane: HTMLElement) => within(pane).getByRole("button", { name: "Split right" });

  async function startOne() {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    return ctx;
  }

  it("puts the new session below the pane and focuses it", async () => {
    const { user, sessions, adapters } = await startOne();
    await user.click(splitDown(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(sessions.open).toHaveBeenLastCalledWith("a", 80, 24, undefined);
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 100, 50]);
    expect(rectOf(paneNamed("p2"))).toEqual([0, 50, 100, 50]);
    expect(adapters[1].focus).toHaveBeenCalled();
    expect(paneNamed("p2")).toHaveClass("border-ring");
  });

  it("puts the new session to the right of the pane", async () => {
    const { user } = await startOne();
    await user.click(splitRight(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 50, 100]);
    expect(rectOf(paneNamed("p2"))).toEqual([50, 0, 50, 100]);
  });

  it("splits only the right half when the second pane is split down", async () => {
    const { user } = await startOne();
    await user.click(splitRight(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
    await user.click(splitDown(paneNamed("p2")));
    await screen.findByRole("region", { name: "agent-deck · p3" });
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 50, 100]);
    expect(rectOf(paneNamed("p2"))).toEqual([50, 0, 50, 50]);
    expect(rectOf(paneNamed("p3"))).toEqual([50, 50, 50, 50]);
  });

  it("splits the focused pane to the right from the sidebar", async () => {
    const { user } = await startOne();
    await user.click(splitDown(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
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
    await user.click(splitRight(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
    await user.click(splitDown(paneNamed("p2")));
    await screen.findByRole("region", { name: "agent-deck · p3" });
    expect(vi.mocked(adapters[0].open).mock.calls.length).toBe(before);
    expect(adapters[0].container!.isConnected).toBe(true);
  });

  describe("divider", () => {
    async function twoPanes() {
      const ctx = await startOne();
      await ctx.user.click(splitRight(paneNamed("p1")));
      await screen.findByRole("region", { name: "agent-deck · p2" });
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
      await user.click(splitRight(paneNamed("p1")));
      await screen.findByRole("region", { name: "agent-deck · p2" });
      await user.click(splitRight(paneNamed("p2")));
      await screen.findByRole("region", { name: "agent-deck · p3" });
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
      await user.click(splitDown(paneNamed("p1")));
      await screen.findByRole("region", { name: "agent-deck · p2" });
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
    await user.click(splitRight(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.width).toBe("478px");
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.height).toBe("545px");
    expect(sessions.open).toHaveBeenCalledTimes(2);

    vi.spyOn(paneNamed("p2").querySelector('[data-pane-body="p2"]')!, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 478, 545),
    );
    await user.click(splitDown(paneNamed("p2")));
    await vi.waitFor(() => expect(adapters).toHaveLength(3));
    expect(vi.mocked(adapters[2].open).mock.calls[0][0].style.height).toBe("249px");
  });

  it("refuses to split a pane whose folder is already missing", async () => {
    let items = [ws("a", "agent-deck")];
    const client = workspacesClient([]);
    client.list = vi.fn(async () => [...items]);
    client.pickFolder = vi.fn(async () => "/p/agent-deck");
    const sessions = fakeSessions();
    const user = userEvent.setup();
    render(<App workspaces={client} sessions={sessions} createTerminal={() => fakeAdapter()} />);
    await selectAndStart(user, "agent-deck");
    await screen.findByTestId("pane-grid");

    items = [ws("a", "agent-deck", true)];
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    await vi.waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
    await user.click(splitDown(panes()[0]));

    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledTimes(1);
    expect(panes()).toHaveLength(1);
  });

  it("lets the remaining pane fill the area when its neighbour closes", async () => {
    const { user } = await startOne();
    await user.click(splitRight(paneNamed("p1")));
    await screen.findByRole("region", { name: "agent-deck · p2" });
    await user.click(within(paneNamed("p2")).getByRole("button", { name: "Close pane" }));
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · p2" })).not.toBeInTheDocument());
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 100, 100]);
  });
});

describe("Jump from a Status Board card (1.1)", () => {
  const since = new Date(2026, 9, 16, 14, 2).getTime();
  const askingCard = () => within(board()).getByRole("button", { name: /^agent-deck · .+, Needs Approval$/ });

  async function twoPanesSecondAsking() {
    const ctx = setup([ws("a", "agent-deck")]);
    await selectAndStart(ctx.user, "agent-deck");
    await ctx.user.click(newSessionButton());
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    act(() => ctx.sessions.opened[1].stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    fireEvent.focus(panes()[0]);
    expect(panes()[0]).toHaveClass("border-ring");
    return { ...ctx, focusCalls: vi.mocked(ctx.adapters[1].focus).mock.calls.length };
  }

  // A pane asking for approval shows its status ring instead of the focus ring.
  function expectJumpedToSecond(adapters: FakeAdapter[], focusCalls: number) {
    expect(panes()[0]).not.toHaveClass("border-ring");
    expect(vi.mocked(adapters[1].focus).mock.calls.length).toBe(focusCalls + 1);
  }

  it("focuses the pane of the clicked card and sends the next key to it (SRS-FR-037)", async () => {
    const { user, sessions, adapters, focusCalls } = await twoPanesSecondAsking();

    await user.click(askingCard());

    expectJumpedToSecond(adapters, focusCalls);
    adapters[1].type("1");
    expect(sessions.write).toHaveBeenLastCalledWith("p2", "1");
  });

  it("jumps with Enter and keeps that Enter from reaching the terminal", async () => {
    const { adapters, focusCalls } = await twoPanesSecondAsking();

    const notPrevented = fireEvent.keyDown(askingCard(), { key: "Enter" });

    expect(notPrevented).toBe(false);
    expectJumpedToSecond(adapters, focusCalls);
  });

  it("jumps with Space", async () => {
    const { user, adapters, focusCalls } = await twoPanesSecondAsking();

    askingCard().focus();
    await user.keyboard(" ");

    expectJumpedToSecond(adapters, focusCalls);
  });
});
