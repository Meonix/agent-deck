import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAdapter, fakeSessions, fakeStream, type FakeAdapter } from "../test/fakes";
import { TerminalPane, type PaneEntry } from "./TerminalPane";

function entry(adapter: FakeAdapter | null, over: Partial<PaneEntry> = {}): PaneEntry {
  return {
    pane: { paneId: "p1", sessionId: "s1", started: adapter !== null },
    workspaceName: "agent-deck",
    adapter,
    stream: fakeStream(),
    openedSize: { cols: 80, rows: 24 },
    ended: false,
    ...over,
  };
}

function renderPane(e: PaneEntry, client = fakeSessions(), on = { focus: vi.fn(), close: vi.fn() }) {
  const view = render(
    <TerminalPane entry={e} client={client} focused onFocus={on.focus} onClose={on.close} />,
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

  it("shows the workspace and (untitled), then the session title, refreshed every 10 s", async () => {
    vi.useFakeTimers();
    const client = fakeSessions({ titles: ["Fix login", "Fix login redirect"] });
    let resolveFirst: (t: string) => void = () => {};
    client.title = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((r) => (resolveFirst = r)))
      .mockResolvedValue("Fix login redirect");
    renderPane(entry(fakeAdapter()), client);
    expect(screen.getByRole("region", { name: "agent-deck · (untitled)" })).toBeInTheDocument();
    expect(client.title).toHaveBeenCalledWith("p1");

    await act(async () => resolveFirst("Fix login"));
    expect(screen.getByRole("region", { name: "agent-deck · Fix login" })).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(9_999));
    expect(client.title).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(client.title).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("region", { name: "agent-deck · Fix login redirect" })).toBeInTheDocument();
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
      <TerminalPane entry={entry(adapter, { ended: true })} client={client} focused onFocus={vi.fn()} onClose={vi.fn()} />,
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

  it("asks the parent to close it from the close button", async () => {
    const user = userEvent.setup();
    const { on } = renderPane(entry(fakeAdapter()));
    await user.click(screen.getByRole("button", { name: "Close pane" }));
    expect(on.close).toHaveBeenCalledWith("p1");
  });
});
