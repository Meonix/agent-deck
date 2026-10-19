import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShellActivity } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import App from "./App";
import type { TerminalSize } from "./components/TerminalPane";
import { fakeAdapter, fakeSessions, type FakeAdapter, type FakeSessions } from "./test/fakes";

type User = ReturnType<typeof userEvent.setup>;

function workspacesClient(): WorkspacesClient {
  return {
    list: vi.fn(async () => [{ id: "a", name: "agent-deck", path: "/p/agent-deck", missing: false }]),
    pickFolder: vi.fn(async () => null),
    add: vi.fn(async () => ({ outcome: "added" as const, id: "x" })),
    remove: vi.fn(async () => ({ ok: true as const })),
  };
}

/** `sizes[i]`: what the i-th terminal made fits to. */
function setup(sessions: FakeSessions, sizes: TerminalSize[] = []) {
  const adapters: FakeAdapter[] = [];
  const createTerminal = vi.fn(() => {
    const a = fakeAdapter(sizes[adapters.length]);
    adapters.push(a);
    return a;
  });
  render(<App workspaces={workspacesClient()} sessions={sessions} createTerminal={createTerminal} />);
  return { user: userEvent.setup(), sessions, adapters, createTerminal };
}

const folderRow = () => within(screen.getByRole("list", { name: "Folders" })).getByText("agent-deck");
const newSessionButton = () =>
  within(screen.getByRole("region", { name: "Session history" })).getByRole("button", { name: "New Session" });
const paneAt = (i = 0) => within(screen.getByTestId("pane-grid")).getAllByRole("region")[i];
const chip = (i = 0) => within(paneAt(i)).getByRole("button", { name: /^(Open|Hide|Show) shell$/ });
const marker = (i = 0) => chip(i).querySelector(".bg-primary");
const shellArea = (i = 0) => within(paneAt(i)).queryByRole("separator")?.parentElement ?? null;
const heightOf = (area: HTMLElement | null) => parseFloat(area!.style.height);

async function openPane(sessions = fakeSessions(), sizes: TerminalSize[] = []) {
  const ctx = setup(sessions, sizes);
  await within(await screen.findByRole("list", { name: "Folders" })).findByText("agent-deck");
  await ctx.user.click(folderRow());
  await ctx.user.click(newSessionButton());
  await screen.findByTestId("pane-grid");
  return { ...ctx, session: sessions.opened[0].stream };
}

async function openShell(user: User, i = 0) {
  await user.click(chip(i));
  await vi.waitFor(() => expect(shellArea(i)).not.toBeNull());
}

async function paneWithShell(sessions = fakeSessions()) {
  const ctx = await openPane(sessions);
  await openShell(ctx.user);
  return { ...ctx, shell: sessions.shells[0].stream, shellTerminal: ctx.adapters[1] };
}

afterEach(() => vi.useRealTimers());

describe("Pane Shell chip and toggle (3.1)", () => {
  it("opens a shell for the pane below the session, 30% of the pane high (SRS-FR-055)", async () => {
    const { user, sessions, adapters } = await openPane();
    expect(chip()).toHaveAccessibleName("Open shell");
    expect(chip()).toHaveClass("border-border", "text-muted-foreground");
    expect(chip()).toHaveTextContent(">_Shell");
    expect(shellArea()).toBeNull();

    await openShell(user);

    expect(sessions.openShell).toHaveBeenCalledWith("p1", 80, 24);
    expect(adapters).toHaveLength(2);
    expect(adapters[1].open).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(shellArea()).toHaveClass("border-t", "border-border", "bg-card");
    expect(shellArea()).not.toHaveClass("hidden");
    expect(heightOf(shellArea())).toBeCloseTo(30, 5);
    expect(chip()).toHaveAccessibleName("Hide shell");
    expect(chip()).toHaveClass("border-ring", "bg-accent", "text-accent-foreground");
    act(() => sessions.shells[0].stream.emit("~/agent-deck $ "));
    expect(adapters[1].written).toEqual(["~/agent-deck $ "]);
    expect(adapters[0].written).toEqual([]);
  });

  it("sends typed and binary input to the shell, not to the session (SRS-FR-055)", async () => {
    const { sessions, shellTerminal } = await paneWithShell();
    shellTerminal.type("pwd\r");
    shellTerminal.sendBinary("\x1b[M #!");
    expect(sessions.shellWrite).toHaveBeenNthCalledWith(1, "p1", "pwd\r");
    expect(sessions.shellWrite).toHaveBeenNthCalledWith(2, "p1", "\x1b[M #!");
    expect(sessions.write).not.toHaveBeenCalled();
  });

  it("hides the shell and keeps it running (SRS-FR-056)", async () => {
    const { user, sessions, shell, shellTerminal } = await paneWithShell();
    await user.click(chip());
    expect(shellArea()).toHaveClass("hidden");
    expect(chip()).toHaveAccessibleName("Show shell");
    expect(shellTerminal.dispose).not.toHaveBeenCalled();
    expect(shell.dispose).not.toHaveBeenCalled();
    expect(sessions.close).not.toHaveBeenCalled();
    expect(sessions.openShell).toHaveBeenCalledTimes(1);
  });

  it("shows the shell again with the output written while hidden, at the same height (SRS-FR-057)", async () => {
    const { user, sessions, shell, shellTerminal, createTerminal } = await paneWithShell();
    await user.click(chip());
    act(() => shell.emit("page reload src/App.tsx"));
    await user.click(chip());

    expect(shellArea()).not.toHaveClass("hidden");
    expect(chip()).toHaveAccessibleName("Hide shell");
    expect(heightOf(shellArea())).toBeCloseTo(30, 5);
    expect(shellTerminal.written).toEqual(["page reload src/App.tsx"]);
    expect(createTerminal).toHaveBeenCalledTimes(2);
    expect(sessions.openShell).toHaveBeenCalledTimes(1);
  });

  it("gives the keyboard to the shell when it shows again (SRS-FR-057)", async () => {
    const { user, shellTerminal } = await paneWithShell();
    await user.click(chip());
    vi.mocked(shellTerminal.focus).mockClear();
    await user.click(chip());
    expect(shellTerminal.focus).toHaveBeenCalled();
  });

  it("marks a hidden shell with the command it runs (SRS-FR-058)", async () => {
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => ({ busy: true, command: "npm run dev" })) });
    const { user } = await paneWithShell(sessions);
    await user.click(chip());
    await vi.waitFor(() => expect(chip()).toHaveTextContent("npm run dev"));
    expect(sessions.shellActivity).toHaveBeenCalledWith("p1");
    expect(marker()).not.toBeNull();
    expect(chip()).toHaveClass("border-primary", "text-accent-foreground");
    expect(within(chip()).getByText("npm run dev")).toHaveClass("font-mono", "truncate");
  });

  it("marks a hidden shell at its prompt with Shell, also before the first answer (SRS-FR-058)", async () => {
    let answer: (a: ShellActivity) => void = () => {};
    const sessions = fakeSessions({ shellActivity: vi.fn(() => new Promise<ShellActivity>((r) => (answer = r))) });
    const { user } = await paneWithShell(sessions);
    await user.click(chip());
    expect(marker()).not.toBeNull();
    expect(chip()).toHaveTextContent(/^Shell$/);
    await act(async () => answer({ busy: false, command: null }));
    expect(marker()).not.toBeNull();
    expect(chip()).toHaveTextContent(/^Shell$/);
    expect(within(chip()).getByText("Shell")).not.toHaveClass("font-mono");
  });

  it("shows no marker on a pane without a shell or with a visible shell (SRS-FR-058)", async () => {
    const { user } = await paneWithShell();
    await user.click(newSessionButton());
    await vi.waitFor(() => expect(within(screen.getByTestId("pane-grid")).getAllByRole("region")).toHaveLength(2));
    expect(chip(0)).toHaveAccessibleName("Hide shell");
    expect(chip(1)).toHaveAccessibleName("Open shell");
    expect(marker(0)).toBeNull();
    expect(marker(1)).toBeNull();
  });

  it("asks every second while a shell is hidden and keeps the last answer when a call fails (D6)", async () => {
    vi.useFakeTimers();
    const sessions = fakeSessions();
    vi.mocked(sessions.shellActivity)
      .mockResolvedValueOnce({ busy: true, command: "npm run dev" })
      .mockRejectedValueOnce("not_found")
      .mockResolvedValueOnce({ busy: true, command: "cargo test" });
    setup(sessions);
    const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));
    await settle();
    fireEvent.click(folderRow());
    fireEvent.click(newSessionButton());
    await settle();
    fireEvent.click(chip());
    await settle();
    fireEvent.click(chip());
    await settle();
    expect(chip()).toHaveTextContent("npm run dev");

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(chip()).toHaveTextContent("npm run dev");
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(chip()).toHaveTextContent("cargo test");
    expect(sessions.shellActivity).toHaveBeenCalledTimes(3);

    fireEvent.click(chip());
    await settle();
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(sessions.shellActivity).toHaveBeenCalledTimes(3);
  });
});

describe("Pane Shell divider and refit (3.2)", () => {
  // Pane body 500 px tall from y = 100: the shell starts 150 px high, its divider at y = 450.
  async function draggable(sessions = fakeSessions()) {
    const ctx = await paneWithShell(sessions);
    vi.spyOn(shellArea()!.parentElement!, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 600, 500));
    return { ...ctx, divider: within(paneAt()).getByRole("separator") };
  }

  it("is a horizontal separator with a grip", async () => {
    const { divider } = await draggable();
    expect(divider).toHaveAttribute("aria-orientation", "horizontal");
    expect(divider).toHaveClass("cursor-row-resize");
    expect(divider.firstElementChild).toHaveClass("rounded-full", "bg-border");
  });

  it("makes the shell 100 px taller when the divider moves 100 px up (SRS-FR-059)", async () => {
    const { divider } = await draggable();
    fireEvent.pointerDown(divider, { clientY: 450, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientY: 350, pointerId: 1 });
    fireEvent.pointerUp(divider, { clientY: 350, pointerId: 1 });
    expect(heightOf(shellArea())).toBeCloseTo(50, 5);
  });

  it("stops following the pointer after release", async () => {
    const { divider } = await draggable();
    fireEvent.pointerDown(divider, { clientY: 450, pointerId: 1 });
    fireEvent.pointerUp(divider, { clientY: 450, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientY: 350, pointerId: 1 });
    expect(heightOf(shellArea())).toBeCloseTo(30, 5);
  });

  it("leaves the shell and the session at least 80 px tall", async () => {
    const { divider } = await draggable();
    fireEvent.pointerDown(divider, { clientY: 450, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientY: 595, pointerId: 1 });
    expect(heightOf(shellArea())).toBeCloseTo((80 / 500) * 100, 5);
    fireEvent.pointerMove(divider, { clientY: 105, pointerId: 1 });
    expect(heightOf(shellArea())).toBeCloseTo((420 / 500) * 100, 5);
  });

  it("resizes the shell and the session to their new terminal sizes after a drag (SRS-FR-060)", async () => {
    const { divider, sessions, adapters, shellTerminal } = await draggable();
    shellTerminal.size = { cols: 80, rows: 14 };
    adapters[0].size = { cols: 80, rows: 18 };
    fireEvent.pointerDown(divider, { clientY: 450, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientY: 350, pointerId: 1 });
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 80, 14);
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 80, 18);
  });

  it("keeps the dragged height through a hide and show (SRS-FR-057)", async () => {
    const { divider, user } = await draggable();
    fireEvent.pointerDown(divider, { clientY: 450, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(divider, { clientY: 400, pointerId: 1 });
    await user.click(chip());
    await user.click(chip());
    expect(heightOf(shellArea())).toBeCloseTo(40, 5);
  });

  it("fits the shell when it mounts, resizes it to the fit, and refits the session", async () => {
    const { user, sessions, adapters } = await openPane(fakeSessions(), [{ cols: 80, rows: 24 }, { cols: 120, rows: 9 }]);
    adapters[0].size = { cols: 80, rows: 18 };
    await openShell(user);
    expect(sessions.shellResize).toHaveBeenCalledWith("p1", 120, 9);
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 80, 18);
  });

  it("resizes the shell to the new size on maximize and back on restore (SRS-FR-060)", async () => {
    const { user, sessions, shellTerminal } = await paneWithShell();
    shellTerminal.size = { cols: 200, rows: 15 };
    await user.click(within(paneAt()).getByRole("button", { name: "Maximize pane" }));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 200, 15);

    shellTerminal.size = { cols: 80, rows: 7 };
    await user.click(within(paneAt()).getByRole("button", { name: "Restore pane" }));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 80, 7);
  });

  it("never resizes a hidden shell, and fits it when it shows again", async () => {
    const { user, sessions, adapters, shellTerminal } = await paneWithShell();
    await user.click(chip());
    adapters[0].size = { cols: 80, rows: 30 };
    shellTerminal.size = { cols: 200, rows: 15 };
    await user.click(within(paneAt()).getByRole("button", { name: "Maximize pane" }));
    expect(sessions.shellResize).not.toHaveBeenCalled();
    // The session took the whole pane when the shell hid.
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 80, 30);

    await user.click(chip());
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 200, 15);
  });

  it("refits the session when the shell hides and shows", async () => {
    const { user, sessions, adapters } = await paneWithShell();
    adapters[0].size = { cols: 80, rows: 30 };
    await user.click(chip());
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 80, 30);
    adapters[0].size = { cols: 80, rows: 20 };
    await user.click(chip());
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 80, 20);
  });
});

describe("Pane Shell exit, life after the session, start failure (3.3)", () => {
  it("closes the shell area when the shell exits; the next Shell opens a new one without the old output (SRS-FR-061)", async () => {
    const { user, sessions, adapters, shell, shellTerminal } = await paneWithShell();
    act(() => shell.emit("bye"));
    act(() => shell.exit(0));

    expect(shellArea()).toBeNull();
    expect(chip()).toHaveAccessibleName("Open shell");
    expect(marker()).toBeNull();
    expect(shellTerminal.dispose).toHaveBeenCalled();

    await openShell(user);
    expect(sessions.openShell).toHaveBeenCalledTimes(2);
    expect(adapters).toHaveLength(3);
    expect(adapters[2].written).toEqual([]);
    act(() => sessions.shells[1].stream.emit("~/agent-deck $ "));
    expect(adapters[2].written).toEqual(["~/agent-deck $ "]);
  });

  it("ends the shell with the pane when the session exits normally (SRS-FR-083)", async () => {
    const { sessions, session, shell, shellTerminal } = await paneWithShell();
    act(() => shell.emit("npm run dev"));

    act(() => session.exit(0));

    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(shell.dispose).toHaveBeenCalled();
    expect(shellTerminal.dispose).toHaveBeenCalled();
  });

  it("keeps the shell running and taking input after the session ends abnormally (SRS-FR-064)", async () => {
    const { sessions, session, shellTerminal } = await paneWithShell();
    act(() => session.exit(1));

    expect(within(paneAt()).getByText("Session ended")).toBeInTheDocument();
    expect(shellArea()).not.toBeNull();
    expect(shellTerminal.dispose).not.toHaveBeenCalled();
    shellTerminal.type("ls\r");
    expect(sessions.shellWrite).toHaveBeenCalledWith("p1", "ls\r");
  });

  it("says Shell could not start and leaves the session running when the shell cannot start (SRS-FR-065)", async () => {
    const sessions = fakeSessions({ openShell: vi.fn(async () => Promise.reject("shell_failed")) });
    const { user, adapters, session } = await openPane(sessions);
    act(() => session.status({ state: "Running" }));

    await user.click(chip());

    const strip = await within(paneAt()).findByText("Shell could not start");
    expect(strip.parentElement).toHaveClass("border-error-border", "bg-error-bg", "text-error-foreground");
    expect(adapters[1].dispose).toHaveBeenCalled();
    expect(shellArea()).toBeNull();
    expect(chip()).toHaveAccessibleName("Open shell");
    expect(marker()).toBeNull();
    expect(within(paneAt()).getByText("Running")).toBeInTheDocument();
    expect(adapters[0].dispose).not.toHaveBeenCalled();
    expect(sessions.close).not.toHaveBeenCalled();

    await user.click(within(paneAt()).getByRole("button", { name: "Dismiss" }));
    expect(within(paneAt()).queryByText("Shell could not start")).not.toBeInTheDocument();
  });

  it("ignores a second open that finds the shell already open", async () => {
    const sessions = fakeSessions({ openShell: vi.fn(async () => Promise.reject("already_open")) });
    const { user, adapters } = await openPane(sessions);
    await user.click(chip());
    await vi.waitFor(() => expect(adapters[1].dispose).toHaveBeenCalled());
    expect(within(paneAt()).queryByText("Shell could not start")).not.toBeInTheDocument();
  });

  it("clears the failure once a shell opens", async () => {
    const sessions = fakeSessions();
    const succeed = sessions.openShell;
    sessions.openShell = vi.fn(async () => Promise.reject("shell_failed"));
    const { user } = await openPane(sessions);
    await user.click(chip());
    await within(paneAt()).findByText("Shell could not start");

    sessions.openShell = succeed;
    await openShell(user);
    expect(within(paneAt()).queryByText("Shell could not start")).not.toBeInTheDocument();
  });

  it("drops a shell that finishes opening after its pane closed", async () => {
    let finish: () => void = () => {};
    const sessions = fakeSessions();
    const opened = sessions.openShell;
    sessions.openShell = vi.fn((paneId: string, cols: number, rows: number) =>
      new Promise<Awaited<ReturnType<FakeSessions["openShell"]>>>((resolve) => {
        finish = () => void opened(paneId, cols, rows).then(resolve);
      }),
    );
    const { user, adapters } = await openPane(sessions);
    await user.click(chip());
    await user.click(within(paneAt()).getByRole("button", { name: "Close pane" }));
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());

    await act(async () => finish());

    expect(adapters[1].dispose).toHaveBeenCalled();
    expect(sessions.shells[0].stream.dispose).toHaveBeenCalled();
  });
});

describe("Closing a pane with a shell (3.4)", () => {
  const closeButton = () => within(paneAt()).getByRole("button", { name: "Close pane" });
  const busy = (command: string | null) => vi.fn(async () => ({ busy: true, command }));

  it("ends the shell with its pane: stream and terminal disposed, no separate shell call (SRS-FR-062)", async () => {
    const { user, sessions, shell, shellTerminal } = await paneWithShell();
    await user.click(chip());
    await user.click(closeButton());

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(sessions.close).toHaveBeenCalledWith("p1");
    expect(shell.dispose).toHaveBeenCalled();
    expect(shellTerminal.dispose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before closing a pane whose shell runs a command; Cancel keeps both (SRS-FR-063)", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session, shell, shellTerminal } = await paneWithShell(sessions);
    act(() => session.status({ state: "Idle" }));
    await user.click(chip());

    await user.click(closeButton());

    const dialog = await screen.findByRole("dialog", { name: "A command is still running in the shell. Close anyway?" });
    expect(dialog).toHaveTextContent("npm run dev will be stopped.");
    expect(within(dialog).getByText("npm run dev")).toHaveClass("font-mono");
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass("bg-error");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
    expect(shellArea()).not.toBeNull();
    expect(shell.dispose).not.toHaveBeenCalled();
    expect(shellTerminal.dispose).not.toHaveBeenCalled();
  });

  it("closes the pane after Close in the shell dialog", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says the shell command will be stopped when its name is unknown", async () => {
    const sessions = fakeSessions({ shellActivity: busy(null) });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    expect(await screen.findByRole("dialog")).toHaveTextContent("The shell command will be stopped.");
  });

  it("asks when the shell's activity cannot be read", async () => {
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => Promise.reject("io error")) });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    expect(await screen.findByRole("dialog", { name: "A command is still running in the shell. Close anyway?" })).toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
  });

  it("closes at once when the shell waits at its prompt (SRS-FR-063)", async () => {
    const { user, sessions, session } = await paneWithShell();
    act(() => session.status({ state: "Idle" }));
    await user.click(closeButton());
    await vi.waitFor(() => expect(sessions.close).toHaveBeenCalledWith("p1"));
    expect(sessions.shellActivity).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes at once when the shell is already gone", async () => {
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => Promise.reject("not_found")) });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    await vi.waitFor(() => expect(sessions.close).toHaveBeenCalledWith("p1"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks once when both the session and the shell are busy (SRS-FR-063)", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session } = await paneWithShell(sessions);
    await user.click(chip());
    await vi.waitFor(() => expect(chip()).toHaveTextContent("npm run dev"));
    act(() => session.status({ state: "Running" }));

    await user.click(closeButton());
    await act(async () => {});

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName("Session is still running. Close anyway?");
    expect(dialogs[0]).toHaveTextContent(/agent-deck · .* will be ended and the shell command will be stopped\./);
  });

  it("mentions a visible busy shell in the one dialog of a busy session (SRS-FR-063)", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session } = await paneWithShell(sessions);
    act(() => session.status({ state: "Running" }));

    await user.click(closeButton());
    await act(async () => {});

    expect(sessions.shellActivity).toHaveBeenCalledWith("p1");
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName("Session is still running. Close anyway?");
    expect(dialogs[0]).toHaveTextContent("the shell command will be stopped.");
  });

  it("leaves the shell out of the session dialog when its command has ended since the last poll", async () => {
    let activity: ShellActivity = { busy: true, command: "npm run dev" };
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => activity) });
    const { user, session } = await paneWithShell(sessions);
    await user.click(chip());
    await vi.waitFor(() => expect(chip()).toHaveTextContent("npm run dev"));
    act(() => session.status({ state: "Running" }));
    activity = { busy: false, command: null };

    await user.click(closeButton());
    await act(async () => {});

    const dialog = screen.getByRole("dialog", { name: "Session is still running. Close anyway?" });
    expect(dialog).toHaveTextContent("Fix login will be ended.");
    expect(dialog).not.toHaveTextContent("shell");
  });

  it("keeps the shell dialog open when the session's status changes", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session } = await paneWithShell(sessions);
    await user.click(closeButton());
    await screen.findByRole("dialog");
    act(() => session.status({ state: "Idle" }));
    expect(screen.getByRole("dialog", { name: "A command is still running in the shell. Close anyway?" })).toBeInTheDocument();
  });

  it("counts the shell's terminal in the diagnostic report", async () => {
    vi.useFakeTimers();
    const diag = { log: vi.fn(async () => {}), report: vi.fn(async () => {}) };
    const sessions = fakeSessions();
    render(<App workspaces={workspacesClient()} sessions={sessions} createTerminal={() => fakeAdapter()} diag={diag} />);
    const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));
    await settle();
    fireEvent.click(folderRow());
    fireEvent.click(newSessionButton());
    await settle();
    fireEvent.click(chip());
    await settle();

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(diag.report).toHaveBeenLastCalledWith(expect.objectContaining({ terminals: 2, expectedTerminals: 2 }));
  });
});
