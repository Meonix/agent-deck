import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Workspace, WorkspacesClient } from "./api/workspaces";
import type { ZoomClient } from "./api/zoom";
import App from "./App";
import type { PaneStatus } from "./api/sessions";
import type { ChatItem, ToolDetail } from "./components/chatState";
import type { ScreenLine, TerminalSize } from "./components/TerminalPane";
import { readSnapshot, writeSnapshot, type Snapshot } from "./components/paneSnapshot";
import * as claude from "./components/fixtures/claude-screens";
import type { CountTone } from "./components/statusHighlight";
import { fakeAdapter, fakeSessions, type FakeAdapter, type FakeSessions } from "./test/fakes";
import { labels } from "./labels";

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

const sidebar = () => screen.getByRole("complementary", { name: labels.sidebar });
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OTHER_FOLDERS = new RegExp(`^${escapeRe(labels.otherFolders(0)).replace("0", "\\d+")}$`);
/** The "Folder khác (<n>)" toggle, or null while the group is absent. */
const otherFolders = () => within(sidebar()).queryByRole("button", { name: OTHER_FOLDERS });
/** The name button of a workspace row in the Folder Tree; opens "Folder khác" when the workspace is folded away in it. */
function workspaceName(name: string): HTMLElement {
  const find = () => within(sidebar()).queryByRole("button", { name: new RegExp(`^${escapeRe(name)}\\s*(${labels.missing})?$`) });
  const toggle = otherFolders();
  if (!find() && toggle?.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
  const button = find();
  if (!button) throw new Error(`no workspace row ${name}`);
  return button;
}
const findWorkspace = (name: string) => vi.waitFor(() => workspaceName(name));
/** A workspace row with the Session Rows nested under it. */
const workspaceRow = (name: string) => workspaceName(name).closest("li")!;
/** A Session Row of the Folder Tree. */
const sessionRow = (title: string) => within(sidebar()).getByText(title).closest("li")!;
/** The + on a workspace row, which opens its Session Chooser. */
const plusOf = (name: string) => {
  workspaceName(name);
  return within(sidebar()).getByRole("button", { name: labels.openChooser(name) });
};
/** The open Session Chooser, named after its workspace. */
const chooser = (name = "agent-deck") => screen.getByRole("dialog", { name });
/** The list of old sessions in the open Session Chooser. */
const chooserList = (name = "agent-deck") => within(chooser(name)).getByRole("list", { name: labels.oldSessions });
const chooserRow = (title: string, name = "agent-deck") => within(chooser(name)).getByText(title).closest("li")!;
const panes = () => within(screen.getByTestId("pane-grid")).getAllByRole("region");
/** An item of the pane's View Switch; the Shell item may carry " · <command>". */
const viewItem = (pane: HTMLElement, name: string) =>
  within(within(pane).getByRole("group", { name: labels.viewSwitch })).getByRole("button", { name: new RegExp(`^${name}`) });
/** The Composer of a pane, which has the keyboard while the pane shows Chat (SRS-FR-147). */
const composerOf = (pane: HTMLElement) => within(pane).getByRole("textbox", { name: labels.composerLabel });
const GRID = new DOMRect(0, 0, 1200, 800);
/** The Term layer of the only pane, which holds the Session ended note. */
const termLayer = () => document.querySelector<HTMLElement>("[data-view=term]")!;
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


async function openChooser(user: ReturnType<typeof userEvent.setup>, name = "agent-deck") {
  await user.click(await vi.waitFor(() => plusOf(name)));
  return chooser(name);
}

async function closeChooser(user: ReturnType<typeof userEvent.setup>, name = "agent-deck") {
  await user.click(within(chooser(name)).getByRole("button", { name: labels.close }));
}

/** + on the workspace row, then "Phiên mới". */
async function newSessionIn(user: ReturnType<typeof userEvent.setup>, name = "agent-deck") {
  const dialog = await openChooser(user, name);
  await user.click(within(dialog).getByRole("button", { name: labels.newSession }));
}

/** × on the pane (the only one, or `pane`), then `choice` in its Close Dialog. */
async function closeVia(user: ReturnType<typeof userEvent.setup>, choice = labels.close, pane?: HTMLElement) {
  await user.click((pane ? within(pane) : screen).getByRole("button", { name: labels.closePane }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: choice }));
}

describe("New Session (5.4)", () => {
  it("refuses a missing folder with Folder not found and does not open", async () => {
    const { user, sessions } = setup([ws("m", "gone", true)]);
    await newSessionIn(user, "gone");
    expect(await screen.findByText(labels.folderNotFound)).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();
  });

  it("shows Folder not found when the backend reports the folder missing", async () => {
    const sessions = fakeSessions({ open: vi.fn(async () => Promise.reject("folder_missing")) });
    const { user, adapters } = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(user, "agent-deck");
    expect(await screen.findByText(labels.folderNotFound)).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].dispose).toHaveBeenCalled();
  });

  it("opens a pane titled after the folder, focuses it, then shows the session title", async () => {
    let resolveTitle: (t: string) => void = () => {};
    const sessions = fakeSessions({ title: vi.fn(() => new Promise<string>((r) => (resolveTitle = r))) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(user, "agent-deck");
    expect(await screen.findByRole("region", { name: `agent-deck · ${labels.title("(untitled)")}` })).toBeInTheDocument();
    await act(async () => resolveTitle("Fix login"));
    expect(screen.getByRole("region", { name: "agent-deck · Fix login" })).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, undefined);
    expect(composerOf(panes()[0])).toHaveFocus();
    expect(screen.queryByText(labels.noPanes)).not.toBeInTheDocument();
  });

  it("puts each new pane right of the focused one and focuses it", async () => {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const { user } = setup([ws("a", "agent-deck")], sessions);
    const lefts = () => panes().map((p) => [p.getAttribute("aria-label"), parseFloat(p.parentElement!.style.left)]);
    await newSessionIn(user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await newSessionIn(user);
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(lefts()).toEqual([["agent-deck · p1", 0], ["agent-deck · p2", 50]]);

    act(() => panes()[0].dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
    await newSessionIn(user);
    await screen.findByRole("region", { name: "agent-deck · p3" });
    expect(lefts()).toEqual([["agent-deck · p1", 0], ["agent-deck · p2", 50], ["agent-deck · p3", 25]]);
  });

  it("writes session output into the terminal", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await newSessionIn(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.emit("hello"));
    expect(adapters[0].written).toEqual(["hello"]);
  });

  it("shows the start failure without a terminal when Claude Code did not start", async () => {
    const { user, adapters } = setup([ws("a", "agent-deck")], fakeSessions({ started: false }));
    await newSessionIn(user, "agent-deck");
    expect(await screen.findAllByText(labels.startFailed)).toHaveLength(2);
    // The terminal made to measure the pane is not kept.
    expect(adapters).toHaveLength(1);
    expect(adapters[0].dispose).toHaveBeenCalled();
  });

  it("opens the session at the size its pane will have (M1)", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")], fakeSessions(), { cols: 132, rows: 40 });
    vi.spyOn(screen.getByRole("main"), "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 600));
    await newSessionIn(user, "agent-deck");
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
    await newSessionIn(user);
    await vi.waitFor(() => expect(adapters).toHaveLength(2));
    expect(vi.mocked(adapters[1].open).mock.calls[0][0].style.width).toBe("478px");
  });

  it("keeps earlier output and shows Session ended when the session exits", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await newSessionIn(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.emit("Done."));
    act(() => sessions.opened[0].stream.exit(1));
    expect(within(termLayer()).getByText(labels.sessionEnded)).toBeInTheDocument();
    expect(adapters[0].written).toEqual(["Done."]);
    expect(adapters[0].dispose).not.toHaveBeenCalled();
    adapters[0].type("x");
    expect(sessions.write).not.toHaveBeenCalled();
  });

  it("closes the pane through the client after Close and removes it (SRS-FR-029)", async () => {
    const { user, sessions, adapters } = setup([ws("a", "agent-deck")]);
    await newSessionIn(user, "agent-deck");
    await screen.findByTestId("pane-grid");
    await closeVia(user);
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(adapters[0].dispose).toHaveBeenCalled();
    expect(sessions.opened[0].stream.dispose).toHaveBeenCalled();
    expect(screen.getByText(labels.noPanes)).toBeInTheDocument();
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
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    for (let n = 2; n <= count; n++) {
      await newSessionIn(ctx.user);
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
    expect(screen.queryByText(labels.sessionEnded)).not.toBeInTheDocument();
    expect(rectOf("p1")).toEqual([0, 0, 50, 100]);
    expect(rectOf("p3")).toEqual([50, 0, 50, 100]);
    expect(sessions.opened[1].stream.dispose).toHaveBeenCalled();
  });

  it("leaves an empty pane area when the only pane exits (SRS-FR-083)", async () => {
    const { sessions } = await startPanes(1);
    act(() => sessions.opened[0].stream.exit(0));
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.getByText(labels.noPanes)).toBeInTheDocument();
  });

  it("shows the layout again when the maximized pane exits (SRS-FR-083)", async () => {
    const { user, sessions } = await startPanes(2);
    await user.click(within(paneNamed("p1")!).getByRole("button", { name: labels.maximizePane }));

    act(() => sessions.opened[0].stream.exit(0));

    await vi.waitFor(() => expect(paneNamed("p1")).toBeNull());
    expect(paneNamed("p2")!.parentElement).not.toHaveClass("invisible");
    expect(sidebar()).not.toHaveAttribute("inert");
  });

  it("closes the pane under an open close confirmation", async () => {
    const { user, sessions } = await startPanes(1);
    act(() => sessions.opened[0].stream.status({ state: "Running" }));
    await user.click(screen.getByRole("button", { name: labels.closePane }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => sessions.opened[0].stream.exit(0));

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the pane with Session ended when closing it after a normal exit fails", async () => {
    const { sessions } = await startPanes(1);
    vi.mocked(sessions.close).mockRejectedValueOnce("io");
    act(() => sessions.opened[0].stream.exit(0));
    expect(await within(termLayer()).findByText(labels.sessionEnded)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(labels.closeFailed);
  });

  it("keeps the pane with Session ended when the process dies from a signal (SRS-FR-028)", async () => {
    const { sessions } = await startPanes(1);
    act(() => sessions.opened[0].stream.exit(null));
    expect(within(termLayer()).getByText(labels.sessionEnded)).toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
  });
});

describe("Pane state (4.2 to 4.4)", () => {
  afterEach(() => vi.useRealTimers());

  async function openPane(sessions = fakeSessions({ titles: ["Scaffold Tauri app"] })) {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByTestId("pane-grid");
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  // Testing Library's async helpers wait on setTimeout, so with a fake clock the test drives the UI by hand.
  async function openWithFakeClock(sessions: FakeSessions) {
    setup([ws("a", "agent-deck")], sessions);
    const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));
    await settle();
    fireEvent.click(plusOf("agent-deck"));
    fireEvent.click(within(chooser()).getByRole("button", { name: labels.newSession }));
    await settle();
    return { stream: sessions.opened[0].stream };
  }

  it("shows the chip, then Status unavailable after 5 s untracked, cleared by a tracked status", async () => {
    vi.useFakeTimers();
    const sessions = fakeSessions();
    const { stream } = await openWithFakeClock(sessions);
    const pane = () => within(screen.getByTestId("pane-grid"));
    expect(pane().getByText(labels.state["Idle"])).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(4_999));
    expect(pane().queryByText(labels.statusUnavailable)).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(pane().getByText(labels.statusUnavailable)).toBeInTheDocument();
    act(() => stream.status({ state: "Running" }));
    expect(pane().queryByText(labels.statusUnavailable)).not.toBeInTheDocument();
    expect(pane().getByText(labels.state["Running"])).toBeInTheDocument();
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
    await newSessionIn(userEvent.setup(), "agent-deck");
    await screen.findAllByText(labels.startFailed);
    expect(sessions.title).not.toHaveBeenCalled();
  });

  it("leaves no timer behind once its pane is closed", async () => {
    vi.useFakeTimers();
    const sessions = fakeSessions();
    await openWithFakeClock(sessions);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: labels.closePane }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: labels.close }));
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
    await newSessionIn(user);
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
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      expect(dialog()).toHaveAttribute("aria-modal", "true");
      expect(dialog()).toHaveAccessibleName(labels.closeTitle("Scaffold Tauri app"));
      expect(within(dialog()).getAllByRole("button").map((b) => b.textContent)).toEqual([
        labels.cancel,
        labels.close,
        labels.closeAndTrash,
      ]);
      expect(within(dialog()).getByRole("button", { name: labels.closeAndTrash })).toHaveClass("btn-danger");
      expect(within(dialog()).getByRole("button", { name: labels.close })).toHaveClass("outline-btn");
      expect(within(dialog()).getByRole("button", { name: labels.cancel })).toHaveClass("outline-btn");
      // Centred over the 45% black scrim, as in agent-deck-remote.
      expect(dialog()).toHaveClass("dlg");
      expect(dialog().parentElement).toHaveClass("scrim", "items-center", "justify-center");
      expect(dialog()).not.toHaveTextContent("still running");
      expect(within(dialog()).getByRole("button", { name: labels.cancel })).toHaveFocus();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("asks before closing an untracked pane", async () => {
      const { user, sessions } = await openPane();
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      expect(dialog()).toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("asks before closing an ended pane", async () => {
      const { user, stream } = await openPane();
      act(() => stream.exit(1));
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      expect(dialog()).toBeInTheDocument();
    });

    it("offers no Trash for a session that has no prompt yet", async () => {
      const { user } = await openPane(fakeSessions({ title: vi.fn(() => new Promise<string>(() => {})) }));
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      expect(within(dialog()).getAllByRole("button").map((b) => b.textContent)).toEqual([labels.cancel, labels.close]);
    });

    it("offers no Trash for a pane whose Claude Code did not start", async () => {
      const { user } = await openPane(fakeSessions({ started: false }));
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      expect(within(dialog()).queryByRole("button", { name: labels.closeAndTrash })).not.toBeInTheDocument();
    });

    it("warns that a Running pane is still running; Cancel keeps it", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      expect(within(dialog()).getByText(labels.sessionBusy)).toBeInTheDocument();
      await user.click(within(dialog()).getByRole("button", { name: labels.cancel }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
      expect(screen.getByTestId("pane-grid")).toBeInTheDocument();
    });

    it("keeps the dialog and drops the warning when the pane stops being busy", async () => {
      const { user, sessions, stream } = await openPane();
      act(() => stream.status({ state: "Running" }));
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      act(() => stream.status({ state: "Idle" }));
      expect(dialog()).not.toHaveTextContent(labels.sessionBusy);
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("keeps the dialog without the warning when the session ends", async () => {
      const { user, stream } = await openPane();
      act(() => stream.status({ state: "Needs Approval" }));
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      act(() => stream.exit(1));
      expect(dialog()).not.toHaveTextContent(labels.sessionBusy);
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
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(sessions.close).not.toHaveBeenCalled();
    });

    it("cancels on Escape even after focus left the dialog", async () => {
      const { user } = await openPane();
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      (document.activeElement as HTMLElement).blur();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("keeps Tab and Shift+Tab inside the dialog across its three buttons (M4)", async () => {
      const { user } = await openPane();
      await titled();
      await user.click(screen.getByRole("button", { name: labels.closePane }));
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
      await user.click(screen.getByRole("button", { name: labels.closePane }));
      act(() => screen.getByRole("button", { name: labels.closePane }).focus());
      expect(within(dialog()).getByRole("button", { name: labels.cancel })).toHaveFocus();
    });

    it("does not let Escape reach the terminal behind the dialog (M4)", async () => {
      const { user } = await openPane();
      await user.click(screen.getByRole("button", { name: labels.closePane }));
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

describe("Folder Tree (CR-016)", () => {
  const since = new Date(2026, 9, 16, 14, 2).getTime();
  const order = () =>
    within(sidebar())
      .getAllByRole("button", { name: /^(agent-deck|mokairo)$/ })
      .map((b) => b.textContent);
  const count = (name: string, n: number, countTone: CountTone) =>
    within(workspaceRow(name)).getByRole("img", { name: labels.folderCount(n, countTone) });

  async function openPane(sessions = fakeSessions({ titles: ["Scaffold Tauri app"] })) {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });
    await within(sidebar()).findByText("Scaffold Tauri app");
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  /** `agent-deck` then `mokairo` in the Workspace List, with `perFolder` panes opened in each. */
  async function twoFolders(perFolder: [number, number], titles: string[]) {
    const ctx = setup([ws("a", "agent-deck"), ws("m", "mokairo")], fakeSessions({ titles }));
    for (const [i, name] of (["agent-deck", "mokairo"] as const).entries()) {
      for (let k = 0; k < perFolder[i]; k++) await newSessionIn(ctx.user, name);
    }
    const total = perFolder[0] + perFolder[1];
    await vi.waitFor(() => expect(ctx.sessions.opened).toHaveLength(total));
    await vi.waitFor(() => expect(panes()).toHaveLength(total));
    return { ...ctx, streams: ctx.sessions.opened.map((o) => o.stream) };
  }

  it("has no Status Board column (SRS-FR-031 removed)", async () => {
    setup([ws("a", "agent-deck")]);
    await findWorkspace("agent-deck");
    expect(screen.queryByRole("complementary", { name: "Status Board" })).not.toBeInTheDocument();
    expect(screen.queryByText("Status Board")).not.toBeInTheDocument();
  });

  it("lists each open session under its own workspace, without repeating the workspace name (SRS-FR-051)", async () => {
    await twoFolders([1, 1], ["Scaffold Tauri app", "Fix login bug"]);
    await within(sidebar()).findByText("Fix login bug");
    expect(within(workspaceRow("agent-deck")).getByText("Scaffold Tauri app")).toBeInTheDocument();
    expect(within(workspaceRow("mokairo")).getByText("Fix login bug")).toBeInTheDocument();
    expect(within(workspaceRow("agent-deck")).queryByText("Fix login bug")).not.toBeInTheDocument();
    expect(within(sessionRow("Fix login bug")).queryByText("mokairo")).not.toBeInTheDocument();
    expect(within(sessionRow("Scaffold Tauri app")).queryByText("agent-deck")).not.toBeInTheDocument();
  });

  it("shows the dot and status word of each state and tints only Needs Approval and Error (SRS-FR-032)", async () => {
    const { stream } = await openPane();
    const row = () => sessionRow("Scaffold Tauri app");
    const looks = [
      ["Running", "dot-busy", ""],
      ["Needs Approval", "dot-app", "row-app"],
      ["Idle", "dot-ready", ""],
      ["Error", "dot-err", "row-err"],
      ["Ended", "dot-ended", ""],
    ] as const;
    for (const [state, dot, tint] of looks) {
      act(() => stream.status({ state, since }));
      expect(within(row()).getByText(labels.state[state])).toBeInTheDocument();
      expect(row().querySelector(`.${dot}`)).not.toBeNull();
      for (const other of ["row-app", "row-err"]) {
        if (other === tint) expect(row()).toHaveClass(other);
        else expect(row()).not.toHaveClass(other);
      }
      // Running is blue and untinted; green belongs to Idle (SRS-FR-032, CR-016).
      expect(row()).not.toHaveClass("bg-running-bg");
    }
  });

  it("shows the time and reason under Cần duyệt and Lỗi, nothing under Đang chạy (SRS-FR-033)", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02 · Edit src/main.rs")).toBeInTheDocument();

    act(() => stream.status({ state: "Running", since, reason: "Bash npm test" }));
    expect(within(sessionRow("Scaffold Tauri app")).queryByText(/14:02/)).not.toBeInTheDocument();

    act(() => stream.status({ state: "Error", since, reason: null }));
    expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02")).toBeInTheDocument();
  });

  it("moves mokairo above agent-deck when one of its sessions fails (SRS-FR-052)", async () => {
    const { streams } = await twoFolders([1, 1], ["Scaffold Tauri app", "Fix login bug"]);
    act(() => streams[0].status({ state: "Running", since }));
    act(() => streams[1].status({ state: "Running", since }));
    expect(order()).toEqual(["agent-deck", "mokairo"]);

    act(() => streams[1].status({ state: "Error", since, reason: "overloaded" }));

    expect(order()).toEqual(["mokairo", "agent-deck"]);
  });

  it("counts what needs the user in red, else the open sessions in grey, on an untinted workspace row (SRS-FR-040)", async () => {
    const { streams } = await twoFolders([2, 3], ["a1", "a2", "m1", "m2", "m3"]);
    act(() => streams[0].status({ state: "Idle" }));
    act(() => streams[1].status({ state: "Idle" }));
    act(() => streams[2].status({ state: "Error", reason: "overloaded" }));
    act(() => streams[3].status({ state: "Needs Approval" }));
    act(() => streams[4].status({ state: "Running" }));

    expect(count("mokairo", 2, "Error")).toHaveTextContent("2");
    expect(count("mokairo", 2, "Error")).toHaveClass("chip-err");
    expect(count("agent-deck", 2, "grey")).toHaveTextContent("2");
    expect(count("agent-deck", 2, "grey")).toHaveClass("chip-idle");
    for (const name of ["agent-deck", "mokairo"]) {
      expect(workspaceRow(name).className).not.toMatch(/row-app|row-err|bg-approval-bg|bg-error-bg/);
      expect(workspaceName(name).parentElement!.className).not.toMatch(/row-app|row-err|bg-approval-bg|bg-error-bg/);
    }
  });

  it("drops the row of an Error pane the user closes (RULE-08)", async () => {
    const listed = { sessions: [{ id: "s1", title: "Scaffold Tauri app", lastActivity: since }], unreadable: 0 };
    const { user, sessions, stream } = await openPane(
      fakeSessions({ titles: ["Scaffold Tauri app"], list: vi.fn(async () => listed) }),
    );
    act(() => stream.status({ state: "Error", since, reason: "overloaded" }));
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("row-err");
    await closeVia(user);
    expect(sessions.close).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(within(sidebar()).queryByText("Scaffold Tauri app")).not.toBeInTheDocument());
  });

  it("keeps the Error tint after an abnormal exit", async () => {
    const listed = { sessions: [{ id: "s1", title: "Scaffold Tauri app", lastActivity: since }], unreadable: 0 };
    const { stream } = await openPane(fakeSessions({ titles: ["Scaffold Tauri app"], list: vi.fn(async () => listed) }));
    act(() => stream.status({ state: "Running", since }));
    act(() => stream.status({ state: "Error", since, reason: "exit code 1" }));
    act(() => stream.exit(1));
    await vi.waitFor(() => expect(within(sessionRow("Scaffold Tauri app")).getByText("14:02 · mã thoát 1")).toBeInTheDocument());
    expect(sessionRow("Scaffold Tauri app")).toHaveClass("row-err");
  });

  it("tints neither a session that ended normally nor an untracked pane", async () => {
    const { stream } = await openPane();
    act(() => stream.status({ state: "Error", tracked: false }));
    expect(sessionRow("Scaffold Tauri app")).not.toHaveClass("row-err");
    act(() => stream.status({ state: "Running", since }));
    act(() => stream.status({ state: "Ended", since }));
    expect(sessionRow("Scaffold Tauri app")).not.toHaveClass("row-err");
    expect(within(sessionRow("Scaffold Tauri app")).getByText(labels.state.Ended)).toBeInTheDocument();
  });

  it("keeps the Status Highlight off the Session Chooser row, which stays Live (SRS-FR-012)", async () => {
    const listed = { sessions: [{ id: "s1", title: "Scaffold Tauri app", lastActivity: since }], unreadable: 0 };
    const { user, stream } = await openPane(fakeSessions({ titles: ["Scaffold Tauri app"], list: vi.fn(async () => listed) }));
    act(() => stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    await openChooser(user);
    await vi.waitFor(() => expect(within(chooserRow("Scaffold Tauri app")).getByText(labels.live)).toBeInTheDocument());
    expect(chooserRow("Scaffold Tauri app")).not.toHaveClass("row-app");
    expect(within(chooser()).queryByText("14:02 · Edit src/main.rs")).not.toBeInTheDocument();
  });

  describe("collapse (SRS-FR-141, SRS-FR-142)", () => {
    it("folds and unfolds the Session Rows with the chevron; the count stays and the panes stay open", async () => {
      const { user } = await twoFolders([2, 0], ["First", "Second"]);
      await within(sidebar()).findByText("Second");
      const chevron = within(workspaceRow("agent-deck")).getByRole("button", { name: labels.collapse("agent-deck") });
      expect(chevron).toHaveAttribute("aria-expanded", "true");

      await user.click(chevron);

      expect(within(sidebar()).queryByText("First")).not.toBeInTheDocument();
      expect(within(sidebar()).queryByText("Second")).not.toBeInTheDocument();
      expect(count("agent-deck", 2, "grey")).toHaveTextContent("2");
      expect(panes()).toHaveLength(2);
      const unfold = within(workspaceRow("agent-deck")).getByRole("button", { name: labels.expand("agent-deck") });
      expect(unfold).toHaveAttribute("aria-expanded", "false");

      await user.click(unfold);

      expect(within(workspaceRow("agent-deck")).getByText("First")).toBeInTheDocument();
      expect(within(workspaceRow("agent-deck")).getByText("Second")).toBeInTheDocument();
    });

    it("turns the count of a folded workspace yellow when a session asks for approval", async () => {
      const { user, streams } = await twoFolders([0, 2], ["m1", "m2"]);
      act(() => streams[0].status({ state: "Running" }));
      act(() => streams[1].status({ state: "Running" }));
      await user.click(within(workspaceRow("mokairo")).getByRole("button", { name: labels.collapse("mokairo") }));

      act(() => streams[1].status({ state: "Needs Approval" }));

      expect(count("mokairo", 1, "Needs Approval")).toHaveClass("chip-app");
      expect(within(sidebar()).queryByText("m2")).not.toBeInTheDocument();
    });

    it("opens Folder khác at start when no workspace has a pane, and counts down as they open one (CR-017)", async () => {
      const { user } = setup([ws("a", "agent-deck"), ws("m", "mokairo"), ws("n", "notes")]);
      const group = await within(sidebar()).findByRole("button", { name: labels.otherFolders(3) });
      expect(group).toHaveAttribute("aria-expanded", "true");
      for (const name of ["agent-deck", "mokairo", "notes"]) expect(within(sidebar()).getByRole("button", { name })).toBeInTheDocument();

      await newSessionIn(user, "agent-deck");
      await within(sidebar()).findByRole("button", { name: labels.otherFolders(2) });
      await newSessionIn(user, "mokairo");
      await within(sidebar()).findByRole("button", { name: labels.otherFolders(1) });
      expect(within(sidebar()).getByRole("button", { name: labels.collapse("mokairo") })).toBeInTheDocument();
    });

    it("keeps the user's fold of Folder khác while nothing opens", async () => {
      const { user } = setup([ws("a", "agent-deck"), ws("m", "mokairo")]);
      const group = await within(sidebar()).findByRole("button", { name: labels.otherFolders(2) });
      await user.click(group);
      expect(group).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{Control>}{Shift>}{/Shift}{/Control}");
      expect(within(sidebar()).getByRole("button", { name: labels.otherFolders(2) })).toHaveAttribute("aria-expanded", "false");
    });

    it("collapses Folder khác once a pane opens and opens it again when the last pane closes", async () => {
      const { user } = setup([ws("a", "agent-deck"), ws("m", "mokairo")]);
      await newSessionIn(user, "agent-deck");
      const group = await within(sidebar()).findByRole("button", { name: labels.otherFolders(1) });
      expect(group).toHaveAttribute("aria-expanded", "false");

      await closeVia(user);

      const reopened = await within(sidebar()).findByRole("button", { name: labels.otherFolders(2) });
      await vi.waitFor(() => expect(reopened).toHaveAttribute("aria-expanded", "true"));
    });

    it("has no Folder khác group when every workspace has a session open", async () => {
      await openPane();
      expect(otherFolders()).not.toBeInTheDocument();
    });
  });
});

describe("Session list (2.1, 2.2)", () => {
  afterEach(() => vi.restoreAllMocks());
  const now = new Date(2026, 9, 16, 14, 0).getTime();
  const rowTexts = (name = "agent-deck") => within(chooserList(name)).getAllByRole("listitem").map((r) => r.textContent);

  function listing(sessions: { id: string; title: string; lastActivity: number }[], unreadable = 0) {
    return vi.fn(async () => ({ sessions, unreadable }));
  }

  it("lists the folder's sessions newest first with their titles and times", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([
      { id: "b", title: "Scaffold Tauri app", lastActivity: now - 2 * 60_000 },
      { id: "a", title: "Write BRD and SRS", lastActivity: new Date(2026, 9, 15, 9).getTime() },
    ]);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await openChooser(user);
    await within(chooser()).findByRole("list", { name: labels.oldSessions });
    expect(rowTexts()).toEqual([`Scaffold Tauri app${labels.minutesAgo(2)}`, `Write BRD and SRS${labels.yesterday}`]);
    expect(list).toHaveBeenCalledWith("a");
  });

  it("shows how many sessions could not be read", async () => {
    const list = listing([{ id: "a", title: "Init repo", lastActivity: now }], 2);
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
    await openChooser(user);
    expect(await within(chooser()).findByText(labels.unreadable(2))).toBeInTheDocument();
  });

  it("says a missing folder no longer exists and does not read it", async () => {
    const list = listing([]);
    const { user } = setup([ws("m", "gone", true)], fakeSessions({ list }));
    await openChooser(user, "gone");
    expect(await within(chooser("gone")).findByText(labels.folderGone)).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("puts a new session on top as Live and drops the label when its pane closes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([{ id: "old", title: "Init repo", lastActivity: now - 3_600_000 }]);
    const sessions = fakeSessions({ list, titles: ["Fix login"] });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(user, "agent-deck");
    await openChooser(user);
    await vi.waitFor(() => expect(rowTexts()).toEqual([`Fix login${labels.live}`, `Init repo${labels.hoursAgo(1)}`]));
    list.mockResolvedValue({ sessions: [{ id: "s1", title: "Fix login", lastActivity: now }, { id: "old", title: "Init repo", lastActivity: now - 3_600_000 }], unreadable: 0 });
    await closeChooser(user);
    await closeVia(user);
    await openChooser(user);
    await vi.waitFor(() => expect(rowTexts()).toEqual([`Fix login${labels.justNow}`, `Init repo${labels.hoursAgo(1)}`]));
  });

  it("drops the Live label once the session in the pane has ended", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const list = listing([{ id: "s1", title: "Fix login", lastActivity: now }]);
    const sessions = fakeSessions({ list });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(user, "agent-deck");
    await openChooser(user);
    await vi.waitFor(() => expect(rowTexts()).toEqual([`Fix login${labels.live}`]));
    act(() => sessions.opened[0].stream.exit(1));
    await vi.waitFor(() => expect(rowTexts()).toEqual([`Fix login${labels.justNow}`]));
  });

  it("shows the folder opened last even when an earlier read answers later", async () => {
    type Listing = { sessions: { id: string; title: string; lastActivity: number }[]; unreadable: number };
    let answerFirst: (v: Listing) => void = () => {};
    const list = vi.fn((id: string) =>
      id === "a"
        ? new Promise<Listing>((r) => (answerFirst = r))
        : Promise.resolve({ sessions: [{ id: "b1", title: "Beta work", lastActivity: now }], unreadable: 0 }),
    );
    const { user } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list }));
    await openChooser(user, "alpha");
    await closeChooser(user, "alpha");
    await openChooser(user, "beta");
    await vi.waitFor(() => expect(rowTexts("beta")).toEqual([expect.stringContaining("Beta work")]));
    await act(async () => answerFirst({ sessions: [{ id: "a1", title: "Alpha work", lastActivity: now }], unreadable: 0 }));
    expect(rowTexts("beta")).toEqual([expect.stringContaining("Beta work")]);
  });
});

describe("Session Chooser (CR-016)", () => {
  afterEach(() => vi.restoreAllMocks());
  const now = new Date(2026, 9, 16, 14, 0).getTime();
  type Listed = { id: string; title: string; lastActivity: number };
  const three: Listed[] = [
    { id: "s-b", title: "Fix login bug", lastActivity: now - 60 * 60_000 },
    { id: "s-a", title: "Scaffold Tauri app", lastActivity: now - 2 * 60_000 },
    { id: "s-c", title: "Init repo", lastActivity: new Date(2026, 9, 15, 9).getTime() },
  ];
  const listOf = (byWorkspace: Record<string, Listed[]>, unreadable = 0) =>
    vi.fn(async (id: string) => ({ sessions: byWorkspace[id] ?? [], unreadable }));
  const rowTitles = () => within(chooserList()).getAllByRole("listitem").map((li) => li.textContent);
  const grid = () => screen.getByRole("main").parentElement!;

  describe("open (3.2 to 3.5)", () => {
    it("opens from + with the folder name, ×, Phiên mới, Mở lại phiên cũ and the rows newest first (SRS-FR-007 to SRS-FR-009)", async () => {
      vi.spyOn(Date, "now").mockReturnValue(now);
      const list = listOf({ a: three });
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
      await findWorkspace("agent-deck");
      const columns = grid().className;

      const dialog = await openChooser(user);

      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveClass("dlg", "w-[440px]");
      expect(dialog.parentElement).toHaveClass("scrim", "items-center", "justify-center");
      expect(within(dialog).getByRole("button", { name: labels.close })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: labels.newSession })).toHaveClass("send");
      expect(within(dialog).getByText(labels.oldSessions)).toHaveClass("side-label");
      await within(dialog).findByText("Scaffold Tauri app");
      expect(rowTitles()).toEqual([
        `Scaffold Tauri app${labels.minutesAgo(2)}`,
        `Fix login bug${labels.hoursAgo(1)}`,
        `Init repo${labels.yesterday}`,
      ]);
      expect(list).toHaveBeenCalledWith("a");
      // A dialog over the panes: the workbench keeps Sidebar | panes.
      expect(grid().className).toBe(columns);
      expect(columns).toContain("grid-cols-[var(--sidebar-w)_1fr]");
      expect(sidebar()).not.toContainElement(dialog);
    });

    it("opens from + on a workspace inside Folder khác (SRS-FR-007)", async () => {
      const { user } = setup([ws("a", "agent-deck"), ws("m", "mokairo")], fakeSessions({ titles: ["Work"] }));
      await newSessionIn(user, "agent-deck");
      await within(sidebar()).findByRole("button", { name: labels.otherFolders(1) });
      expect(await openChooser(user, "mokairo")).toBeInTheDocument();
    });

    it("opens on a click of the workspace name too and selects that row (GATE 1)", async () => {
      const { user } = setup([ws("a", "agent-deck"), ws("m", "mokairo")]);
      await user.click(await findWorkspace("mokairo"));
      expect(chooser("mokairo")).toBeInTheDocument();
      expect(workspaceRow("mokairo")).toHaveAttribute("aria-current", "true");
      expect(workspaceRow("agent-deck")).not.toHaveAttribute("aria-current");
    });

    it("lists only the sessions of that workspace, not those of a subfolder (SRS-FR-007)", async () => {
      const list = listOf({ a: three, u: [{ id: "s-u", title: "UI work", lastActivity: now }] });
      const items = [ws("a", "agent-deck"), { id: "u", name: "ui", path: "/p/agent-deck/ui", missing: false }];
      const { user } = setup(items, fakeSessions({ list }));
      await openChooser(user);
      await within(chooser()).findByText("Scaffold Tauri app");
      expect(within(chooser()).queryByText("UI work")).not.toBeInTheDocument();
    });

    it("reads the sessions again on every open (SRS-FR-007, SRS-FR-054)", async () => {
      const list = listOf({ a: three });
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list }));
      await openChooser(user);
      await within(chooser()).findByText("Init repo");
      await closeChooser(user);
      list.mockResolvedValue({ sessions: [{ id: "new", title: "Made outside", lastActivity: now }, ...three], unreadable: 0 });

      await openChooser(user);

      expect(await within(chooser()).findByText("Made outside")).toBeInTheDocument();
      expect(list).toHaveBeenCalledTimes(2);
    });

    it("shows skeleton rows and no loading text while reading", async () => {
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: vi.fn(() => new Promise<never>(() => {})) }));
      await openChooser(user);
      const skeleton = within(chooser()).getByRole("list", { name: labels.loadingSessions });
      expect(within(skeleton).getAllByRole("listitem")).toHaveLength(4);
      expect(skeleton.querySelector(".skel")).not.toBeNull();
      expect(chooser()).not.toHaveTextContent(/Đang tải/);
      expect(within(chooser()).getByRole("button", { name: labels.newSession })).toBeInTheDocument();
    });

    it("says Chưa có phiên nào under Mở lại phiên cũ and still offers Phiên mới (SRS-FR-010)", async () => {
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({}) }));
      await openChooser(user);
      const empty = await within(chooser()).findByText(labels.noSessions);
      expect(within(chooser()).getByText(labels.oldSessions).compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(chooser()).getByRole("button", { name: labels.newSession })).toBeInTheDocument();
    });

    it("lists 8 sessions and says 2 phiên không đọc được (SRS-FR-011)", async () => {
      const eight = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, title: `Work ${i}`, lastActivity: now - i }));
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: eight }, 2) }));
      await openChooser(user);
      expect(await within(chooser()).findByText(labels.unreadable(2))).toBeInTheDocument();
      expect(within(chooserList()).getAllByRole("listitem")).toHaveLength(8);
    });

    it("shows Đang mở in place of the time on an open session's row (SRS-FR-012)", async () => {
      vi.spyOn(Date, "now").mockReturnValue(now);
      const listed = [{ id: "s1", title: "Fix login", lastActivity: now - 2 * 60_000 }];
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ titles: ["Fix login"], list: listOf({ a: listed }) }));
      await newSessionIn(user);
      await screen.findByRole("region", { name: "agent-deck · Fix login" });
      await openChooser(user);
      await vi.waitFor(() => expect(within(chooserRow("Fix login")).getByText(labels.live)).toHaveClass("chip", "chip-idle"));
      expect(chooserRow("Fix login")).not.toHaveTextContent(labels.minutesAgo(2));
    });

    it("lists 200 sessions less than 3 seconds after the click on + (SRS-NFR-003)", async () => {
      const many = Array.from({ length: 200 }, (_, i) => ({ id: `s${i}`, title: `Work ${i}`, lastActivity: now - i }));
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: many }) }));
      const plus = await vi.waitFor(() => plusOf("agent-deck"));
      const start = performance.now();
      await user.click(plus);
      await vi.waitFor(() => expect(within(chooserList()).getAllByRole("listitem")).toHaveLength(200));
      expect(performance.now() - start).toBeLessThan(3_000);
    });
  });

  describe("close, focus and open a pane (4.1 to 4.4)", () => {
    const newSessionOf = () => within(chooser()).getByRole("button", { name: labels.newSession });

    it("puts focus on Phiên mới when it opens and back on + after × (SRS-FR-018, SRS-FR-054)", async () => {
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: three }) }));
      await openChooser(user);
      expect(newSessionOf()).toHaveFocus();

      await closeChooser(user);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(plusOf("agent-deck")).toHaveFocus();
      expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
    });

    it("closes on Esc, which does not reach the pane behind it (SRS-FR-054)", async () => {
      const { user, adapters } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: three }) }));
      await newSessionIn(user);
      await screen.findByTestId("pane-grid");
      await openChooser(user);
      const terminal = panes()[0];
      const reached = vi.fn();
      terminal.addEventListener("keydown", reached);

      const notCancelled = fireEvent.keyDown(terminal, { key: "Escape" });

      expect(notCancelled).toBe(false);
      expect(reached).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(plusOf("agent-deck")).toHaveFocus();
      expect(adapters).toHaveLength(1);
    });

    it("closes on a mousedown on the scrim but not on one inside the dialog (SRS-FR-054)", async () => {
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: three }) }));
      await openChooser(user);
      await within(chooser()).findByText("Init repo");

      fireEvent.mouseDown(within(chooser()).getByText(labels.oldSessions));
      fireEvent.mouseDown(chooser());
      expect(chooser()).toBeInTheDocument();

      fireEvent.mouseDown(chooser().parentElement!);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(plusOf("agent-deck")).toHaveFocus();
    });

    it("keeps Tab and Shift+Tab inside the dialog, away from the Sidebar and the pane (SRS-FR-007)", async () => {
      const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: three }) }));
      await newSessionIn(user);
      await screen.findByTestId("pane-grid");
      await openChooser(user);
      await within(chooser()).findByText("Init repo");
      const close = within(chooser()).getByRole("button", { name: labels.close });

      await user.tab({ shift: true });
      expect(close).toHaveFocus();
      await user.tab();
      expect(newSessionOf()).toHaveFocus();
      for (let i = 0; i < 12; i++) {
        await user.tab();
        expect(chooser()).toContainElement(document.activeElement as HTMLElement);
      }
      for (let i = 0; i < 12; i++) {
        await user.tab({ shift: true });
        expect(chooser()).toContainElement(document.activeElement as HTMLElement);
      }
    });

    it("pulls focus back into the dialog when it lands outside", async () => {
      const { user } = setup([ws("a", "agent-deck")]);
      await openChooser(user);
      act(() => within(sidebar()).getByRole("button", { name: labels.addFolder }).focus());
      expect(newSessionOf()).toHaveFocus();
    });

    it("closes and opens a focused pane in that folder on Phiên mới (SRS-FR-018, SRS-FR-014)", async () => {
      const { user, sessions } = setup([ws("a", "agent-deck"), ws("m", "mokairo")]);
      await openChooser(user, "mokairo");

      await user.click(within(chooser("mokairo")).getByRole("button", { name: labels.newSession }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await screen.findByTestId("pane-grid");
      expect(sessions.open).toHaveBeenCalledWith("m", 80, 24, undefined);
      expect(composerOf(panes()[0])).toHaveFocus();
    });

    it("starts a session on Enter right after opening, and only one (SRS-FR-018)", async () => {
      const { user, sessions } = setup([ws("a", "agent-deck")]);
      await openChooser(user);

      await user.keyboard("{Enter}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await screen.findByTestId("pane-grid");
      expect(sessions.open).toHaveBeenCalledTimes(1);
    });

    it("opens no pane in a Missing folder and says Không tìm thấy folder (SRS-FR-020)", async () => {
      const { user, sessions } = setup([ws("g", "gone", true)]);
      await openChooser(user, "gone");

      await user.click(within(chooser("gone")).getByRole("button", { name: labels.newSession }));

      expect(await screen.findByText(labels.folderNotFound)).toBeInTheDocument();
      expect(sessions.open).not.toHaveBeenCalled();
      expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
      await vi.waitFor(() => expect(plusOf("gone")).toHaveFocus());
    });

    it("closes and resumes the clicked row in a focused pane (SRS-FR-013)", async () => {
      const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: three }), titles: ["Scaffold Tauri app"] }));
      await openChooser(user);

      await user.click(await within(chooser()).findByRole("button", { name: /^Scaffold Tauri app/ }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" })).toBeInTheDocument();
      expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, "s-a");
      expect(composerOf(panes()[0])).toHaveFocus();
    });

    it("resumes a row on Enter, keeping that Enter out of the terminal (SRS-FR-013)", async () => {
      const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: three }) }));
      await openChooser(user);
      const row = await within(chooser()).findByRole("button", { name: /^Fix login bug/ });

      const notPrevented = fireEvent.keyDown(row, { key: "Enter" });

      expect(notPrevented).toBe(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await vi.waitFor(() => expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, "s-b"));
      expect(sessions.open).toHaveBeenCalledTimes(1);
    });

    it("focuses the pane of an Đang mở row without a second pane (SRS-FR-015, SRS-FR-037)", async () => {
      const listed = [{ id: "s1", title: "Refactor API client", lastActivity: now }];
      const sessions = fakeSessions({ list: listOf({ a: listed }), titles: ["Refactor API client", "Other"] });
      const { user } = setup([ws("a", "agent-deck")], sessions);
      await newSessionIn(user);
      await screen.findByRole("region", { name: "agent-deck · Refactor API client" });
      await newSessionIn(user);
      await vi.waitFor(() => expect(panes()).toHaveLength(2));
      await openChooser(user);

      await user.click(await within(chooser()).findByRole("button", { name: new RegExp(`^Refactor API client.*${labels.live}`) }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(composerOf(panes()[0])).toHaveFocus();
      expect(panes()).toHaveLength(2);
      expect(panes()[0]).toHaveClass("pane-focus");
      expect(panes()[0]).toContainElement(document.activeElement as HTMLElement);
    });

    it("reads Chưa mở phiên nào and the + hint with no button while no pane is open (SRS-FR-007)", async () => {
      setup([ws("a", "agent-deck")]);
      expect(await screen.findByText(labels.noPanes)).toBeInTheDocument();
      expect(screen.getByText("Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ.")).toBeInTheDocument();
      expect(within(screen.getByRole("main")).queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("delete inside the chooser (5.1 to 5.3)", () => {
    const five: Listed[] = [
      ...three,
      { id: "s-d", title: "Write BRD", lastActivity: now - 3 * 86_400_000 },
      { id: "s-e", title: "Add text zoom", lastActivity: now - 4 * 86_400_000 },
    ];
    const trash = (title: string) => within(chooserRow(title)).getByRole("button", { name: labels.deleteSession(title) });
    const box = (title: string) => within(chooser()).getByRole("checkbox", { name: labels.select(title) });
    const footer = (name: string) => within(chooser()).queryByRole("button", { name });
    const confirm = (name: string) => screen.getByRole("dialog", { name });

    async function chooserWith(rows: Listed[], over: Partial<FakeSessions> = {}) {
      const ctx = setup([ws("a", "agent-deck")], fakeSessions({ list: listOf({ a: rows }), ...over }));
      await openChooser(ctx.user);
      await within(chooser()).findByText(rows[0].title);
      return ctx;
    }

    it("shows the trash icon only on a hovered row or one holding focus (SRS-FR-048)", async () => {
      await chooserWith(three);
      const icon = trash("Scaffold Tauri app");
      expect(icon).toHaveClass("opacity-0", "group-hover:opacity-100", "group-focus-within:opacity-100", "focus-visible:opacity-100");
      expect(icon.closest("li")).toHaveClass("group");
    });

    it("asks in a dialog above the chooser and opens no pane; the trash icon and the checkbox never resume (SRS-FR-048, SRS-FR-013)", async () => {
      const { user, sessions } = await chooserWith(three);

      await user.click(box("Fix login bug"));
      await user.click(trash("Scaffold Tauri app"));

      const dialog = confirm(labels.trashTitle("Scaffold Tauri app"));
      expect(dialog).toHaveTextContent("Chuyển “Scaffold Tauri app” vào Thùng rác?");
      expect(chooser().compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(chooser().parentElement).toHaveAttribute("inert");
      expect(sessions.open).not.toHaveBeenCalled();
    });

    it("closes only the confirm on Huỷ or Esc and gives focus back to the trash icon (SRS-FR-048)", async () => {
      const { user, sessions } = await chooserWith(three);

      await user.click(trash("Scaffold Tauri app"));
      await user.click(within(confirm(labels.trashTitle("Scaffold Tauri app"))).getByRole("button", { name: labels.cancel }));
      expect(chooser().parentElement).not.toHaveAttribute("inert");
      expect(trash("Scaffold Tauri app")).toHaveFocus();

      await user.click(trash("Scaffold Tauri app"));
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: labels.trashTitle("Scaffold Tauri app") })).not.toBeInTheDocument();
      expect(within(chooser()).getByText("Scaffold Tauri app")).toBeInTheDocument();
      expect(trash("Scaffold Tauri app")).toHaveFocus();
      expect(sessions.deleteSession).not.toHaveBeenCalled();
    });

    it("moves focus to the next row, else the previous one, else Phiên mới once the deleted row goes (SRS-FR-048)", async () => {
      let rows = [...three];
      const { user } = await chooserWith(three, {
        list: vi.fn(async () => ({ sessions: [...rows], unreadable: 0 })),
        deleteSession: vi.fn(async (_ws: string, id: string) => void (rows = rows.filter((r) => r.id !== id))),
      });
      const resumeButton = (title: string) => within(chooser()).getByRole("button", { name: new RegExp(`^${title}`) });
      const deleteAndWait = async (title: string) => {
        await user.click(trash(title));
        await user.click(screen.getByRole("button", { name: labels.moveToTrash }));
        await vi.waitFor(() => expect(within(chooser()).queryByText(title)).not.toBeInTheDocument());
      };

      await deleteAndWait("Fix login bug");
      expect(resumeButton("Init repo")).toHaveFocus();

      await deleteAndWait("Init repo");
      expect(resumeButton("Scaffold Tauri app")).toHaveFocus();

      await deleteAndWait("Scaffold Tauri app");
      expect(within(chooser()).getByRole("button", { name: labels.newSession })).toHaveFocus();
    });

    it("shows Không xoá được phiên above the scrim when the move fails (SRS-FR-050)", async () => {
      const { user } = await chooserWith(three, { deleteSession: vi.fn(async () => Promise.reject("locked")) });
      await user.click(trash("Scaffold Tauri app"));
      await user.click(screen.getByRole("button", { name: labels.moveToTrash }));

      const toast = await screen.findByRole("alert");
      expect(toast).toHaveTextContent(labels.deleteFailed);
      expect(toast).toHaveClass("z-20");
      expect(chooser().parentElement).toHaveClass("z-10");
      expect(within(chooser()).getByText("Scaffold Tauri app")).toBeInTheDocument();
    });

    it("shows Chọn tất cả and a red Xoá đã chọn below the rows once a row is ticked; ticking opens nothing (SRS-FR-073, SRS-FR-074)", async () => {
      const { user, sessions } = await chooserWith(three);
      await user.click(box("Scaffold Tauri app"));
      await user.click(box("Fix login bug"));

      expect(footer(labels.deleteSelected(2))).toHaveClass("btn-danger");
      expect(footer(labels.selectAll)).toBeInTheDocument();
      expect(chooserList().contains(footer(labels.selectAll))).toBe(false);
      expect(chooser()).toBeInTheDocument();
      expect(sessions.open).not.toHaveBeenCalled();
    });

    it("ticks all five with Chọn tất cả (SRS-FR-075)", async () => {
      const { user } = await chooserWith(five);
      await user.click(box("Init repo"));
      await user.click(footer(labels.selectAll)!);
      expect(footer(labels.deleteSelected(5))).toBeInTheDocument();
    });

    it("keeps the ticks on Huỷ in the confirm for the selection (SRS-FR-077)", async () => {
      const { user } = await chooserWith(three);
      for (const title of ["Scaffold Tauri app", "Fix login bug", "Init repo"]) await user.click(box(title));
      await user.click(footer(labels.deleteSelected(3))!);
      await user.click(within(confirm(labels.trashManyTitle(3))).getByRole("button", { name: labels.cancel }));
      for (const title of ["Scaffold Tauri app", "Fix login bug", "Init repo"]) expect(box(title)).toBeChecked();
      expect(chooser()).toBeInTheDocument();
    });

    it("empties the selection whenever the chooser closes (SRS-FR-076)", async () => {
      const { user } = await chooserWith(three);
      const tickTwo = async () => {
        await within(chooser()).findByText("Init repo");
        await user.click(box("Fix login bug"));
        await user.click(box("Init repo"));
      };
      const reopenUnticked = async () => {
        await openChooser(user);
        await within(chooser()).findByText("Init repo");
        expect(box("Fix login bug")).not.toBeChecked();
        expect(footer(labels.selectAll)).not.toBeInTheDocument();
      };
      const closers = [
        () => closeChooser(user),
        () => user.keyboard("{Escape}"),
        async () => void fireEvent.mouseDown(chooser().parentElement!),
        () => user.click(within(chooser()).getByRole("button", { name: labels.newSession })),
        () => user.click(within(chooser()).getByRole("button", { name: /^Scaffold Tauri app/ })),
      ];
      for (const close of closers) {
        await tickTwo();
        await close();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await reopenUnticked();
      }
    });
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
  const row = (title: string) => within(chooser()).getByRole("button", { name: new RegExp(`^${title}`) });

  /** + on `folder`, then a click on the row that starts with `title`. */
  async function resumeRow(user: ReturnType<typeof userEvent.setup>, folder: string, title: string) {
    await openChooser(user, folder);
    await user.click(await within(chooser(folder)).findByRole("button", { name: new RegExp(`^${title}`) }));
  }

  it("opens the session with its id in a focused pane titled after the row", async () => {
    const title = vi.fn(() => new Promise<string>(() => {}));
    const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ list: list(), title }));
    await resumeRow(user, "agent-deck", "Scaffold");
    expect(await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" })).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledWith("a", 80, 24, SCAFFOLD);
    expect(composerOf(panes()[0])).toHaveFocus();
    expect(panes()).toHaveLength(1);
    await openChooser(user);
    await vi.waitFor(() => expect(row("Scaffold")).toHaveTextContent(labels.live));
    expect(chooserList().querySelectorAll("li")).toHaveLength(2);
  });

  it("focuses the pane that already holds the session instead of opening another", async () => {
    const sessions = fakeSessions({ list: list(), title: vi.fn(async (id: string) => (id === "p1" ? "Scaffold Tauri app" : "Other")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await resumeRow(user, "agent-deck", "Scaffold");
    await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });
    await newSessionIn(user);
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    const focusedLabel = () => panes().find((p) => p.classList.contains("pane-focus"))?.getAttribute("aria-label");
    expect(focusedLabel()).not.toBe("agent-deck · Scaffold Tauri app");

    await resumeRow(user, "agent-deck", "Scaffold");
    expect(composerOf(panes()[0])).toHaveFocus();
    expect(sessions.open).toHaveBeenCalledTimes(2);
    expect(panes()).toHaveLength(2);
    expect(focusedLabel()).toBe("agent-deck · Scaffold Tauri app");
  });

  it("moves keyboard focus to the pane even when it is already the focused one", async () => {
    // A title that never answers keeps the row named after the listed session.
    const title = vi.fn(() => new Promise<string>(() => {}));
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: list(), title }));
    await resumeRow(user, "agent-deck", "Scaffold");
    await screen.findByRole("region", { name: /agent-deck/ });
    await resumeRow(user, "agent-deck", "Scaffold");
    expect(composerOf(panes()[0])).toHaveFocus();
  });

  it("shows Folder not found when the backend reports the folder missing, focus back on its + (SRS-FR-016)", async () => {
    const sessions = fakeSessions({ list: list(), open: vi.fn(async () => Promise.reject("folder_missing")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await resumeRow(user, "agent-deck", "Scaffold");
    expect(await screen.findByText(labels.folderNotFound)).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(plusOf("agent-deck")).toHaveFocus());
  });

  it("opens no second pane when the backend says the session is already open", async () => {
    const sessions = fakeSessions({ list: list(), open: vi.fn(async () => Promise.reject("already_open")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await resumeRow(user, "agent-deck", "Scaffold");
    expect(await screen.findByText(labels.openFailed)).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
  });

  it("shows the generic message when the backend rejects the session id", async () => {
    const sessions = fakeSessions({ list: list(), open: vi.fn(async () => Promise.reject("invalid_session")) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await resumeRow(user, "agent-deck", "Scaffold");
    expect(await screen.findByText(labels.openFailed)).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
  });

  it("resumes in the workspace the row belongs to", async () => {
    const { user, sessions } = setup([ws("a", "alpha"), ws("b", "beta")], fakeSessions({ list: list() }));
    await resumeRow(user, "beta", "Scaffold");
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
    await newSessionIn(user);
    await screen.findByRole("region", { name: `agent-deck · ${title}` });
  };

  async function startOne() {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    return ctx;
  }

  it("puts the new session to the right of the focused pane and focuses it (SRS-FR-021)", async () => {
    const { user, sessions } = await startOne();
    await newSession(user, "p2");
    expect(sessions.open).toHaveBeenLastCalledWith("a", 80, 24, undefined);
    expect(rectOf(paneNamed("p1"))).toEqual([0, 0, 50, 100]);
    expect(rectOf(paneNamed("p2"))).toEqual([50, 0, 50, 100]);
    expect(composerOf(paneNamed("p2"))).toHaveFocus();
    expect(paneNamed("p2")).toHaveClass("pane-focus");
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
    await newSessionIn(user);
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
    await closeVia(user, labels.close, paneNamed("p2"));
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
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    for (let n = 2; n <= count; n++) {
      await newSessionIn(ctx.user);
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
    fireEvent.pointerDown(within(paneNamed("p1")).getByRole("button", { name: labels.closePane }), { clientX: 580, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { ...sidePoint("p2", "bottom"), pointerId: 1 });
    expect(zones()).toBeNull();
  });

  it("starts no drag while a pane is maximized", async () => {
    const { user } = await start(2);
    await user.click(within(paneNamed("p1")).getByRole("button", { name: labels.maximizePane }));
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
    expect(composerOf(paneNamed("p1"))).not.toHaveFocus();

    dragPane("p1", "p2", "bottom");

    expect(rectOf("p2")).toEqual([0, 0, 100, 50]);
    expect(rectOf("p1")).toEqual([0, 50, 100, 50]);
    expect(zones()).toBeNull();
    expect(wrapper("p1")).not.toHaveClass("opacity-50");
    expect(within(paneNamed("p1")).getByText(labels.state["Running"])).toBeInTheDocument();
    expect(sessions.close).not.toHaveBeenCalled();
    expect(vi.mocked(adapters[0].open).mock.calls.length).toBe(opens);
    expect(adapters[0].container!.isConnected).toBe(true);
    expect(composerOf(paneNamed("p1"))).toHaveFocus();
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
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    for (let n = 2; n <= count; n++) {
      await newSessionIn(ctx.user);
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

    await closeVia(user, labels.close, paneNamed("p2"));
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
    await newSessionIn(user, "agent-deck");
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
    await first.user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await first.user.click(within(paneNamed("p2")).getByRole("button", { name: labels.maximizePane }));

    const { sessions } = relaunch();

    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(vi.mocked(sessions.open).mock.calls.map((c) => c[3])).toEqual(["s1", "s2"]);
    expect(rectOf("p1")).toEqual([0, 0, 30, 100]);
    expect(rectOf("p2")).toEqual([30, 0, 70, 100]);
    expect(wrapper("p2")).not.toHaveClass("fixed");
    expect(sessions.openShell).not.toHaveBeenCalled();
    expect(paneNamed("p2")).toHaveClass("pane-focus");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaves out the pane of a missing folder and reports it (SRS-FR-086)", async () => {
    saved({ x1: "a", x2: "b", x3: "a" }, row("x1", "x2", "x3"));
    const { sessions } = relaunch([ws("a", "agent-deck"), ws("b", "mokairo", true)]);

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.reopenFailed(1));
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

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.reopenFailed(2));
    await screen.findByRole("region", { name: "agent-deck · p1" });
    expect(rectOf("p1")).toEqual([0, 0, 100, 100]);
  });

  it("counts a session whose Claude Code does not start and closes its pane (SRS-FR-086)", async () => {
    saved({ x1: "a", x2: "a" }, row("x1", "x2"));
    const sessions = fakeSessions({ started: false });
    relaunch([ws("a", "agent-deck")], sessions);

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.reopenFailed(2));
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
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await newSessionIn(ctx.user);
    await screen.findByRole("region", { name: "agent-deck · p2" });
    await newSessionIn(ctx.user);
    await screen.findByRole("region", { name: "agent-deck · p3" });
    dragPane("p3", "p2", "bottom");
    return ctx;
  }

  it("covers the window with the maximized pane and hides the others in place (SRS-FR-041)", async () => {
    const { user } = await threePanes();
    const before = { p1: styleOf("p1"), p3: styleOf("p3") };

    await user.click(button("p2", labels.maximizePane));

    expect(wrapper("p2")).toHaveClass("fixed");
    for (const title of ["p1", "p3"] as const) {
      expect(wrapper(title)).toHaveClass("invisible");
      expect(wrapper(title)).toHaveAttribute("inert");
      expect(styleOf(title)).toBe(before[title]);
    }
    expect(sidebar()).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: labels.hideSidebar })).toHaveAttribute("inert");
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(button("p2", labels.restorePane)).toBeInTheDocument();
  });

  it("moves the keyboard into the pane it maximizes", async () => {
    const { user } = await threePanes();
    act(() => composerOf(paneNamed("p1")).focus());

    await user.click(button("p2", labels.maximizePane));

    expect(composerOf(paneNamed("p2"))).toHaveFocus();
    expect(paneNamed("p2")).toHaveClass("pane-focus");
    expect(paneNamed("p1")).not.toHaveClass("pane-focus");
  });

  it("outlines only the pane the user clicks into (SRS-FR-087)", async () => {
    await threePanes();

    fireEvent.focus(paneNamed("p2"));

    expect(paneNamed("p2")).toHaveClass("pane-focus");
    for (const title of ["p1", "p3"]) expect(paneNamed(title)).not.toHaveClass("pane-focus");
  });

  it("keeps an error toast above the maximized pane", async () => {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: "agent-deck · p1" });
    await ctx.user.click(button("p1", labels.maximizePane));
    vi.mocked(sessions.open).mockRejectedValueOnce("spawn failed");

    // The Sidebar is inert under the maximized pane; jsdom ignores inert, so the + is clicked directly.
    fireEvent.click(plusOf("agent-deck"));
    await ctx.user.click(within(chooser()).getByRole("button", { name: labels.newSession }));

    const toast = await screen.findByRole("alert");
    expect(wrapper("p1")).toHaveClass("z-10");
    expect(toast).toHaveClass("z-20");
  });

  it("brings back the same layout on Restore (SRS-FR-042)", async () => {
    const { user } = await threePanes();
    const before = ["p1", "p2", "p3"].map(styleOf);

    await user.click(button("p2", labels.maximizePane));
    await user.click(button("p2", labels.restorePane));

    expect(["p1", "p2", "p3"].map(styleOf)).toEqual(before);
    for (const title of ["p1", "p2", "p3"]) {
      expect(wrapper(title)).not.toHaveClass("fixed");
      expect(wrapper(title)).not.toHaveClass("invisible");
      expect(wrapper(title)).not.toHaveAttribute("inert");
    }
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(button("p2", labels.maximizePane)).toBeInTheDocument();
  });

  it("fits the terminal to the new size on maximize and back on restore (SRS-FR-043)", async () => {
    const { user, sessions, adapters } = await threePanes();
    adapters[1].size = { cols: 200, rows: 50 };

    await user.click(button("p2", labels.maximizePane));
    expect(sessions.resize).toHaveBeenLastCalledWith("p2", 200, 50);

    adapters[1].size = { cols: 80, rows: 24 };
    await user.click(button("p2", labels.restorePane));
    expect(sessions.resize).toHaveBeenLastCalledWith("p2", 80, 24);
  });

  it("restores the layout before a new pane opens (SRS-FR-046)", async () => {
    const { user } = await threePanes();
    await user.click(button("p1", labels.maximizePane));

    // Clicked directly, as jsdom ignores inert: the guard must hold whatever starts the session.
    fireEvent.click(plusOf("agent-deck"));
    await user.click(within(chooser()).getByRole("button", { name: labels.newSession }));

    await screen.findByRole("region", { name: "agent-deck · p4" });
    expect(wrapper("p1")).not.toHaveClass("fixed");
    expect(wrapper("p2")).not.toHaveClass("invisible");
    expect(sidebar()).not.toHaveAttribute("inert");
    const rect = (title: string) => ["left", "width"].map((k) => parseFloat(wrapper(title).style.getPropertyValue(k)));
    expect(rect("p4")[0]).toBeCloseTo(rect("p1")[0] + rect("p1")[1]);
  });

  const badge = (title: string) => within(paneNamed(title)).queryByRole("button", { name: new RegExp(`${labels.othersBadge(0).replace(/^0 /, "")}$`) });

  it("counts the other sessions that need the user on the maximized pane (SRS-FR-044)", async () => {
    const { user, sessions } = await threePanes();
    const [p1, p2, p3] = sessions.opened.map((o) => o.stream);
    await user.click(button("p1", labels.maximizePane));

    act(() => p1.status({ state: "Needs Approval" }));
    act(() => p3.status({ state: "Running" }));
    expect(badge("p1")).not.toBeInTheDocument();

    act(() => p3.status({ state: "Needs Approval" }));
    expect(badge("p1")).toHaveAccessibleName(labels.othersBadge(1));
    expect(badge("p1")).toHaveTextContent(labels.othersBadgeText(1));
    expect(badge("p1")).toHaveClass("chip-app");

    act(() => p2.status({ state: "Error", reason: "overloaded" }));
    expect(badge("p1")).toHaveAccessibleName(labels.othersBadge(2));
    expect(badge("p1")).toHaveClass("chip-err");
    expect(badge("p2")).not.toBeInTheDocument();
  });

  it("restores and focuses the most urgent session when the badge is clicked (SRS-FR-045)", async () => {
    const { user, sessions } = await threePanes();
    const [, p2, p3] = sessions.opened.map((o) => o.stream);
    await user.click(button("p1", labels.maximizePane));
    act(() => p2.status({ state: "Needs Approval", since: new Date(2026, 9, 17, 14, 0).getTime() }));
    act(() => p3.status({ state: "Error", since: new Date(2026, 9, 17, 14, 5).getTime() }));
    // A browser ignores focus() inside an inert subtree, so the fake records whether the pane was still inert.
    const focusedWhileInert: boolean[] = [];
    vi.spyOn(composerOf(paneNamed("p3")), "focus").mockImplementation(() => focusedWhileInert.push(wrapper("p3").hasAttribute("inert")));

    await user.click(badge("p1")!);

    expect(wrapper("p1")).not.toHaveClass("fixed");
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(focusedWhileInert).toEqual([false]);
    expect(badge("p1")).not.toBeInTheDocument();
  });

  it("shows the other panes again when the maximized pane is closed", async () => {
    const { user } = await threePanes();
    await user.click(button("p2", labels.maximizePane));

    await closeVia(user, labels.close, screen.getByRole("region", { name: "agent-deck · p2" }));

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
    expect(button("p2", labels.restorePane)).toBeInTheDocument();
  });

  it("leaves the pane as it is on a double-click inside the terminal or on a header button (SRS-FR-066)", async () => {
    const { user } = await threePanes();

    await user.dblClick(paneNamed("p2").querySelector("[data-pane-body]")!);
    await user.dblClick(viewItem(paneNamed("p2"), labels.views.shell));

    await vi.waitFor(() => expect(viewItem(paneNamed("p2"), labels.views.shell)).toHaveAttribute("aria-pressed", "true"));
    expect(wrapper("p2")).not.toHaveClass("fixed");
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(button("p2", labels.maximizePane)).toBeInTheDocument();
  });

  // A browser sends dblclick to whatever is under the second press, even when the first click moved it there.
  it("toggles nothing extra when the first press of a double-click hit a header button (SRS-FR-066)", async () => {
    await threePanes();
    const maximizeP2 = button("p2", labels.maximizePane);
    fireEvent.mouseDown(maximizeP2, { detail: 1 });
    fireEvent.click(maximizeP2, { detail: 1 });
    fireEvent.mouseDown(header("p2"), { detail: 2 });
    fireEvent.dblClick(header("p2"), { detail: 2 });
    expect(wrapper("p2")).toHaveClass("fixed");

    fireEvent.mouseDown(header("p1"), { detail: 1 });
    fireEvent.mouseLeave(header("p1"));
    fireEvent.mouseDown(button("p2", labels.restorePane), { detail: 1 });
    fireEvent.click(button("p2", labels.restorePane), { detail: 1 });
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
    expect(button("p2", labels.maximizePane)).toBeInTheDocument();
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
    await newSessionIn(user, "agent-deck");
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
    await newSessionIn(user, "agent-deck");
    const pane = await screen.findByRole("region", { name: /^agent-deck · / });
    await user.click(viewItem(pane, labels.views.shell));
    await vi.waitFor(() => expect(adapters).toHaveLength(2));
    const [session, shell] = adapters;
    session.size = { cols: 72, rows: 20 };
    shell.size = { cols: 72, rows: 6 };

    await press("=");

    await vi.waitFor(() => expect(sessions.resize).toHaveBeenLastCalledWith(sessions.opened[0].pane.paneId, 72, 20));
    expect(sessions.shellResize).toHaveBeenLastCalledWith(sessions.opened[0].pane.paneId, 72, 6);
  });

  it("fits the hidden Pane Shell after a change while Term is shown (SRS-FR-072)", async () => {
    const { user, sessions, adapters } = zoomSetup();
    await newSessionIn(user, "agent-deck");
    const pane = await screen.findByRole("region", { name: /^agent-deck · / });
    await user.click(viewItem(pane, labels.views.shell));
    await vi.waitFor(() => expect(adapters).toHaveLength(2));
    await user.click(viewItem(pane, labels.views.term));
    adapters[1].size = { cols: 72, rows: 6 };

    await press("=");

    await vi.waitFor(() => expect(sessions.shellResize).toHaveBeenLastCalledWith(sessions.opened[0].pane.paneId, 72, 6));
  });
});

describe("Sidebar toggle (2.13)", () => {
  const toggle = (name: string) => screen.getByRole("button", { name });
  const sidebarGone = () => expect(screen.queryByRole("complementary", { name: labels.sidebar })).not.toBeInTheDocument();
  async function press(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean }, target: Element | Document = document) {
    let notPrevented = true;
    await act(async () => {
      notPrevented = fireEvent.keyDown(target, { key, ...mods });
    });
    return notPrevented;
  }

  it("starts shown, hides and shows with the button, and keeps the fold of a workspace (SRS-FR-088, SRS-FR-090)", async () => {
    const { user } = setup([ws("a", "agent-deck")]);
    await newSessionIn(user);
    await user.click(await within(sidebar()).findByRole("button", { name: labels.collapse("agent-deck") }));
    const grid = sidebar().parentElement!;
    expect(grid.className).toContain("--sidebar-w");
    expect(toggle(labels.hideSidebar)).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle(labels.hideSidebar));

    sidebarGone();
    expect(grid.className).not.toContain("--sidebar-w");
    expect(toggle(labels.showSidebar)).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle(labels.showSidebar));

    expect(within(sidebar()).getByRole("button", { name: labels.expand("agent-deck") })).toHaveAttribute("aria-expanded", "false");
    expect(grid.className).toContain("--sidebar-w");
  });

  it("takes Cmd+B from a focused pane on macOS and leaves the focus there (SRS-FR-089)", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions(), undefined, { mac: true });
    await newSessionIn(user, "agent-deck");
    const pane = (await screen.findAllByRole("region")).find((r) => r.querySelector("[data-pane-body]"))!;
    fireEvent.focus(pane);
    const paneHeard = vi.fn();
    pane.addEventListener("keydown", paneHeard);

    expect(await press("b", { metaKey: true }, pane.querySelector("[data-pane-body]")!)).toBe(false);

    expect(paneHeard).not.toHaveBeenCalled();
    sidebarGone();
    expect(pane).toHaveClass("pane-focus");

    await press("b", { metaKey: true });
    expect(sidebar()).toBeInTheDocument();
  });

  it("leaves Ctrl+B and Ctrl+H to the terminal on macOS (SRS-FR-089)", async () => {
    setup([ws("a", "agent-deck")], fakeSessions(), undefined, { mac: true });
    await findWorkspace("agent-deck");

    expect(await press("b", { ctrlKey: true })).toBe(true);
    expect(await press("h", { ctrlKey: true })).toBe(true);

    expect(sidebar()).toBeInTheDocument();
  });

  it("uses Ctrl+B on Windows (SRS-FR-089)", async () => {
    setup([ws("a", "agent-deck")]);
    await findWorkspace("agent-deck");

    expect(await press("b", { ctrlKey: true })).toBe(false);

    sidebarGone();
  });

  // Hiding the Sidebar under a dialog would leave its opener hidden, so closing it would drop focus on body.
  it("leaves the Sidebar alone while the Session Chooser or a confirm dialog is open", async () => {
    const sessions = fakeSessions({ list: vi.fn(async () => ({ sessions: [{ id: "s-a", title: "Old work", lastActivity: 1 }], unreadable: 0 })) });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await openChooser(user);

    await press("b", { ctrlKey: true });
    expect(sidebar()).toBeInTheDocument();

    await user.click(await within(chooser()).findByRole("button", { name: labels.deleteSession("Old work") }));
    expect(screen.getByRole("dialog", { name: labels.trashTitle("Old work") })).toBeInTheDocument();
    await press("b", { ctrlKey: true });
    expect(sidebar()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: labels.cancel }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(plusOf("agent-deck")).toHaveFocus();
    await press("b", { ctrlKey: true });
    sidebarGone();
  });
});

describe("Jump from the Folder Tree (2.3)", () => {
  const since = new Date(2026, 9, 16, 14, 2).getTime();
  const rowButton = (title: string) => within(sessionRow(title)).getByRole("button");

  async function twoPanesSecondAsking() {
    const listed = { sessions: [{ id: "old", title: "Old work", lastActivity: 1 }], unreadable: 0 };
    const sessions = fakeSessions({ titles: ["First", "Second"], list: vi.fn(async () => listed) });
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await newSessionIn(ctx.user);
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    await within(sidebar()).findByText("Second");
    act(() => ctx.sessions.opened[1].stream.status({ state: "Needs Approval", since, reason: "Edit src/main.rs" }));
    // In Term, so the next key reaches the session terminal.
    for (const pane of panes()) await ctx.user.click(viewItem(pane, labels.views.term));
    fireEvent.focus(panes()[0]);
    expect(panes()[0]).toHaveClass("pane-focus");
    return { ...ctx, focusCalls: vi.mocked(ctx.adapters[1].focus).mock.calls.length };
  }

  // The Focus Outline moves onto the pane asking for approval, over its status border (SRS-FR-087).
  function expectJumpedToSecond(adapters: FakeAdapter[], focusCalls: number) {
    expect(panes()[0]).not.toHaveClass("pane-focus");
    expect(panes()[1]).toHaveClass("pane-focus", "pane-app");
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
    expect(panes()[0]).toHaveClass("pane-focus");
  });
});

describe("Row Focus Mark (2.3)", () => {
  const marked = () => [...sidebar().querySelectorAll(".side-on")];

  async function twoIdlePanes() {
    const sessions = fakeSessions({ titles: ["First", "Second"] });
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await newSessionIn(ctx.user);
    await vi.waitFor(() => expect(panes()).toHaveLength(2));
    await within(sidebar()).findByText("Second");
    return ctx;
  }

  it("marks only the row of the idle pane the user clicks into (SRS-FR-099)", async () => {
    await twoIdlePanes();

    fireEvent.focus(panes()[1]);

    expect(marked()).toEqual([sessionRow("Second")]);
    expect(sessionRow("Second")).toHaveAttribute("aria-current", "location");
    expect(workspaceRow("agent-deck")).toHaveAttribute("aria-current", "true");
    expect(sessionRow("First")).not.toHaveAttribute("aria-current");
  });

  it("keeps the yellow tint of a Needs Approval row under the iris bar (SRS-FR-099)", async () => {
    const { sessions } = await twoIdlePanes();
    act(() => sessions.opened[0].stream.status({ state: "Needs Approval" }));

    fireEvent.focus(panes()[0]);

    expect(sessionRow("First")).toHaveClass("side-on", "row-app");
    expect(within(sessionRow("First")).getByText(labels.state["Needs Approval"])).toBeInTheDocument();
    expect(marked()).toEqual([sessionRow("First")]);
  });

  it("moves the mark to the row the user jumps from (SRS-FR-099)", async () => {
    const { user } = await twoIdlePanes();
    fireEvent.focus(panes()[1]);

    await user.click(within(sessionRow("First")).getByRole("button"));

    expect(marked()).toEqual([sessionRow("First")]);
  });

  it("marks no row while no pane is focused or once the focused pane has closed (SRS-FR-099)", async () => {
    const { sessions } = await twoIdlePanes();
    fireEvent.focus(panes()[1]);

    act(() => sessions.opened[1].stream.exit(0));
    await vi.waitFor(() => expect(panes()).toHaveLength(1));

    expect(marked()).toEqual([]);
  });
});


describe("Delete a session (2.2 to 2.4)", () => {
  type Row = { id: string; title: string; lastActivity: number };

  /** `before`: rows already on disk ahead of the two old sessions, such as the one a pane will open as "s1". Leaves the chooser open. */
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
    await openChooser(ctx.user);
    await within(chooser()).findByText("Old work");
    return { ...ctx, drop: (id: string) => (rows = rows.filter((r) => r.id !== id)) };
  }

  /** "Phiên mới" in the open chooser; with `reopen`, the chooser again once the pane runs "Live work". */
  async function startLiveWork(user: ReturnType<typeof userEvent.setup>, reopen = true) {
    await user.click(within(chooser()).getByRole("button", { name: labels.newSession }));
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    if (!reopen) return;
    await openChooser(user);
    await within(chooser()).findByText("Live work");
  }

  const trash = (title: string) => within(chooserRow(title)).getByRole("button", { name: labels.deleteSession(title) });
  const pick = (user: ReturnType<typeof userEvent.setup>, title: string) => user.click(trash(title));
  const confirmFor = (name: string) => screen.queryByRole("dialog", { name });

  it("asks before deleting and Cancel keeps the session (SRS-FR-048)", async () => {
    const { user, sessions } = await folderWithSessions();

    await pick(user, "Old work");

    const dialog = screen.getByRole("dialog", { name: labels.trashTitle("Old work") });
    expect(within(dialog).getByText(labels.restoreHint)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: labels.cancel }));
    expect(confirmFor(labels.trashTitle("Old work"))).not.toBeInTheDocument();
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    expect(within(chooser()).getByText("Old work")).toBeInTheDocument();
  });

  it("moves the session to the Trash and reads the list again (SRS-FR-047)", async () => {
    const { user, sessions } = await folderWithSessions();

    await pick(user, "Old work");
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "old", undefined);
    await vi.waitFor(() => expect(within(chooser()).queryByText("Old work")).not.toBeInTheDocument());
    expect(within(chooser()).getByText("Init repo")).toBeInTheDocument();
    expect(confirmFor(labels.trashTitle("Old work"))).not.toBeInTheDocument();
  });

  it("ends an open session and closes its pane as part of the delete (SRS-FR-049)", async () => {
    const { user, sessions } = await folderWithSessions();
    await startLiveWork(user);

    await pick(user, "Live work");

    const dialog = screen.getByRole("dialog", { name: labels.closeAndTrashTitle("Live work") });
    expect(within(dialog).getByText(labels.endsSession)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: labels.closeAndMove }));

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", "p1");
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Live work" })).not.toBeInTheDocument());
  });

  it("keeps the session and says so when it cannot be moved (SRS-FR-050)", async () => {
    const { user } = await folderWithSessions({ deleteSession: vi.fn(async () => Promise.reject("locked")) });

    await pick(user, "Old work");
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.deleteFailed);
    expect(within(chooser()).getByText("Old work")).toBeInTheDocument();
  });

  it("ignores a second Delete while the first one is still running", async () => {
    let finish: () => void = () => {};
    const { user, sessions } = await folderWithSessions({
      deleteSession: vi.fn(() => new Promise<void>((r) => (finish = r))),
    });

    await pick(user, "Old work");
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));
    await pick(user, "Old work");

    expect(confirmFor(labels.trashTitle("Old work"))).not.toBeInTheDocument();
    expect(sessions.deleteSession).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it("leaves a pane that runs another session alone", async () => {
    const { user } = await folderWithSessions({ deleteSession: vi.fn(async () => Promise.reject("wrong_pane")) });
    await startLiveWork(user);

    await pick(user, "Live work");
    await user.click(screen.getByRole("button", { name: labels.closeAndMove }));

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.deleteFailed);
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
    await startLiveWork(user, false);
    act(() => sessions.opened[0].stream.exit(1));
    await openChooser(user);
    await within(chooser()).findByText("Live work");

    await pick(user, "Live work");
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", undefined);
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Live work" })).not.toBeInTheDocument());
  });

  it("keeps the session in the history when its pane is closed with Close (SRS-FR-029)", async () => {
    const { user, sessions } = await folderWithSessions({}, [{ id: "s1", title: "Live work", lastActivity: 3 }]);
    await startLiveWork(user, false);

    await closeVia(user);

    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    await openChooser(user);
    expect(await within(chooser()).findByText("Live work")).toBeInTheDocument();
    expect(chooserRow("Live work")).not.toHaveTextContent(labels.live);
  });

  it("closes the pane and moves its session to the Trash with no second question (SRS-FR-101)", async () => {
    const { user, sessions } = await folderWithSessions({}, [{ id: "s1", title: "Live work", lastActivity: 3 }]);
    await startLiveWork(user, false);
    act(() => sessions.opened[0].stream.status({ state: "Running" }));

    await closeVia(user, labels.closeAndTrash);

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", "p1");
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await openChooser(user);
    await within(chooser()).findByText("Old work");
    expect(within(chooser()).queryByText("Live work")).not.toBeInTheDocument();
  });

  it("moves the session of an ended pane to the Trash (SRS-FR-101)", async () => {
    const { user, sessions } = await folderWithSessions();
    await startLiveWork(user, false);
    act(() => sessions.opened[0].stream.exit(1));

    await closeVia(user, labels.closeAndTrash);

    expect(sessions.deleteSession).toHaveBeenCalledWith("a", "s1", undefined);
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
  });

  it("closes the pane but keeps the session when it cannot be moved (SRS-FR-102)", async () => {
    const { user } = await folderWithSessions({ deleteSession: vi.fn(async () => Promise.reject("locked")) }, [{ id: "s1", title: "Live work", lastActivity: 3 }]);
    await startLiveWork(user, false);

    await closeVia(user, labels.closeAndTrash);

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.deleteFailed);
    await vi.waitFor(() => expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument());
    await openChooser(user);
    expect(await within(chooser()).findByText("Live work")).toBeInTheDocument();
  });

  it("still closes the pane when a Delete of its session is already running (SRS-FR-101)", async () => {
    let finish: () => void = () => {};
    const { user, sessions } = await folderWithSessions(
      { deleteSession: vi.fn(() => new Promise<void>((r) => (finish = r))) },
      [{ id: "s1", title: "Live work", lastActivity: 3 }],
    );
    await startLiveWork(user);
    await pick(user, "Live work");
    await user.click(screen.getByRole("button", { name: labels.closeAndMove }));
    await closeChooser(user);

    await closeVia(user, labels.closeAndTrash);

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
    await ctx.user.click(screen.getByRole("button", { name: labels.moveToTrash }));

    await vi.waitFor(() => expect(within(chooser()).queryByText("Old work")).not.toBeInTheDocument());
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
    await openChooser(ctx.user);
    await within(chooser()).findByText("Scaffold Tauri app");
    return ctx;
  }

  const box = (title: string) => within(chooser()).getByRole("checkbox", { name: labels.select(title) });
  const bar = (name: string | RegExp) => within(chooser()).queryByRole("button", { name });

  it("ticks rows into the selection without opening anything (SRS-FR-073, SRS-FR-074)", async () => {
    const { user, sessions } = await folderWithSessions();
    expect(bar(new RegExp(`^${labels.deleteSelected(0).split(" (")[0]}`))).not.toBeInTheDocument();
    expect(bar(labels.selectAll)).not.toBeInTheDocument();

    await user.click(box("Scaffold Tauri app"));
    await user.click(box("Fix login bug"));

    expect(bar(labels.deleteSelected(2))).toBeInTheDocument();
    expect(bar(labels.selectAll)).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();

    await user.click(box("Scaffold Tauri app"));
    expect(bar(labels.deleteSelected(1))).toBeInTheDocument();
    await user.click(box("Fix login bug"));
    expect(bar(new RegExp(`^${labels.deleteSelected(0).split(" (")[0]}`))).not.toBeInTheDocument();
  });

  it("selects every listed session with Select all (SRS-FR-075)", async () => {
    const { user } = await folderWithSessions();
    await user.click(box("Init repo"));

    await user.click(bar(labels.selectAll)!);

    expect(bar(labels.deleteSelected(3))).toBeInTheDocument();
    for (const title of ["Scaffold Tauri app", "Fix login bug", "Init repo"]) expect(box(title)).toBeChecked();
  });

  it("asks once and Cancel keeps everything (SRS-FR-077)", async () => {
    const { user, sessions } = await folderWithSessions();
    await user.click(box("Init repo"));
    await user.click(bar(labels.selectAll)!);

    await user.click(bar(labels.deleteSelected(3))!);

    const dialog = screen.getByRole("dialog", { name: labels.trashManyTitle(3) });
    await user.click(within(dialog).getByRole("button", { name: labels.cancel }));
    expect(sessions.deleteSession).not.toHaveBeenCalled();
    expect(bar(labels.deleteSelected(3))).toBeInTheDocument();
  });

  it("closes the open one and deletes each selected session in turn (SRS-FR-077, SRS-FR-078)", async () => {
    const { user, sessions } = await folderWithSessions();
    await user.click(within(chooser()).getByRole("button", { name: labels.newSession }));
    await screen.findByRole("region", { name: "agent-deck · Live work" });
    await openChooser(user);
    await within(chooser()).findByText("Live work");
    await user.click(box("Live work"));
    await user.click(box("Fix login bug"));
    await user.click(box("Init repo"));

    await user.click(bar(labels.deleteSelected(3))!);
    const dialog = screen.getByRole("dialog", { name: labels.closeAndTrashManyTitle(1, 3) });
    await user.click(within(dialog).getByRole("button", { name: labels.closeAndMove }));

    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(3));
    expect(vi.mocked(sessions.deleteSession).mock.calls).toEqual([
      ["a", "s1", "p1"],
      ["a", "s-b", undefined],
      ["a", "s-c", undefined],
    ]);
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "agent-deck · Live work" })).not.toBeInTheDocument());
    await vi.waitFor(() => expect(within(chooser()).queryByText("Init repo")).not.toBeInTheDocument());
    expect(within(chooser()).queryByText("Fix login bug")).not.toBeInTheDocument();
    expect(within(chooser()).getByText("Scaffold Tauri app")).toBeInTheDocument();
    expect(bar(new RegExp(`^${labels.deleteSelected(0).split(" (")[0]}`))).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deletes one session at a time and takes no other delete meanwhile (SRS-FR-078)", async () => {
    const finish: (() => void)[] = [];
    const { user, sessions } = await folderWithSessions({
      deleteSession: vi.fn(() => new Promise<void>((r) => finish.push(r))),
    });
    await user.click(box("Init repo"));
    await user.click(box("Fix login bug"));
    await user.click(bar(labels.deleteSelected(2))!);
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));

    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(1));
    expect(bar(labels.deleteSelected(2))).toBeDisabled();
    await user.click(within(chooser()).getByRole("button", { name: labels.deleteSession("Scaffold Tauri app") }));
    expect(screen.queryByRole("dialog", { name: labels.trashTitle("Scaffold Tauri app") })).not.toBeInTheDocument();

    await act(async () => finish[0]());
    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(2));
    await act(async () => finish[1]());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the selection bar below the rows, so ticking moves no row (SRS-FR-074)", async () => {
    const { user } = await folderWithSessions();
    const rowsBefore = chooserList();

    await user.click(box("Init repo"));

    const deleteSelected = bar(labels.deleteSelected(1))!;
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
    await user.click(bar(labels.selectAll)!);

    await user.click(bar(labels.deleteSelected(3))!);
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.deletedSome(2, 3));
    await vi.waitFor(() => expect(within(chooser()).queryByText("Init repo")).not.toBeInTheDocument());
    expect(box("Fix login bug")).toBeChecked();
    expect(bar(labels.deleteSelected(1))).toBeInTheDocument();
  });

  it("ticks nothing on reopen when the chooser was closed while the deletes ran (SRS-FR-076)", async () => {
    let fail: (reason: string) => void = () => {};
    const { user, sessions } = await folderWithSessions({
      deleteSession: vi.fn(() => new Promise<void>((_, reject) => (fail = reject))),
    });
    await user.click(box("Fix login bug"));
    await user.click(bar(labels.deleteSelected(1))!);
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));
    await vi.waitFor(() => expect(sessions.deleteSession).toHaveBeenCalledTimes(1));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => fail("locked"));
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.deletedSome(0, 1));

    await openChooser(user);
    await within(chooser()).findByText("Fix login bug");
    expect(box("Fix login bug")).not.toBeChecked();
    expect(bar(labels.deleteSelected(1))).not.toBeInTheDocument();
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
    fireEvent.click(plusOf("agent-deck"));
    fireEvent.click(within(chooser()).getByRole("button", { name: labels.newSession }));
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
  const stashList = () => within(sidebar()).getByRole("list", { name: labels.stashedSessions });
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
  const STASH_GROUP = new RegExp(`^${escapeRe(labels.stashedCount(0)).replace("0", "\\d+")}$`);
  /** SRS-FR-107: with nothing stashed the group is gone, title and all. */
  const expectNoStashGroup = () => {
    expect(within(sidebar()).queryByRole("list", { name: labels.stashedSessions })).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText(STASH_GROUP)).not.toBeInTheDocument();
  };

  it("is the last group of the Folder Tree, after Folder khác and before Thêm folder, newest first (SRS-FR-106)", async () => {
    seed(stashed("s2", "Scaffold Tauri app", "a", "agent-deck", 2), stashed("s1", "Fix login bug", "b", "mokairo", 1));
    setup([ws("a", "agent-deck"), ws("b", "mokairo")], fakeSessions({ list: onDisk("s1", "s2") }));
    const group = await within(sidebar()).findByText(labels.stashedCount(2));
    const other = otherFolders()!;
    const add = within(sidebar()).getByRole("button", { name: labels.addFolder });
    expect(other.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(stashList()).getAllByRole("listitem").map((r) => r.textContent)).toEqual([
      expect.stringContaining("Scaffold Tauri app"),
      expect.stringContaining("Fix login bug"),
    ]);
  });

  it("has no Để dành group while nothing is stashed, nor after the last × (SRS-FR-107)", async () => {
    setup([ws("a", "agent-deck")]);
    await findWorkspace("agent-deck");
    expectNoStashGroup();
    expect(within(sidebar()).queryByText("Chưa để dành phiên nào")).not.toBeInTheDocument();
    cleanup();

    seed(stashed("s1", "Fix login bug"));
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list: onDisk("s1") }));
    await within(sidebar()).findByText(labels.stashedCount(1));
    await user.click(within(stashRow("Fix login bug")).getByRole("button", { name: labels.unstash("Fix login bug") }));
    expectNoStashGroup();
  });

  it("shows × only on hover or keyboard focus (SRS-FR-110)", async () => {
    seed(stashed("s1", "Fix login bug"));
    setup([ws("a", "agent-deck")], fakeSessions({ list: onDisk("s1") }));
    await within(sidebar()).findByText("Fix login bug");
    const remove = within(stashRow("Fix login bug")).getByRole("button", { name: labels.unstash("Fix login bug") });
    expect(remove).toHaveClass("opacity-0", "group-hover:opacity-100", "focus-visible:opacity-100");
    expect(remove.closest("li")).toHaveClass("group");
  });

  it("lists the stashed sessions kept from the last launch, in order, with their folder (SRS-FR-106, SRS-FR-111)", async () => {
    seed(stashed("s2", "Scaffold Tauri app", "a", "agent-deck", 2), stashed("s1", "Fix login bug", "b", "mokairo", 1));
    setup([ws("a", "agent-deck"), ws("b", "mokairo")], fakeSessions({ list: onDisk("s1", "s2") }));
    await findWorkspace("agent-deck");
    const rows = within(stashList()).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Scaffold Tauri app"),
      expect.stringContaining("Fix login bug"),
    ]);
    expect(within(stashRow("Fix login bug")).getByText("mokairo")).toBeInTheDocument();
    expect(within(sidebar()).getByText(labels.stashedCount(2))).toBeInTheDocument();
  });

  async function openPane(sessions = fakeSessions({ titles: ["Fix login bug"] }), title = "Fix login bug") {
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    await screen.findByRole("region", { name: `agent-deck · ${labels.title(title)}` });
    return { ...ctx, stream: sessions.opened[0].stream };
  }
  const stashButton = () => screen.getByRole("button", { name: labels.stashSession });

  it("puts Stash just left of Maximize, before ×, on every pane (SRS-FR-103)", async () => {
    await openPane();
    const header = screen.getByRole("region", { name: "agent-deck · Fix login bug" }).querySelector("header")!;
    const names = within(header)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"))
      .slice(-3);
    expect(names).toEqual([labels.stashSession, labels.maximizePane, labels.closePane]);
    expect(stashButton()).toBeEnabled();
  });

  it("disables Stash while the session has no history yet (SRS-FR-103)", async () => {
    const { user, sessions } = await openPane(fakeSessions({ title: vi.fn(() => new Promise<string>(() => {})) }), "(untitled)");
    expect(stashButton()).toBeDisabled();
    await user.click(stashButton());
    expect(sessions.close).not.toHaveBeenCalled();
    expectNoStashGroup();
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
    await screen.findByText(new RegExp(labels.closeFailed));
    expect(screen.getByRole("region", { name: "agent-deck · Fix login bug" })).toBeInTheDocument();
    expectNoStashGroup();
  });

  it("asks before stashing a Running pane; Cancel keeps it, Stash stashes it (SRS-FR-105)", async () => {
    const { user, sessions, stream } = await openPane();
    act(() => stream.status({ state: "Running" }));
    await user.click(stashButton());
    const dialog = screen.getByRole("dialog", { name: labels.stashTitle("Fix login bug") });
    expect(within(dialog).getByText(labels.sessionBusy)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: labels.cancel }));
    expect(sessions.close).not.toHaveBeenCalled();
    expectNoStashGroup();

    await user.click(stashButton());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: labels.stash }));
    await within(stashList()).findByText("Fix login bug");
    expect(sessions.close).toHaveBeenCalledWith("p1");
  });

  it("asks before stashing a pane whose shell runs a command (SRS-FR-105)", async () => {
    const { user } = await openPane(
      fakeSessions({ titles: ["Fix login bug"], shellActivity: vi.fn(async () => ({ busy: true, command: "npm run dev" })) }),
    );
    await user.click(viewItem(panes()[0], labels.views.shell));
    await user.click(stashButton());
    const dialog = await screen.findByRole("dialog", { name: labels.stashTitle("Fix login bug") });
    expect(within(dialog).getByText(labels.shellBusy)).toBeInTheDocument();
  });

  it("resumes a stashed session in a new pane and drops its row (SRS-FR-108, SRS-FR-109)", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const { user, sessions } = setup([ws("a", "agent-deck")], fakeSessions({ titles: ["Fix login bug"], list: onDisk("old-1") }));
    await user.click(await within(stashList()).findByRole("button", { name: /^Fix login bug/ }));
    expect(await screen.findByRole("region", { name: "agent-deck · Fix login bug" })).toBeInTheDocument();
    expect(sessions.open).toHaveBeenCalledWith("a", expect.any(Number), expect.any(Number), "old-1");
    expectNoStashGroup();
    // useStash writes storage in an effect, which React may run after this render.
    await vi.waitFor(() => expect(stored()).toEqual([]));
  });

  it("refuses a Missing folder with Folder not found and keeps the row (SRS-FR-108)", async () => {
    seed(stashed("old-1", "Fix login bug", "b", "mokairo"));
    const { user, sessions } = setup([ws("a", "agent-deck"), ws("b", "mokairo", true)]);
    await findWorkspace("mokairo");
    await user.click(within(stashList()).getByRole("button", { name: /^Fix login bug/ }));
    expect(await screen.findByText(labels.folderNotFound)).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();
    expect(within(stashList()).getByText("Fix login bug")).toBeInTheDocument();
  });

  it("refuses a folder no longer in the list with Folder not found and keeps the row", async () => {
    seed(stashed("old-1", "Fix login bug", "gone", "mokairo"));
    const { user, sessions } = setup([ws("a", "agent-deck")]);
    await user.click(await within(stashList()).findByRole("button", { name: /^Fix login bug/ }));
    expect(await screen.findByText(labels.folderNotFound)).toBeInTheDocument();
    expect(sessions.open).not.toHaveBeenCalled();
    expect(within(stashRow("Fix login bug")).getByText("mokairo")).toBeInTheDocument();
  });

  it("keeps the row when Claude Code does not start", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ started: false, list: onDisk("old-1") }));
    await user.click(await within(stashList()).findByRole("button", { name: /^Fix login bug/ }));
    await screen.findAllByText(labels.startFailed);
    expect(within(stashList()).getByText("Fix login bug")).toBeInTheDocument();
  });

  it("drops the row when the session is resumed from the Session Chooser (SRS-FR-109)", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const list = vi.fn(async () => ({ sessions: [{ id: "old-1", title: "Fix login bug", lastActivity: 1 }], unreadable: 0 }));
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ list, titles: ["Fix login bug"] }));
    await openChooser(user);
    await user.click(await within(chooser()).findByRole("button", { name: /^Fix login bug/ }));
    await screen.findByRole("region", { name: "agent-deck · Fix login bug" });
    expectNoStashGroup();
  });

  it("drops the row of a session deleted from the Session Chooser (SRS-FR-112)", async () => {
    seed(stashed("old-1", "Fix login bug"));
    let rows = [{ id: "old-1", title: "Fix login bug", lastActivity: 1 }];
    const sessions = fakeSessions({
      list: vi.fn(async () => ({ sessions: [...rows], unreadable: 0 })),
      deleteSession: vi.fn(async () => void (rows = [])),
    });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await openChooser(user);
    await user.click(await within(chooser()).findByRole("button", { name: labels.deleteSession("Fix login bug") }));
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));
    await vi.waitFor(expectNoStashGroup);
  });

  it("keeps the row when the delete fails", async () => {
    seed(stashed("old-1", "Fix login bug"));
    const sessions = fakeSessions({
      list: vi.fn(async () => ({ sessions: [{ id: "old-1", title: "Fix login bug", lastActivity: 1 }], unreadable: 0 })),
      deleteSession: vi.fn(async () => Promise.reject("locked")),
    });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await openChooser(user);
    await user.click(await within(chooser()).findByRole("button", { name: labels.deleteSession("Fix login bug") }));
    await user.click(screen.getByRole("button", { name: labels.moveToTrash }));
    await screen.findByText(labels.deleteFailed);
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
    await user.click(within(stashRow("Fix login bug")).getByRole("button", { name: labels.unstash("Fix login bug") }));
    expectNoStashGroup();
    expect(stored()).toEqual([]);
    expect(sessions.open).not.toHaveBeenCalled();
    expect(sessions.deleteSession).not.toHaveBeenCalled();
  });
});

describe("No Status Summary (CR-014)", () => {
  const since = new Date(2026, 9, 16, 14, 2).getTime();

  async function openPanes(count: number) {
    const sessions = fakeSessions({ titles: ["First", "Second", "Third"] });
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user, "agent-deck");
    for (let n = 2; n <= count; n++) {
      await newSessionIn(ctx.user);
      await vi.waitFor(() => expect(panes()).toHaveLength(n));
    }
    await within(sidebar()).findByText("First");
    return ctx;
  }

  function expectNoSummary() {
    expect(screen.queryByRole("region", { name: "Status Summary" })).not.toBeInTheDocument();
    expect(screen.queryByText("All clear")).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`${labels.othersBadgeText(0).replace(/^0 /, "")}$`))).not.toBeInTheDocument();
    // The Sidebar title (CR-016) is the only "Agent Deck" heading; the old summary headline is gone.
    const titles = screen.queryAllByRole("heading", { name: "Agent Deck" });
    expect(titles.every((h) => h.closest("aside") !== null)).toBe(true);
    expect(screen.queryByText("No sessions running")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Go to/ })).not.toBeInTheDocument();
  }

  it("shows no summary with no pane open (SRS-FR-135 deleted)", () => {
    setup([ws("a", "agent-deck")]);
    expectNoSummary();
  });

  it("shows no summary while sessions run or need the user (SRS-FR-132 to SRS-FR-134 deleted)", async () => {
    const { sessions } = await openPanes(2);
    act(() => sessions.opened[0].stream.status({ state: "Running", since }));
    expectNoSummary();
    act(() => sessions.opened[1].stream.status({ state: "Needs Approval", since, reason: "Edit a" }));
    expectNoSummary();
  });

  it("offers no Status Latency button, with or without a maximized pane (SRS-FR-039 deleted)", async () => {
    const { user } = await openPanes(1);
    expect(screen.queryByRole("button", { name: "Status Latency" })).not.toBeInTheDocument();
    await user.click(within(panes()[0]).getByRole("button", { name: labels.maximizePane }));
    expect(screen.queryByRole("button", { name: "Status Latency" })).not.toBeInTheDocument();
  });

  it("anchors a maximized pane at the top of the window", async () => {
    const { user } = await openPanes(1);
    await user.click(within(panes()[0]).getByRole("button", { name: labels.maximizePane }));
    const wrapper = panes()[0].closest(".fixed")!;
    expect(wrapper).toHaveClass("inset-0");
    expect(wrapper).not.toHaveClass("top-9");
  });

  it("puts the Sidebar and the panes flush against the window edges, with no gap (CR-016)", () => {
    setup([ws("a", "agent-deck")]);
    const grid = sidebar().parentElement!;
    expect(grid).toHaveClass("grid");
    expect(grid.className).not.toMatch(/(^|\s)(gap|p[xytb]?)-/);
  });
});

describe("Confirm dialog focus", () => {
  it("returns focus to the pane on Cancel", async () => {
    const sessions = fakeSessions({ titles: ["First"] });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(user, "agent-deck");
    await within(sidebar()).findByText("First");
    await user.click(within(panes()[0]).getByRole("button", { name: labels.closePane }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: labels.cancel })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: labels.cancel }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panes()[0]).toContainElement(document.activeElement as HTMLElement);
  });
});

describe("Vietnamese labels (SRS-NFR-008)", () => {
  // The English originals of SRS section 7 › Bảng nhãn, plus the other words the app used to show.
  const ENGLISH = [
    "Add Folder", "Remove", "New Session", "Resume", "Delete", "Stash", "Maximize", "Restore", "Cancel", "Close",
    "Missing", "Live", "Running", "Needs Approval", "Idle", "Error", "Ended", "Status unavailable", "untitled",
    "No sessions yet", "could not be read", "Folder not found", "could not be started", "still running", "Session ended",
    "Trash", "Select all", "Delete selected", "could not be reopened", "Folders", "Active Sessions", "Stashed Sessions",
    "No folders yet", "No open sessions", "Session history", "Workspaces", "sidebar", "Not started", "need you",
    "Just now", "ago", "Yesterday", "Open shell", "Hide shell", "Show shell", "Dismiss", "Loading",
  ];
  /** Every word the user can see or hear: text, accessible names and tooltips. */
  const shown = () => {
    const attrs = [...document.body.querySelectorAll("[aria-label], [title]")].flatMap((el) => [
      el.getAttribute("aria-label") ?? "",
      el.getAttribute("title") ?? "",
    ]);
    return [document.body.textContent ?? "", ...attrs].join("\n");
  };
  const expectNoEnglish = () => {
    const text = shown();
    expect(ENGLISH.filter((word) => new RegExp(`\\b${word}\\b`).test(text))).toEqual([]);
  };

  it("shows no English label with no folders", async () => {
    setup([]);
    await screen.findByText(labels.noFolders);
    expectNoEnglish();
  });

  it("shows no English label with the Session Chooser, an open pane and the Close Dialog", async () => {
    const sessions = fakeSessions({
      titles: ["(untitled)"],
      list: vi.fn(async () => ({ sessions: [{ id: "old", title: "Viết BRD", lastActivity: Date.now() - 120_000 }], unreadable: 1 })),
    });
    const { user } = setup([ws("a", "agent-deck"), ws("b", "cũ", true)], sessions);
    await openChooser(user);
    await within(chooser()).findByText("Viết BRD");
    expectNoEnglish();

    await user.click(within(chooser()).getByRole("button", { name: labels.newSession }));
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.status({ state: "Running" }));
    expectNoEnglish();

    await user.click(within(panes()[0]).getByRole("button", { name: labels.closePane }));
    await screen.findByRole("dialog");
    expectNoEnglish();
  });
});

describe("Remote shapes, no One UI (app-theme)", () => {
  // Built from parts, so a grep of src/ for the One UI utilities stays empty.
  const ONE_UI = new RegExp(
    `(^|\\s)(rounded-(card|group|row)|(gap|p[xytb]?)-${"gap"}|bg-(canvas|surface|sidebar|term|dim)|(shadow|backdrop-blur)-${"one"}ui|bg-section-(folders|stash))(\\s|$)`,
  );
  const oneUiClasses = () =>
    [...document.body.querySelectorAll("[class]")].map((el) => el.getAttribute("class") ?? "").filter((c) => ONE_UI.test(c));

  it("draws no One UI shape with no folders", async () => {
    setup([]);
    await screen.findByText(labels.noFolders);
    expect(oneUiClasses()).toEqual([]);
  });

  it("draws no One UI shape with the Session Chooser, a pane and the Close Dialog", async () => {
    const sessions = fakeSessions({
      list: vi.fn(async () => ({ sessions: [{ id: "old", title: "Old work", lastActivity: 1 }], unreadable: 0 })),
    });
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await openChooser(user);
    await within(chooser()).findByText("Old work");
    await user.click(within(chooser()).getByRole("button", { name: labels.newSession }));
    await screen.findByTestId("pane-grid");
    act(() => sessions.opened[0].stream.status({ state: "Needs Approval" }));
    expect(oneUiClasses()).toEqual([]);
    await user.click(within(panes()[0]).getByRole("button", { name: labels.closePane }));
    await screen.findByRole("dialog");
    expect(oneUiClasses()).toEqual([]);
  });
});

describe("View Switch (CR-016)", () => {
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  const pressed = (title: string) =>
    within(within(paneNamed(title)).getByRole("group", { name: labels.viewSwitch }))
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  const zones = () => document.querySelector("[data-drop-target]");

  /** `count` panes, each switched from Chat, where it opens, to Term unless `inTerm` is false. */
  async function start(count: number, sessions = fakeSessions(), inTerm = true) {
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    for (let n = 1; n <= count; n++) {
      await newSessionIn(ctx.user);
      await screen.findByRole("region", { name: `agent-deck · p${n}` });
      if (inTerm) await ctx.user.click(viewItem(paneNamed(`p${n}`), labels.views.term));
    }
    return ctx;
  }

  it("opens a new pane in Chat with the keyboard in its Composer (SRS-FR-147, SRS-FR-014)", async () => {
    await start(1, fakeSessions(), false);
    expect(pressed("p1")).toEqual([labels.views.chat]);
    expect(composerOf(paneNamed("p1"))).toHaveFocus();
  });

  it("switches only the pane whose View Switch is used (SRS-FR-146)", async () => {
    const { user, adapters } = await start(2);
    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));
    expect(pressed("p2")).toEqual([labels.views.term]);
    expect(adapters[2].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("moves the keyboard into the session terminal when Term is chosen (SRS-FR-146)", async () => {
    const { user, adapters } = await start(1);
    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));
    await user.click(viewItem(paneNamed("p1"), labels.views.term));
    expect(pressed("p1")).toEqual([labels.views.term]);
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("puts the keyboard back in the terminal when the current item is chosen again (SRS-FR-146)", async () => {
    const { user, adapters } = await start(1);
    await user.click(viewItem(paneNamed("p1"), labels.views.term));
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("reopens panes in Chat without a shell after a relaunch (SRS-FR-085, SRS-FR-147)", async () => {
    const { user } = await start(1);
    await vi.waitFor(() => expect(readSnapshot()).not.toBeNull());
    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));

    cleanup();
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    setup([ws("a", "agent-deck")], sessions);

    await screen.findByRole("region", { name: "agent-deck · p1" });
    expect(pressed("p1")).toEqual([labels.views.chat]);
    expect(sessions.openShell).not.toHaveBeenCalled();
  });

  async function p1InShellThenP2Focused() {
    const ctx = await start(2);
    await ctx.user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));
    await ctx.user.click(viewItem(paneNamed("p2"), labels.views.term));
    expect(ctx.adapters[1].container).toContainElement(document.activeElement as HTMLElement);
    return { ...ctx, shellTerminal: ctx.adapters[2] };
  }

  it("jumps from a Session Row into the shell of a pane showing Shell (SRS-FR-037)", async () => {
    const { user, shellTerminal } = await p1InShellThenP2Focused();
    await user.click(within(sessionRow("p1")).getByRole("button"));
    expect(shellTerminal.container).toContainElement(document.activeElement as HTMLElement);
  });

  it("puts the keyboard in the shell when a pane showing Shell is maximized (SRS-FR-041)", async () => {
    const { user, shellTerminal } = await p1InShellThenP2Focused();
    await user.click(within(paneNamed("p1")).getByRole("button", { name: labels.maximizePane }));
    expect(shellTerminal.container).toContainElement(document.activeElement as HTMLElement);
  });

  it("leaves the keyboard in another pane when a shown shell exits (SRS-FR-061)", async () => {
    const { sessions, adapters } = await p1InShellThenP2Focused();
    act(() => sessions.shells[0].stream.exit(0));
    expect(pressed("p1")).toEqual([labels.views.term]);
    expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("gives the keyboard to Term when the shown shell exits with the keyboard in it (SRS-FR-061)", async () => {
    const { user, sessions, adapters } = await start(1);
    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement));
    act(() => sessions.shells[0].stream.exit(0));
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("leaves the keyboard in another pane when a slow shell start finishes (SRS-FR-055)", async () => {
    let finish: () => void = () => {};
    const sessions = fakeSessions();
    const opened = sessions.openShell;
    sessions.openShell = vi.fn((paneId: string, cols: number, rows: number) =>
      new Promise<Awaited<ReturnType<FakeSessions["openShell"]>>>((resolve) => {
        finish = () => void opened(paneId, cols, rows).then(resolve);
      }),
    );
    const { user, adapters } = await start(2, sessions);
    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await user.click(viewItem(paneNamed("p2"), labels.views.term));
    await act(async () => finish());
    expect(pressed("p1")).toEqual([labels.views.shell]);
    expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("moves the keyboard into the shell on Enter on the Shell item (SRS-FR-146)", async () => {
    const { user, adapters } = await start(1);
    viewItem(paneNamed("p1"), labels.views.shell).focus();
    await user.keyboard("{Enter}");
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));
    expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("puts the keyboard back in the shown terminal on a click on Plan (SRS-FR-146)", async () => {
    const { user, adapters } = await start(1);
    await user.click(viewItem(paneNamed("p1"), labels.views.plan));
    expect(pressed("p1")).toEqual([labels.views.term]);
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);

    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));
    await user.click(viewItem(paneNamed("p1"), labels.views.plan));
    expect(pressed("p1")).toEqual([labels.views.shell]);
    expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("does not maximize on a double-click on a View Switch item (SRS-FR-066)", async () => {
    const { user } = await start(2);
    await user.dblClick(viewItem(paneNamed("p2"), labels.views.term));
    expect(paneNamed("p2").parentElement).not.toHaveClass("fixed");
    expect(within(paneNamed("p2")).getByRole("button", { name: labels.maximizePane })).toBeInTheDocument();
  });

  it("starts no drag from a View Switch item (SRS-FR-080)", async () => {
    await start(2);
    vi.spyOn(screen.getByTestId("pane-grid"), "getBoundingClientRect").mockReturnValue(GRID);
    fireEvent.pointerDown(viewItem(paneNamed("p1"), labels.views.term), { clientX: 400, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { ...sidePoint("p2", "bottom"), pointerId: 1 });
    expect(zones()).toBeNull();
  });
});

describe("Chat view (CR-016)", () => {
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  const pressed = (title: string) =>
    within(within(paneNamed(title)).getByRole("group", { name: labels.viewSwitch }))
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  const chatLog = (title: string) => within(paneNamed(title)).getByRole("log", { name: labels.chatLog, hidden: true });
  const layerOf = (el: HTMLElement) => el.closest("[data-view]")!;
  const PROMPT = { kind: "prompt" as const, key: "u1:0", text: "sửa lỗi đăng nhập" };
  const READ = { kind: "tool" as const, key: "a1:0", id: "t1", name: "Read", arg: "src/login.ts" };
  const RESULT = { kind: "result" as const, key: "u2:0", toolId: "t1", text: "export function login() {}", isError: false };
  const REPLY = { kind: "reply" as const, key: "a2:0", text: "Đã sửa lỗi token hết hạn." };

  /** Panes switched to Term, so each test chooses Chat itself. */
  async function start(count = 1) {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    for (let n = 1; n <= count; n++) {
      await newSessionIn(ctx.user);
      await screen.findByRole("region", { name: `agent-deck · p${n}` });
      await ctx.user.click(viewItem(paneNamed(`p${n}`), labels.views.term));
    }
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  it("shows the conversation and hides Term without stopping the session (SRS-FR-149, SRS-FR-146)", async () => {
    const { user, sessions, stream, adapters } = await start();
    act(() => stream.status({ state: "Running" }));
    act(() => stream.chat({ reset: true, items: [PROMPT, READ, RESULT, REPLY] }));
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));

    expect(pressed("p1")).toEqual([labels.views.chat]);
    const log = chatLog("p1");
    expect(layerOf(log)).not.toHaveAttribute("inert");
    expect(layerOf(adapters[0].container!)).toHaveAttribute("inert");
    expect(composerOf(paneNamed("p1"))).toHaveFocus();
    expect(within(log).getByText(PROMPT.text)).toHaveClass("bubble");
    expect(within(log).getByText(REPLY.text)).toBeInTheDocument();
    const card = within(log).getByRole("button", { name: "Read src/login.ts" });
    await user.click(card);
    expect(within(log).getByText(RESULT.text)).toBeInTheDocument();

    expect(sessions.close).not.toHaveBeenCalled();
    expect(within(paneNamed("p1")).getByText(labels.state.Running)).toBeInTheDocument();
  });

  it("shows the skeleton until the first chat message", async () => {
    const { user, stream } = await start();
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    expect(chatLog("p1").querySelectorAll(".skel").length).toBeGreaterThan(0);
    act(() => stream.chat({ reset: true, items: [] }));
    expect(chatLog("p1")).toBeEmptyDOMElement();
  });

  it("shows the start failure instead of the skeleton when Claude Code did not start", async () => {
    const { user } = setup([ws("a", "agent-deck")], fakeSessions({ started: false }));
    await newSessionIn(user);
    const pane = await screen.findByRole("region", { name: /^agent-deck · / });
    await user.click(viewItem(pane, labels.views.chat));
    const log = within(pane).getByRole("log", { name: labels.chatLog });
    expect(log.querySelector(".skel")).toBeNull();
    expect(log).not.toHaveAttribute("aria-busy");
    expect(within(log).getByText(labels.startFailed)).toBeInTheDocument();
    expect(within(log).getByText(labels.startFailedHint)).toBeInTheDocument();
  });

  it("has the entries sent while Term is shown when Chat is chosen (SRS-FR-150)", async () => {
    const { user, stream } = await start();
    act(() => stream.chat({ reset: true, items: [] }));
    act(() => stream.chat({ items: [PROMPT] }));
    act(() => stream.chat({ items: [READ, RESULT] }));
    act(() => stream.chat({ items: [REPLY] }));
    expect(pressed("p1")).toEqual([labels.views.term]);
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    const log = chatLog("p1");
    expect(within(log).getByText(PROMPT.text)).toBeInTheDocument();
    expect(within(log).getByRole("button", { name: "Read src/login.ts" })).toBeInTheDocument();
    expect(within(log).getByText(REPLY.text)).toBeInTheDocument();
  });

  it("shows only the new conversation after the session moves on (SRS-FR-151)", async () => {
    const { user, stream } = await start();
    act(() => stream.chat({ reset: true, items: [PROMPT, REPLY] }));
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    act(() => stream.session("s9"));
    act(() => stream.chat({ reset: true, items: [{ kind: "prompt", key: "n1:0", text: "viết test cho login" }] }));
    const log = chatLog("p1");
    expect(within(log).getByText("viết test cho login")).toBeInTheDocument();
    expect(within(log).queryByText(PROMPT.text)).toBeNull();
    expect(within(log).queryByText(REPLY.text)).toBeNull();
  });

  it("shows the unreadable message while Term still takes input (SRS-FR-153)", async () => {
    const { user, sessions, stream, adapters } = await start();
    act(() => stream.chat({ unreadable: true }));
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    expect(within(chatLog("p1")).getByText(labels.chatUnreadable)).toBeInTheDocument();

    await user.click(viewItem(paneNamed("p1"), labels.views.term));
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);
    adapters[0].type("y");
    expect(sessions.write).toHaveBeenCalledWith("p1", "y");
  });

  it("shows the Activity Bar while Running and drops it on Idle (SRS-FR-152)", async () => {
    const { user, stream } = await start();
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    const bar = () => within(layerOf(chatLog("p1")) as HTMLElement).queryByRole("status");
    act(() => stream.activity({ tool: "Bash", arg: "npm test", context: 42, shells: 1, subagents: 2 }));
    expect(bar()).toBeNull();
    act(() => stream.status({ state: "Running" }));
    expect(bar()).toHaveTextContent("Bash npm test · 42% context · 1 shell · 2 subagent");
    act(() => stream.status({ state: "Idle" }));
    expect(bar()).toBeNull();
  });

  it("opens a new pane in Chat with the keyboard in its Composer, whatever the other panes show (SRS-FR-147)", async () => {
    const { user } = await start();
    await newSessionIn(user);
    await screen.findByRole("region", { name: "agent-deck · p2" });
    expect(pressed("p1")).toEqual([labels.views.term]);
    expect(pressed("p2")).toEqual([labels.views.chat]);
    expect(composerOf(paneNamed("p2"))).toHaveFocus();
  });

  it("puts the keyboard back in the Composer when Chat is chosen again (SRS-FR-146)", async () => {
    const { user } = await start();
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    expect(composerOf(paneNamed("p1"))).toHaveFocus();
  });

  it("jumps from a Session Row into the Composer of a pane showing Chat (SRS-FR-037)", async () => {
    const { user, adapters } = await start(2);
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    await user.click(viewItem(paneNamed("p2"), labels.views.term));
    expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement);
    await user.click(within(sessionRow("p1")).getByRole("button"));
    expect(composerOf(paneNamed("p1"))).toHaveFocus();
  });

  it("goes back to Chat when the shell exits after Chat was shown (SRS-FR-061)", async () => {
    const { user, sessions } = await start();
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    await user.click(viewItem(paneNamed("p1"), labels.views.shell));
    await vi.waitFor(() => expect(pressed("p1")).toEqual([labels.views.shell]));
    act(() => sessions.shells[0].stream.exit(0));
    expect(pressed("p1")).toEqual([labels.views.chat]);
    expect(composerOf(paneNamed("p1"))).toHaveFocus();
  });
});

describe("Composer (CR-016)", () => {
  const paneNamed = (title: string) => screen.getByRole("region", { name: `agent-deck · ${title}` });
  const pressed = (title: string) =>
    within(within(paneNamed(title)).getByRole("group", { name: labels.viewSwitch }))
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  const composer = (title = "p1") => within(paneNamed(title)).getByRole("textbox", { name: labels.composerLabel });
  const sendOf = (title = "p1") => within(paneNamed(title)).getByRole("button", { name: labels.send });
  const stopOf = (title = "p1") => within(paneNamed(title)).queryByRole("button", { name: labels.stop });
  const reads = (text: string, title = "p1") => vi.waitFor(() => expect(composer(title)).toHaveAttribute("placeholder", text));
  const SENT = "\x1b[200~chạy lại test\x1b[201~\r";

  async function start(count = 1, sessions = fakeSessions()) {
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    for (let n = 1; n <= count; n++) {
      await newSessionIn(ctx.user);
      await screen.findByRole("region", { name: `agent-deck · p${n}` });
    }
    return { ...ctx, stream: sessions.opened[0].stream };
  }

  /** Panes whose session terminals show Claude Code's empty input box. */
  async function ready(count = 1, sessions = fakeSessions()) {
    const ctx = await start(count, sessions);
    for (let n = 0; n < count; n++) act(() => ctx.adapters[n].showScreen(claude.idle));
    for (let n = 1; n <= count; n++) await reads(labels.composerPlaceholder, `p${n}`);
    return ctx;
  }

  it("sends exactly the typed prompt as one pasted, submitted write and empties (SC-1, SRS-FR-154)", async () => {
    const { user, sessions, stream } = await ready();
    await user.type(composer(), "chạy lại test{Enter}");
    expect(sessions.write).toHaveBeenCalledTimes(1);
    expect(sessions.write).toHaveBeenCalledWith("p1", SENT);
    await vi.waitFor(() => expect(composer()).toHaveValue(""));
    act(() => stream.status({ state: "Running" }));
    expect(stopOf()).not.toBeNull();
  });

  it("sends a single line without paste markers when bracketed paste is off", async () => {
    const { user, sessions, adapters } = await ready();
    vi.mocked(adapters[0].bracketedPaste).mockReturnValue(false);
    await user.type(composer(), "xin chào{Enter}");
    expect(sessions.write).toHaveBeenCalledWith("p1", "xin chào\r");
  });

  it("sends nothing for a prompt of spaces only", async () => {
    const { user, sessions } = await ready();
    await user.type(composer(), "   {Enter}");
    expect(sessions.write).not.toHaveBeenCalled();
    expect(composer()).toHaveValue("   ");
  });

  it("locks with Claude Code đang chờ duyệt on a permission dialog and sends nothing (SC-2, SRS-FR-155)", async () => {
    const { user, sessions, adapters } = await ready();
    act(() => adapters[0].showScreen(claude.permission));
    await reads(labels.composerLockApproval);
    expect(sendOf()).toHaveAttribute("aria-disabled", "true");
    await user.type(composer(), "chạy lại test{Enter}");
    await user.click(sendOf());
    expect(sessions.write).not.toHaveBeenCalled();
    expect(composer()).toHaveValue("chạy lại test");
  });

  it("reads the screen and shows no Dừng while the status is not tracked, whatever it says (SRS-FR-036)", async () => {
    const { stream } = await ready();
    act(() => stream.status({ state: "Running", tracked: false }));
    await act(async () => {});
    expect(stopOf()).toBeNull();
    expect(sendOf()).not.toHaveAttribute("aria-disabled");
    expect(composer()).toHaveAttribute("placeholder", labels.composerPlaceholder);
  });

  it("locks on Needs Approval even at an empty input box", async () => {
    const { stream } = await ready();
    act(() => stream.status({ state: "Needs Approval" }));
    await reads(labels.composerLockApproval);
  });

  it("locks as unrecognized for text typed in Term, and when the session ended", async () => {
    const { adapters, stream } = await ready();
    act(() => adapters[0].showScreen(claude.typed));
    await reads(labels.composerLockUnrecognized);
    act(() => stream.exit(1));
    await reads(labels.composerLockEnded);
  });

  it("delivers nothing when a dialog appeared after the last render (SC-3, SRS-FR-156)", async () => {
    const { user, sessions, adapters } = await ready();
    await user.type(composer(), "1 thêm test");
    // On screen before any frame could redraw the Composer.
    vi.mocked(adapters[0].screen).mockReturnValue(claude.permission);
    await user.keyboard("{Enter}");
    expect(sessions.write).not.toHaveBeenCalled();
    expect(composer()).toHaveValue("1 thêm test");
    expect(composer()).toHaveAttribute("placeholder", labels.composerLockApproval);
  });

  it("stops a running turn with Esc and shows no Dừng when Idle (SC-4, SRS-FR-157)", async () => {
    const { user, sessions, stream, adapters } = await ready();
    expect(stopOf()).toBeNull();
    act(() => stream.status({ state: "Running" }));
    act(() => adapters[0].showScreen(claude.running));
    await user.type(composer(), "tiếp{Enter}");
    expect(sessions.write).not.toHaveBeenCalled();
    await user.click(stopOf()!);
    expect(sessions.write).toHaveBeenCalledTimes(1);
    expect(sessions.write).toHaveBeenCalledWith("p1", "\x1b");

    act(() => stream.status({ state: "Idle" }));
    expect(stopOf()).toBeNull();
    expect(sendOf()).toBeInTheDocument();
  });

  it("recalls with ↑ only the prompts sent from that pane (SC-5, SRS-FR-158)", async () => {
    const { user, sessions } = await ready(2);
    await user.type(composer("p1"), "chạy lại test{Enter}");
    expect(sessions.write).toHaveBeenCalledWith("p1", SENT);
    await vi.waitFor(() => expect(composer("p1")).toHaveValue(""));

    await user.keyboard("{ArrowUp}");
    expect(composer("p1")).toHaveValue("chạy lại test");
    await user.click(composer("p2"));
    await user.keyboard("{ArrowUp}");
    expect(composer("p2")).toHaveValue("");
  });

  it("walks back to older prompts", async () => {
    const { user } = await ready();
    await user.type(composer(), "một{Enter}");
    await vi.waitFor(() => expect(composer()).toHaveValue(""));
    await user.type(composer(), "hai{Enter}");
    await vi.waitFor(() => expect(composer()).toHaveValue(""));
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(composer()).toHaveValue("một");
  });

  it("keeps the prompt when the write fails", async () => {
    const sessions = fakeSessions({ write: vi.fn(async () => Promise.reject("gone")) });
    const { user } = await ready(1, sessions);
    await user.type(composer(), "chạy lại test{Enter}");
    await act(async () => {});
    expect(sessions.write).toHaveBeenCalledWith("p1", SENT);
    expect(composer()).toHaveValue("chạy lại test");
  });

  it("sends a prompt once when Enter is pressed again before its write lands", async () => {
    let land: () => void = () => {};
    const sessions = fakeSessions({ write: vi.fn(() => new Promise<void>((resolve) => (land = resolve))) });
    const { user } = await ready(1, sessions);
    await user.type(composer(), "chạy lại test{Enter}{Enter}");
    expect(sessions.write).toHaveBeenCalledTimes(1);
    await act(async () => land());
    expect(composer()).toHaveValue("");
  });

  it("keeps what was typed while the write was pending", async () => {
    let land: () => void = () => {};
    const sessions = fakeSessions({ write: vi.fn(() => new Promise<void>((resolve) => (land = resolve))) });
    const { user } = await ready(1, sessions);
    await user.type(composer(), "chạy lại test{Enter} nữa");
    await act(async () => land());
    expect(composer()).toHaveValue("chạy lại test nữa");
  });

  it("does not rewrite the remembered panes on each keystroke", async () => {
    const { user } = await ready();
    await vi.waitFor(() => expect(readSnapshot()).not.toBeNull());
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    try {
      await user.type(composer(), "chạy lại test");
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it("keeps the draft when the pane is maximized and restored", async () => {
    const { user } = await ready();
    await user.type(composer(), "nháp");
    await user.click(within(paneNamed("p1")).getByRole("button", { name: labels.maximizePane }));
    await user.click(within(paneNamed("p1")).getByRole("button", { name: labels.restorePane }));
    expect(composer()).toHaveValue("nháp");
  });

  it("keeps the draft while Term is shown", async () => {
    const { user } = await ready();
    await user.type(composer(), "nháp");
    await user.click(viewItem(paneNamed("p1"), labels.views.term));
    await user.click(viewItem(paneNamed("p1"), labels.views.chat));
    expect(composer()).toHaveValue("nháp");
  });

  describe("panes open in Chat (SRS-FR-147, SRS-FR-014)", () => {
    it("opens a new pane in Chat with the keyboard in its Composer (SC-6)", async () => {
      await start(2);
      expect(pressed("p2")).toEqual([labels.views.chat]);
      expect(composer("p2")).toHaveFocus();
    });

    it("puts what is typed right after Phiên mới in the Composer", async () => {
      const { user, sessions } = await start();
      await user.keyboard("xin chào");
      expect(composer()).toHaveValue("xin chào");
      expect(sessions.write).not.toHaveBeenCalled();
    });

    it("opens a resumed pane in Chat with the keyboard in its Composer", async () => {
      const sessions = fakeSessions({
        list: vi.fn(async () => ({ sessions: [{ id: "old-1", title: "Scaffold Tauri app", lastActivity: 1 }], unreadable: 0 })),
        title: vi.fn(async () => "Scaffold Tauri app"),
      });
      const { user } = setup([ws("a", "agent-deck")], sessions);
      await openChooser(user);
      await user.click(await within(chooser()).findByRole("button", { name: /^Scaffold/ }));
      await screen.findByRole("region", { name: "agent-deck · Scaffold Tauri app" });
      expect(pressed("Scaffold Tauri app")).toEqual([labels.views.chat]);
      expect(composer("Scaffold Tauri app")).toHaveFocus();
    });

    it("reopens panes in Chat at launch, the keyboard in the last one's Composer (SC-6)", async () => {
      const { user } = await start(2);
      await vi.waitFor(() => expect(readSnapshot()).not.toBeNull());
      await user.click(viewItem(paneNamed("p1"), labels.views.term));
      await user.click(viewItem(paneNamed("p2"), labels.views.shell));

      cleanup();
      const sessions = fakeSessions();
      sessions.title = vi.fn(async (id: string) => id);
      setup([ws("a", "agent-deck")], sessions);

      await screen.findByRole("region", { name: "agent-deck · p2" });
      expect(pressed("p1")).toEqual([labels.views.chat]);
      expect(pressed("p2")).toEqual([labels.views.chat]);
      expect(composer("p2")).toHaveFocus();
    });

    it("moves the keyboard into the Composer when Chat is chosen, also again (SRS-FR-146)", async () => {
      const { user } = await start();
      await user.click(viewItem(paneNamed("p1"), labels.views.term));
      await user.click(viewItem(paneNamed("p1"), labels.views.chat));
      expect(composer()).toHaveFocus();
      await user.click(viewItem(paneNamed("p1"), labels.views.chat));
      expect(composer()).toHaveFocus();
    });

    it("jumps from a Session Row into the Composer of a pane showing Chat (SRS-FR-037)", async () => {
      const { user, adapters } = await start(2);
      await user.click(viewItem(paneNamed("p2"), labels.views.term));
      expect(adapters[1].container).toContainElement(document.activeElement as HTMLElement);
      await user.click(within(sessionRow("p1")).getByRole("button"));
      expect(composer("p1")).toHaveFocus();
    });
  });
});

describe("Approval (CR-016)", () => {
  const pane = () => screen.getByRole("region", { name: "agent-deck · p1" });
  const strip = () => within(pane()).queryByRole("group", { name: labels.permissionGroup });
  const composer = () => within(pane()).getByRole("textbox", { name: labels.composerLabel });
  const QUESTION_TEXT = "Dùng thư viện validation nào: zod hay yup?";
  const PLAN_TEXT = "Context\n\nAdd a file hello.txt containing hi.\n\n1. Create hello.txt\n2. Write hi into it";
  const isPlan = (_: string, el: Element | null) => el?.tagName === "PRE" && el.textContent === PLAN_TEXT;
  // A screen change is drawn on the next animation frame.
  const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  const tool = (name: string, arg: string | null, detail?: ToolDetail): ChatItem => ({
    kind: "tool",
    key: `${name}:0`,
    id: `t-${name}`,
    name,
    arg,
    ...(detail ? { detail } : {}),
  });
  const askTool = (over: { multiSelect?: boolean; count?: number; text?: string } = {}) =>
    tool("AskUserQuestion", null, {
      question: {
        text: over.text ?? QUESTION_TEXT,
        multiSelect: over.multiSelect ?? false,
        count: over.count ?? 1,
        options: ["zod", "yup"],
      },
    });
  // The permission dialog of the spec's example: Claude Code asks to run npm install.
  const npmInstall = claude.permissionNo4.map((l) => (l.text === " touch a.txt" ? { text: " npm install", dim: [] } : l));
  const writes = (sessions: FakeSessions) => vi.mocked(sessions.write).mock.calls.map(([, bytes]) => bytes);
  /** Claude Code's answer to each write: the screen it draws next. */
  const redraws = (sessions: FakeSessions, adapter: FakeAdapter, next: Record<string, ScreenLine[]>) =>
    vi.mocked(sessions.write).mockImplementation(async (_pane, bytes) => {
      if (next[bytes]) adapter.showScreen(next[bytes]);
    });

  async function showing(lines: ScreenLine[], items: ChatItem[], status: Partial<PaneStatus> = {}) {
    const sessions = fakeSessions();
    sessions.title = vi.fn(async (id: string) => id);
    const ctx = setup([ws("a", "agent-deck")], sessions);
    await newSessionIn(ctx.user);
    await screen.findByRole("region", { name: "agent-deck · p1" });
    const stream = sessions.opened[0].stream;
    act(() => stream.chat({ reset: true, items }));
    act(() => stream.status({ state: "Needs Approval", ...status }));
    act(() => ctx.adapters[0].showScreen(lines));
    await frame();
    return { ...ctx, stream };
  }

  const bashPending = () => showing(npmInstall, [tool("Bash", "npm install")], { reason: "Bash npm install" });

  it("shows Bash · npm install with Từ chối and Cho phép above the Composer (SC-1, SRS-FR-163)", async () => {
    await bashPending();
    const group = strip()!;
    expect(group).toHaveTextContent("Bash · npm install");
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([labels.deny, labels.allow]);
    expect(group.compareDocumentPosition(composer()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(composer()).toHaveFocus();
  });

  it("shows every line of a multi-line command, not the first line the hook and Chat keep", async () => {
    await showing(claude.multilineDialog, [tool("Bash", "echo one")], { reason: "Bash echo one" });
    const subject = within(strip()!).getByText((_, el) => el?.textContent === "echo one\ntouch d.txt");
    expect(subject).toHaveAttribute("title", "echo one\ntouch d.txt");
    expect(subject).toHaveClass("whitespace-pre-wrap", "font-mono");
  });

  it("shows the file of an Edit or a Write from the screen, never the hook reason", async () => {
    await showing(claude.editDialog, [tool("Edit", "src/other.rs")], { reason: "Edit src/other.rs" });
    expect(strip()).toHaveTextContent("Edit · README.md");
    cleanup();
    const { user, sessions } = await showing(claude.writeDialog, [tool("Write", "c.txt")], { reason: "Write c.txt" });
    expect(strip()).toHaveTextContent("Write · c.txt");
    await user.click(within(strip()!).getByRole("button", { name: labels.deny }));
    expect(writes(sessions)).toEqual(["3"]);
  });

  it("shows the command on screen alone when no tool is known", async () => {
    await showing(claude.permissionNo4, [], { reason: null });
    expect(strip()).toHaveTextContent(/^touch a\.txt/);
  });

  it("answers Cho phép with exactly 1 (SC-2, SRS-FR-164)", async () => {
    const { user, sessions } = await bashPending();
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    expect(sessions.write).toHaveBeenCalledTimes(1);
    expect(sessions.write).toHaveBeenCalledWith("p1", "1");
  });

  it("answers Từ chối with the No digit on screen (SC-2)", async () => {
    const { user, sessions } = await bashPending();
    await user.click(within(strip()!).getByRole("button", { name: labels.deny }));
    expect(sessions.write).toHaveBeenCalledTimes(1);
    expect(sessions.write).toHaveBeenCalledWith("p1", "4");
  });

  it("answers Từ chối with 3 where No is option 3", async () => {
    const { user, sessions } = await showing(claude.permissionNo3Box, [tool("Bash", "cd /Users/me/ws")], { reason: "Bash cd /Users/me/ws" });
    await user.click(within(strip()!).getByRole("button", { name: labels.deny }));
    expect(sessions.write).toHaveBeenCalledTimes(1);
    expect(sessions.write).toHaveBeenCalledWith("p1", "3");
  });

  it("sends one answer when Cho phép is pressed again before the write lands", async () => {
    let land: () => void = () => {};
    const { user, sessions } = await bashPending();
    vi.mocked(sessions.write).mockImplementation(() => new Promise<void>((resolve) => (land = resolve)));
    const allow = within(strip()!).getByRole("button", { name: labels.allow });
    await user.click(allow);
    await user.click(allow);
    expect(sessions.write).toHaveBeenCalledTimes(1);
    await act(async () => land());
  });

  it("sends one answer while the answered dialog is still drawn after the write landed, and answers the next one", async () => {
    const { user, sessions, adapters } = await bashPending();
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    await act(async () => {});
    // Claude Code has not redrawn yet: a second digit would land on whatever dialog comes next.
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    expect(sessions.write).toHaveBeenCalledTimes(1);

    act(() => adapters[0].showScreen(claude.idle));
    await vi.waitFor(() => expect(strip()).toBeNull());
    act(() => adapters[0].showScreen(claude.permissionNo4));
    await vi.waitFor(() => expect(strip()).not.toBeNull());
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    expect(sessions.write).toHaveBeenCalledTimes(2);
  });

  it("lets the answer be sent again when the write failed", async () => {
    const { user, sessions } = await bashPending();
    vi.mocked(sessions.write).mockRejectedValueOnce("gone");
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    await act(async () => {});
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    expect(sessions.write).toHaveBeenCalledTimes(2);
  });

  it("gives the keyboard back to the Composer when the strip it was in goes away", async () => {
    const { user, adapters } = await bashPending();
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    act(() => adapters[0].showScreen(claude.idle));
    await vi.waitFor(() => expect(strip()).toBeNull());
    expect(composer()).toHaveFocus();
  });

  it("leaves the keyboard in Term when the dialog was answered there", async () => {
    const { user, adapters } = await bashPending();
    await user.click(viewItem(pane(), labels.views.term));
    act(() => adapters[0].showScreen(claude.idle));
    await vi.waitFor(() => expect(strip()).toBeNull());
    expect(adapters[0].container).toContainElement(document.activeElement as HTMLElement);
  });

  it("sends nothing and says Yêu cầu đã thay đổi once the request was answered in Term (SC-3, SRS-FR-165)", async () => {
    const { user, sessions, adapters } = await bashPending();
    // Answered before any frame could take the strip away.
    vi.mocked(adapters[0].screen).mockReturnValue(claude.idle);
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    expect(sessions.write).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.requestChanged);
  });

  it("sends nothing when another request replaced the one shown (SRS-FR-165)", async () => {
    const { user, sessions, adapters } = await bashPending();
    vi.mocked(adapters[0].screen).mockReturnValue(claude.permissionNo3Box);
    await user.click(within(strip()!).getByRole("button", { name: labels.allow }));
    expect(sessions.write).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.requestChanged);
  });

  it("takes the strip away once the dialog leaves the screen, as after 1 in Term (SC-6, SRS-FR-168)", async () => {
    const { adapters, stream } = await bashPending();
    act(() => adapters[0].showScreen(claude.idle));
    await vi.waitFor(() => expect(strip()).toBeNull());
    act(() => adapters[0].showScreen(claude.permissionNo4));
    await vi.waitFor(() => expect(strip()).not.toBeNull());
    act(() => stream.status({ state: "Running" }));
    expect(strip()).toBeNull();
  });

  it("shows no strip on a trust dialog, nor while the session is not Needs Approval", async () => {
    const { adapters, stream } = await showing(claude.trust, [tool("Bash", "npm install")], { reason: "Bash npm install" });
    expect(strip()).toBeNull();
    act(() => stream.status({ state: "Idle" }));
    act(() => adapters[0].showScreen(claude.permissionNo4));
    await frame();
    expect(strip()).toBeNull();
  });

  describe("Question Card (SRS-FR-166)", () => {
    const card = () => within(pane()).queryByRole("group", { name: QUESTION_TEXT });

    it("shows the question, zod and yup, Khác… and Gửi, and answers zod with its digit (SC-4)", async () => {
      const { user, sessions } = await showing(claude.askQuestion, [askTool()]);
      const c = card()!;
      expect(within(c).getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["zod", "yup"]);
      expect(within(c).getByRole("textbox", { name: labels.other })).toBeInTheDocument();
      const send = within(c).getByRole("button", { name: labels.send });
      expect(send).toBeDisabled();
      await user.click(within(c).getByRole("radio", { name: "zod" }));
      await user.click(send);
      expect(sessions.write).toHaveBeenCalledTimes(1);
      expect(sessions.write).toHaveBeenCalledWith("p1", "1");
    });

    describe("Khác… is typed in steps, each one seen on screen (measured: one chunk answers the first option)", () => {
      const STAGED = "Bạn muốn dùng thư viện validation nào?";
      const typeValibot = async (user: ReturnType<typeof userEvent.setup>) => {
        const c = within(pane()).getByRole("group", { name: STAGED });
        await user.type(within(c).getByRole("textbox", { name: labels.other }), "valibot");
        await user.click(within(c).getByRole("button", { name: labels.send }));
      };

      it("writes the digit, then valibot once the cursor is in the field, then Enter once it shows the text (SC-4)", async () => {
        const { user, sessions, adapters } = await showing(claude.askQuestionStart, [askTool({ text: STAGED })]);
        redraws(sessions, adapters[0], { "3": claude.askQuestionOnOther, valibot: claude.askQuestionTyped, "\r": claude.idle });
        await typeValibot(user);
        await vi.waitFor(() => expect(writes(sessions)).toEqual(["3", "valibot", "\r"]));
        expect(screen.queryByRole("alert")).toBeNull();
      });

      it("stops after the digit when another dialog takes the screen", async () => {
        const { user, sessions, adapters } = await showing(claude.askQuestionStart, [askTool({ text: STAGED })]);
        redraws(sessions, adapters[0], { "3": claude.permissionNo4 });
        await typeValibot(user);
        expect(await screen.findByRole("alert")).toHaveTextContent(labels.requestChanged);
        expect(writes(sessions)).toEqual(["3"]);
      });

      it("stops before Enter when the field never shows the text", async () => {
        const { user, sessions, adapters } = await showing(claude.askQuestionStart, [askTool({ text: STAGED })]);
        redraws(sessions, adapters[0], { "3": claude.askQuestionOnOther });
        await typeValibot(user);
        expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(labels.requestChanged);
        expect(writes(sessions)).toEqual(["3", "valibot"]);
      });

      it("stops after the digit when the cursor never reaches the field", async () => {
        const { user, sessions } = await showing(claude.askQuestionStart, [askTool({ text: STAGED })]);
        await typeValibot(user);
        expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(labels.requestChanged);
        expect(writes(sessions)).toEqual(["3"]);
      });
    });

    it("shows no card while the cursor already sits in Type something., moved there in Term", async () => {
      await showing(claude.askQuestionOnOther, [askTool({ text: "Bạn muốn dùng thư viện validation nào?" })]);
      expect(within(pane()).queryByRole("radiogroup")).toBeNull();
    });

    it("sends nothing once the question was answered in Term (SRS-FR-165)", async () => {
      const { user, sessions, adapters } = await showing(claude.askQuestion, [askTool()]);
      await user.click(within(card()!).getByRole("radio", { name: "zod" }));
      vi.mocked(adapters[0].screen).mockReturnValue(claude.idle);
      await user.click(within(card()!).getByRole("button", { name: labels.send }));
      expect(sessions.write).not.toHaveBeenCalled();
      expect(await screen.findByRole("alert")).toHaveTextContent(labels.requestChanged);
    });

    it("shows no card for a question with several answers or several questions", async () => {
      await showing(claude.askQuestion, [askTool({ multiSelect: true })]);
      expect(card()).toBeNull();
      cleanup();
      await showing(claude.askQuestion, [askTool({ count: 2 })]);
      expect(card()).toBeNull();
    });

    it("shows no card when the question on screen is not the pending one", async () => {
      await showing(claude.askQuestion, [askTool(), tool("Bash", "ls")]);
      expect(card()).toBeNull();
    });
  });

  describe("plan card (SRS-FR-167)", () => {
    const keep = () => within(pane()).getByRole("button", { name: labels.keepPlanning });
    const approve = () => within(pane()).getByRole("button", { name: labels.approvePlan });

    it("shows the plan and approves it with 2 (SC-5)", async () => {
      const { user, sessions } = await showing(claude.plan, [tool("ExitPlanMode", null, { plan: PLAN_TEXT })]);
      expect(within(pane()).getByText(isPlan)).toBeInTheDocument();
      expect(keep()).toBeDisabled();
      await user.click(approve());
      expect(sessions.write).toHaveBeenCalledTimes(1);
      expect(sessions.write).toHaveBeenCalledWith("p1", "2");
    });

    it("keeps planning with 3, then the feedback once the cursor is in the field, then Enter (SC-5)", async () => {
      const { user, sessions, adapters } = await showing(claude.plan, [tool("ExitPlanMode", null, { plan: PLAN_TEXT })]);
      redraws(sessions, adapters[0], { "3": claude.planOnKeep, "thêm bước viết test": claude.planTyped, "\r": claude.idle });
      await user.type(within(pane()).getByRole("textbox", { name: labels.planFeedback }), "thêm bước viết test");
      await user.click(keep());
      await vi.waitFor(() => expect(writes(sessions)).toEqual(["3", "thêm bước viết test", "\r"]));
    });

    it("stops after the digit when the plan dialog goes", async () => {
      const { user, sessions, adapters } = await showing(claude.plan, [tool("ExitPlanMode", null, { plan: PLAN_TEXT })]);
      redraws(sessions, adapters[0], { "3": claude.askQuestion });
      await user.type(within(pane()).getByRole("textbox", { name: labels.planFeedback }), "thêm bước viết test");
      await user.click(keep());
      expect(await screen.findByRole("alert")).toHaveTextContent(labels.requestChanged);
      expect(writes(sessions)).toEqual(["3"]);
    });

    it("shows only the pending plan, else points to Term", async () => {
      const done: ChatItem = { kind: "tool", key: "old", id: "old", name: "ExitPlanMode", arg: null, detail: { plan: PLAN_TEXT } };
      const result: ChatItem = { kind: "result", key: "r", toolId: "old", text: "", isError: false };
      await showing(claude.plan, [done, result, tool("ExitPlanMode", null)]);
      expect(within(pane()).getByText(labels.planInTerm)).toBeInTheDocument();
      expect(within(pane()).queryByText(isPlan)).toBeNull();
      cleanup();
      await showing(claude.plan, [tool("ExitPlanMode", null, { plan: PLAN_TEXT }), tool("Bash", "ls")]);
      expect(within(pane()).getByText(labels.planInTerm)).toBeInTheDocument();
    });
  });
});
