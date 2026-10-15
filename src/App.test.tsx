import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Workspace, WorkspacesClient } from "./api/workspaces";
import App from "./App";
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

function setup(items: Workspace[], sessions: FakeSessions = fakeSessions()) {
  const adapters: FakeAdapter[] = [];
  const createTerminal = vi.fn(() => {
    const a = fakeAdapter();
    adapters.push(a);
    return a;
  });
  render(<App workspaces={workspacesClient(items)} sessions={sessions} createTerminal={createTerminal} />);
  return { user: userEvent.setup(), sessions, adapters, createTerminal };
}

const sidebar = () => screen.getByRole("complementary");
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
    const { user } = setup([ws("a", "agent-deck")], sessions);
    await selectAndStart(user, "agent-deck");
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(screen.queryByTestId("pane-grid")).not.toBeInTheDocument();
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
    const { user, createTerminal } = setup([ws("a", "agent-deck")], fakeSessions({ started: false }));
    await selectAndStart(user, "agent-deck");
    expect(await screen.findByText("Claude Code could not be started")).toBeInTheDocument();
    expect(createTerminal).not.toHaveBeenCalled();
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
