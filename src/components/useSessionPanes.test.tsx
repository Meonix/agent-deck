import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeAdapter, fakeSessions, type FakeSessions } from "../test/fakes";
import { useSessionPanes } from "./useSessionPanes";

describe("useSessionPanes chooseView", () => {
  // Chat is not built yet, so only the hook can choose it while the shell starts.
  it("cancels a pending shell start on any view other than Shell", async () => {
    let finish: () => void = () => {};
    const sessions = fakeSessions();
    const opened = sessions.openShell;
    sessions.openShell = vi.fn((paneId: string, cols: number, rows: number) =>
      new Promise<Awaited<ReturnType<FakeSessions["openShell"]>>>((resolve) => {
        finish = () => void opened(paneId, cols, rows).then(resolve);
      }),
    );
    const paneArea = { current: null };
    const { result } = renderHook(() => useSessionPanes(sessions, () => fakeAdapter(), vi.fn(), paneArea));
    await act(async () => void (await result.current.newSession({ id: "a", name: "a", path: "/a", missing: false })));

    let starting: Promise<void> = Promise.resolve();
    act(() => void (starting = result.current.chooseView("p1", "shell")));
    await act(async () => result.current.chooseView("p1", "chat"));
    await act(async () => {
      finish();
      await starting;
    });

    const pane = result.current.entries[0];
    expect(pane.shell).not.toBeNull();
    expect(pane.view).toBe("term");
  });
});
