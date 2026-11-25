import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShellActivity } from "./api/sessions";
import type { WorkspacesClient } from "./api/workspaces";
import App from "./App";
import type { TerminalSize } from "./components/TerminalPane";
import { fakeAdapter, fakeSessions, type FakeAdapter, type FakeSessions } from "./test/fakes";
import { labels } from "./labels";

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

/** The + on the "agent-deck" row; opens "Folder khác", where the row sits while it has no open session. */
function plusButton(): HTMLElement {
  const sidebar = within(screen.getByRole("complementary", { name: labels.sidebar }));
  const other = sidebar.queryByRole("button", { name: labels.otherFolders(1) });
  if (other?.getAttribute("aria-expanded") === "false") fireEvent.click(other);
  return sidebar.getByRole("button", { name: labels.openChooser("agent-deck") });
}
const newSessionButton = () =>
  within(screen.getByRole("dialog", { name: "agent-deck" })).getByRole("button", { name: labels.newSession });
/** + on "agent-deck", then "Phiên mới". */
async function newSessionIn(user: User) {
  await user.click(await vi.waitFor(plusButton));
  await user.click(newSessionButton());
}
const paneAt = (i = 0) => within(screen.getByTestId("pane-grid")).getAllByRole("region")[i];

async function openPane(sessions = fakeSessions(), sizes: TerminalSize[] = []) {
  const ctx = setup(sessions, sizes);
  await newSessionIn(ctx.user);
  await screen.findByTestId("pane-grid");
  return { ...ctx, session: sessions.opened[0].stream };
}

/** An item of the pane's View Switch; the Shell item may carry " · <command>". */
const viewItem = (name: string, i = 0) =>
  within(within(paneAt(i)).getByRole("group", { name: labels.viewSwitch })).getByRole("button", { name: new RegExp(`^${name}`) });
const shellView = (i = 0) => paneAt(i).querySelector<HTMLElement>("[data-view=shell]");

async function openShell(user: User, i = 0) {
  await user.click(viewItem(labels.views.shell, i));
  await vi.waitFor(() => expect(shellView(i)).not.toBeNull());
}

async function paneWithShell(sessions = fakeSessions()) {
  const ctx = await openPane(sessions);
  await openShell(ctx.user);
  return { ...ctx, shell: sessions.shells[0].stream, shellTerminal: ctx.adapters[1] };
}

afterEach(() => vi.useRealTimers());

describe("Pane Shell input and activity (3.1)", () => {
  it("sends typed and binary input to the shell, not to the session (SRS-FR-055)", async () => {
    const { sessions, shellTerminal } = await paneWithShell();
    shellTerminal.type("pwd\r");
    shellTerminal.sendBinary("\x1b[M #!");
    expect(sessions.shellWrite).toHaveBeenNthCalledWith(1, "p1", "pwd\r");
    expect(sessions.shellWrite).toHaveBeenNthCalledWith(2, "p1", "\x1b[M #!");
    expect(sessions.write).not.toHaveBeenCalled();
  });

  it("gives the keyboard to the shell when it shows again (SRS-FR-057)", async () => {
    const { user, shellTerminal } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    vi.mocked(shellTerminal.focus).mockClear();
    await user.click(viewItem(labels.views.shell));
    expect(shellTerminal.focus).toHaveBeenCalled();
    expect(shellView()).toContainElement(document.activeElement as HTMLElement);
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
    fireEvent.click(plusButton());
    fireEvent.click(newSessionButton());
    await settle();
    fireEvent.click(viewItem(labels.views.shell));
    await settle();
    fireEvent.click(viewItem(labels.views.term));
    await settle();
    expect(viewItem(labels.views.shell)).toHaveTextContent("npm run dev");

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(viewItem(labels.views.shell)).toHaveTextContent("npm run dev");
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(viewItem(labels.views.shell)).toHaveTextContent("cargo test");
    expect(sessions.shellActivity).toHaveBeenCalledTimes(3);

    fireEvent.click(viewItem(labels.views.shell));
    await settle();
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(sessions.shellActivity).toHaveBeenCalledTimes(3);
  });
});

describe("Pane Shell refit (3.2)", () => {
  it("resizes the shell to the new size on maximize and back on restore (SRS-FR-060)", async () => {
    const { user, sessions, shellTerminal } = await paneWithShell();
    shellTerminal.size = { cols: 200, rows: 15 };
    await user.click(within(paneAt()).getByRole("button", { name: labels.maximizePane }));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 200, 15);

    shellTerminal.size = { cols: 80, rows: 7 };
    await user.click(within(paneAt()).getByRole("button", { name: labels.restorePane }));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 80, 7);
  });
});

describe("Pane Shell follows the pane size (SRS-FR-060)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resizes the shown shell when the pane is resized", async () => {
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    const { sessions, shellTerminal } = await paneWithShell();
    shellTerminal.size = { cols: 61, rows: 17 };
    act(() => observers.forEach((cb) => cb()));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 61, 17);
  });
});

describe("Pane Shell exit, life after the session, start failure (3.3)", () => {
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

    expect(within(paneAt()).getByText(labels.sessionEnded)).toBeInTheDocument();
    expect(shellView()).not.toBeNull();
    expect(shellTerminal.dispose).not.toHaveBeenCalled();
    shellTerminal.type("ls\r");
    expect(sessions.shellWrite).toHaveBeenCalledWith("p1", "ls\r");
  });

  it("ignores a second open that finds the shell already open", async () => {
    const sessions = fakeSessions({ openShell: vi.fn(async () => Promise.reject("already_open")) });
    const { user, adapters } = await openPane(sessions);
    await user.click(viewItem(labels.views.shell));
    await vi.waitFor(() => expect(adapters[1].dispose).toHaveBeenCalled());
    expect(within(paneAt()).queryByText(labels.shellFailed)).not.toBeInTheDocument();
  });

  it("clears the failure once a shell opens", async () => {
    const sessions = fakeSessions();
    const succeed = sessions.openShell;
    sessions.openShell = vi.fn(async () => Promise.reject("shell_failed"));
    const { user } = await openPane(sessions);
    await user.click(viewItem(labels.views.shell));
    await within(paneAt()).findByText(labels.shellFailed);

    sessions.openShell = succeed;
    await openShell(user);
    expect(within(paneAt()).queryByText(labels.shellFailed)).not.toBeInTheDocument();
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
    await user.click(viewItem(labels.views.shell));
    await user.click(within(paneAt()).getByRole("button", { name: labels.closePane }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: labels.close }));
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());

    await act(async () => finish());

    expect(adapters[1].dispose).toHaveBeenCalled();
    expect(sessions.shells[0].stream.dispose).toHaveBeenCalled();
  });
});

describe("Closing a pane with a shell (3.4)", () => {
  const closeButton = () => within(paneAt()).getByRole("button", { name: labels.closePane });
  const chooseClose = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(within(screen.getByRole("dialog")).getByRole("button", { name: labels.close }));
  const busy = (command: string | null) => vi.fn(async () => ({ busy: true, command }));
  const SHELL_WARNING = labels.shellBusy;

  it("ends the shell with its pane: stream and terminal disposed, no separate shell call (SRS-FR-062)", async () => {
    const { user, sessions, shell, shellTerminal } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    await user.click(closeButton());
    await chooseClose(user);

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(sessions.close).toHaveBeenCalledWith("p1");
    expect(shell.dispose).toHaveBeenCalled();
    expect(shellTerminal.dispose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns in the Close Dialog that the shell runs a command; Cancel keeps both (SRS-FR-063)", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session, shell, shellTerminal } = await paneWithShell(sessions);
    act(() => session.status({ state: "Idle" }));
    await user.click(viewItem(labels.views.term));

    await user.click(closeButton());

    const dialog = await screen.findByRole("dialog", { name: labels.closeTitle("Fix login") });
    expect(within(dialog).getByText(SHELL_WARNING)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`npm run dev ${labels.commandStops}`);
    expect(within(dialog).getByText("npm run dev")).toHaveClass("font-mono");
    expect(dialog).not.toHaveTextContent(labels.sessionBusy);
    await user.click(within(dialog).getByRole("button", { name: labels.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
    expect(shellView()).not.toBeNull();
    expect(shell.dispose).not.toHaveBeenCalled();
    expect(shellTerminal.dispose).not.toHaveBeenCalled();
  });

  it("closes the pane after Close when the shell is busy", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    await screen.findByRole("dialog");
    await chooseClose(user);
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says the shell command will be stopped when its name is unknown", async () => {
    const sessions = fakeSessions({ shellActivity: busy(null) });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    expect(await screen.findByRole("dialog")).toHaveTextContent(labels.shellCommandStops);
  });

  it("warns when the shell's activity cannot be read", async () => {
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => Promise.reject("io error")) });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    expect(await screen.findByRole("dialog")).toHaveTextContent(SHELL_WARNING);
    expect(sessions.close).not.toHaveBeenCalled();
  });

  it("shows no shell warning when the shell waits at its prompt (SRS-FR-063)", async () => {
    const { user, sessions, session } = await paneWithShell();
    act(() => session.status({ state: "Idle" }));
    await user.click(closeButton());
    const dialog = await screen.findByRole("dialog");
    expect(sessions.shellActivity).toHaveBeenCalledWith("p1");
    expect(dialog).not.toHaveTextContent(SHELL_WARNING);
    expect(sessions.close).not.toHaveBeenCalled();
  });

  it("shows no shell warning when the shell is already gone", async () => {
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => Promise.reject("not_found")) });
    const { user } = await paneWithShell(sessions);
    await user.click(closeButton());
    expect(await screen.findByRole("dialog")).not.toHaveTextContent(SHELL_WARNING);
  });

  it("shows both warnings in one dialog when the session and the shell are busy (SRS-FR-063)", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session } = await paneWithShell(sessions);
    await user.click(viewItem(labels.views.term));
    await vi.waitFor(() => expect(viewItem(labels.views.shell)).toHaveTextContent("npm run dev"));
    act(() => session.status({ state: "Running" }));

    await user.click(closeButton());
    await act(async () => {});

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(within(dialogs[0]).getByText(labels.sessionBusy)).toBeInTheDocument();
    expect(within(dialogs[0]).getByText(SHELL_WARNING)).toBeInTheDocument();
  });

  it("leaves the shell warning out when its command has ended since the last poll", async () => {
    let activity: ShellActivity = { busy: true, command: "npm run dev" };
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => activity) });
    const { user, session } = await paneWithShell(sessions);
    await user.click(viewItem(labels.views.term));
    await vi.waitFor(() => expect(viewItem(labels.views.shell)).toHaveTextContent("npm run dev"));
    act(() => session.status({ state: "Running" }));
    activity = { busy: false, command: null };

    await user.click(closeButton());
    await act(async () => {});

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(labels.sessionBusy)).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("shell");
  });

  it("keeps the shell warning when the session's status changes", async () => {
    const sessions = fakeSessions({ shellActivity: busy("npm run dev") });
    const { user, session } = await paneWithShell(sessions);
    await user.click(closeButton());
    await screen.findByRole("dialog");
    act(() => session.status({ state: "Idle" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(SHELL_WARNING);
  });

  it("counts the shell's terminal in the diagnostic report", async () => {
    vi.useFakeTimers();
    const diag = { log: vi.fn(async () => {}), report: vi.fn(async () => {}) };
    const sessions = fakeSessions();
    render(<App workspaces={workspacesClient()} sessions={sessions} createTerminal={() => fakeAdapter()} diag={diag} />);
    const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));
    await settle();
    fireEvent.click(plusButton());
    fireEvent.click(newSessionButton());
    await settle();
    fireEvent.click(viewItem(labels.views.shell));
    await settle();

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(diag.report).toHaveBeenLastCalledWith(expect.objectContaining({ terminals: 2, expectedTerminals: 2 }));
  });
});

describe("Shell view (CR-016)", () => {
  const termView = (i = 0) => paneAt(i).querySelector<HTMLElement>("[data-view=term]");
  const pressed = (i = 0) =>
    within(within(paneAt(i)).getByRole("group", { name: labels.viewSwitch }))
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  const shellItemText = (i = 0) => viewItem(labels.views.shell, i).textContent;
  const hidden = (layer: HTMLElement | null) => layer !== null && layer.classList.contains("invisible") && layer.hasAttribute("inert");

  it("opens one shell at 80×24 and shows it over the whole pane body with the keyboard in it (SRS-FR-055)", async () => {
    const { sessions, shellTerminal } = await paneWithShell();
    expect(sessions.openShell).toHaveBeenCalledTimes(1);
    expect(sessions.openShell).toHaveBeenCalledWith("p1", 80, 24);
    expect(shellView()).toHaveClass("absolute", "inset-0");
    expect(hidden(shellView())).toBe(false);
    expect(within(paneAt()).queryByRole("separator")).toBeNull();
    expect(hidden(termView())).toBe(true);
    expect(pressed()).toEqual([labels.views.shell]);
    expect(shellTerminal.container).toContainElement(document.activeElement as HTMLElement);
  });

  it("stays on Term while the shell is starting (SRS-FR-055)", async () => {
    let finish: () => void = () => {};
    const sessions = fakeSessions();
    const opened = sessions.openShell;
    sessions.openShell = vi.fn((paneId: string, cols: number, rows: number) =>
      new Promise<Awaited<ReturnType<FakeSessions["openShell"]>>>((resolve) => {
        finish = () => void opened(paneId, cols, rows).then(resolve);
      }),
    );
    const { user } = await openPane(sessions);
    await user.click(viewItem(labels.views.shell));
    expect(pressed()).toEqual([labels.views.term]);
    expect(shellView()).toBeNull();
    expect(hidden(termView())).toBe(false);

    await act(async () => finish());
    expect(pressed()).toEqual([labels.views.shell]);
  });

  it("stays on Term when Term is chosen while the shell is starting, keeping the shell hidden", async () => {
    let finish: () => void = () => {};
    const sessions = fakeSessions();
    const opened = sessions.openShell;
    sessions.openShell = vi.fn((paneId: string, cols: number, rows: number) =>
      new Promise<Awaited<ReturnType<FakeSessions["openShell"]>>>((resolve) => {
        finish = () => void opened(paneId, cols, rows).then(resolve);
      }),
    );
    const { user, adapters } = await openPane(sessions);
    await user.click(viewItem(labels.views.shell));
    await user.click(viewItem(labels.views.term));

    await act(async () => finish());
    expect(pressed()).toEqual([labels.views.term]);
    expect(hidden(shellView())).toBe(true);
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);

    await user.click(viewItem(labels.views.shell));
    expect(pressed()).toEqual([labels.views.shell]);
    expect(sessions.openShell).toHaveBeenCalledTimes(1);
  });

  it("hides the shell on Term and keeps it running (SRS-FR-056, SRS-FR-148)", async () => {
    const { user, sessions, shell, shellTerminal, adapters } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    expect(pressed()).toEqual([labels.views.term]);
    expect(hidden(shellView())).toBe(true);
    expect(hidden(termView())).toBe(false);
    expect(shell.dispose).not.toHaveBeenCalled();
    expect(shellTerminal.dispose).not.toHaveBeenCalled();
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);

    await user.click(viewItem(labels.views.shell));
    expect(sessions.openShell).toHaveBeenCalledTimes(1);
  });

  it("shows the output written while the shell was hidden (SRS-FR-057)", async () => {
    const { user, shell, shellTerminal } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    act(() => shell.emit("page reload src/App.tsx"));
    await user.click(viewItem(labels.views.shell));
    expect(hidden(shellView())).toBe(false);
    expect(shellTerminal.written).toEqual(["page reload src/App.tsx"]);
  });

  it("keeps the session's output and process while Shell is shown (SRS-FR-148)", async () => {
    const { user, sessions, session, adapters } = await paneWithShell();
    act(() => session.status({ state: "Running" }));
    act(() => session.emit("Compiling…"));
    await user.click(viewItem(labels.views.term));
    expect(adapters[0].written).toEqual(["Compiling…"]);
    expect(adapters[0].dispose).not.toHaveBeenCalled();
    expect(sessions.close).not.toHaveBeenCalled();
    expect(within(paneAt()).getByText(labels.state["Running"])).toBeInTheDocument();
  });

  it("names the command of a hidden busy shell on the Shell item (SRS-FR-058)", async () => {
    const sessions = fakeSessions({ shellActivity: vi.fn(async () => ({ busy: true, command: "npm run dev" })) });
    const { user } = await paneWithShell(sessions);
    expect(shellItemText()).toBe(labels.views.shell);
    await user.click(viewItem(labels.views.term));
    await vi.waitFor(() => expect(shellItemText()).toBe(labels.shellRunning("npm run dev").join(" ")));
    expect(sessions.shellActivity).toHaveBeenCalledWith("p1");

    await user.click(viewItem(labels.views.shell));
    expect(shellItemText()).toBe(labels.views.shell);
  });

  it("forgets the last command when Shell is shown, so the next hide reads Shell until a new answer (SRS-FR-058)", async () => {
    const sessions = fakeSessions();
    vi.mocked(sessions.shellActivity)
      .mockResolvedValueOnce({ busy: true, command: "npm run dev" })
      .mockReturnValue(new Promise<ShellActivity>(() => {}));
    const { user } = await paneWithShell(sessions);
    await user.click(viewItem(labels.views.term));
    await vi.waitFor(() => expect(shellItemText()).toBe(labels.shellRunning("npm run dev").join(" ")));
    await user.click(viewItem(labels.views.shell));
    await user.click(viewItem(labels.views.term));
    expect(shellItemText()).toBe(labels.views.shell);
  });

  it("reads Shell for a hidden shell at its prompt, also before the first answer, and with no shell (SRS-FR-058)", async () => {
    let answer: (a: ShellActivity) => void = () => {};
    const sessions = fakeSessions({ shellActivity: vi.fn(() => new Promise<ShellActivity>((r) => (answer = r))) });
    const { user } = await openPane(sessions);
    expect(shellItemText()).toBe(labels.views.shell);
    await openShell(user);
    await user.click(viewItem(labels.views.term));
    expect(shellItemText()).toBe(labels.views.shell);
    await act(async () => answer({ busy: false, command: null }));
    expect(shellItemText()).toBe(labels.views.shell);
  });

  it("fits the shell when it mounts and resizes it to the fit (SRS-FR-060)", async () => {
    const { user, sessions } = await openPane(fakeSessions(), [{ cols: 80, rows: 24 }, { cols: 120, rows: 9 }]);
    await openShell(user);
    expect(sessions.shellResize).toHaveBeenCalledWith("p1", 120, 9);
  });

  it("resizes the hidden session on a maximize while Shell is shown", async () => {
    const { user, sessions, adapters } = await paneWithShell();
    adapters[0].size = { cols: 200, rows: 50 };
    await user.click(within(paneAt()).getByRole("button", { name: labels.maximizePane }));
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 200, 50);
  });

  it("resizes the hidden shell on a maximize while Term is shown (SRS-FR-060)", async () => {
    const { user, sessions, shellTerminal } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    shellTerminal.size = { cols: 200, rows: 50 };
    await user.click(within(paneAt()).getByRole("button", { name: labels.maximizePane }));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 200, 50);
  });

  it("refits the terminal of the view it shows", async () => {
    const { user, sessions, adapters, shellTerminal } = await paneWithShell();
    adapters[0].size = { cols: 90, rows: 30 };
    await user.click(viewItem(labels.views.term));
    expect(sessions.resize).toHaveBeenLastCalledWith("p1", 90, 30);
    shellTerminal.size = { cols: 90, rows: 31 };
    await user.click(viewItem(labels.views.shell));
    expect(sessions.shellResize).toHaveBeenLastCalledWith("p1", 90, 31);
  });

  it("returns to Term when the shown shell exits; the next Shell opens a new one without the old output (SRS-FR-061)", async () => {
    const { user, sessions, adapters, shell, shellTerminal } = await paneWithShell();
    act(() => shell.emit("bye"));
    act(() => shell.exit(0));

    expect(pressed()).toEqual([labels.views.term]);
    expect(shellItemText()).toBe(labels.views.shell);
    expect(shellView()).toBeNull();
    expect(hidden(termView())).toBe(false);
    expect(shellTerminal.dispose).toHaveBeenCalled();

    await openShell(user);
    expect(sessions.openShell).toHaveBeenCalledTimes(2);
    expect(adapters).toHaveLength(3);
    expect(adapters[2].written).toEqual([]);
  });

  it("stays on Term when a hidden shell exits (SRS-FR-061)", async () => {
    const { user, shell } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    act(() => shell.exit(null));
    expect(pressed()).toEqual([labels.views.term]);
    expect(shellView()).toBeNull();
    expect(shellItemText()).toBe(labels.views.shell);
  });

  it("stays on Term with the session running when the shell cannot start (SRS-FR-065)", async () => {
    const sessions = fakeSessions({ openShell: vi.fn(async () => Promise.reject("shell_failed")) });
    const { user, adapters, session } = await openPane(sessions);
    act(() => session.status({ state: "Running" }));

    await user.click(viewItem(labels.views.shell));

    const strip = await within(paneAt()).findByText(labels.shellFailed);
    expect(strip.parentElement).toHaveClass("callout-err");
    expect(adapters[1].dispose).toHaveBeenCalled();
    expect(pressed()).toEqual([labels.views.term]);
    expect(shellView()).toBeNull();
    expect(shellItemText()).toBe(labels.views.shell);
    expect(within(paneAt()).getByText(labels.state["Running"])).toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();

    await user.click(within(paneAt()).getByRole("button", { name: labels.dismiss }));
    expect(within(paneAt()).queryByText(labels.shellFailed)).not.toBeInTheDocument();
  });

  it("shows Session ended in Term after a crash and keeps the hidden shell taking input (SRS-FR-064)", async () => {
    const { user, sessions, session, shellTerminal } = await paneWithShell();
    await user.click(viewItem(labels.views.term));
    act(() => session.exit(1));

    expect(within(termView()!).getByText(labels.sessionEnded)).toBeInTheDocument();
    await user.click(viewItem(labels.views.shell));
    expect(hidden(shellView())).toBe(false);
    shellTerminal.type("ls\r");
    expect(sessions.shellWrite).toHaveBeenCalledWith("p1", "ls\r");
  });
});
