import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeAdapter, fakeSessions, type FakeSessions } from "../test/fakes";
import { useSessionPanes } from "./useSessionPanes";

describe("useSessionPanes new panes (SRS-FR-147)", () => {
  it("starts new and resumed panes in Chat, with an empty draft and no sent prompts", async () => {
    const paneArea = { current: null };
    const { result } = renderHook(() => useSessionPanes(fakeSessions(), () => fakeAdapter(), vi.fn(), paneArea));
    const workspace = { id: "a", name: "a", path: "/a", missing: false };
    await act(async () => void (await result.current.newSession(workspace)));
    await act(async () => void (await result.current.resume(workspace, { id: "old", title: "Cũ" })));

    for (const pane of result.current.entries) {
      expect(pane).toMatchObject({ view: "chat", returnView: "chat", draft: "", sentPrompts: [] });
    }
    expect(result.current.entries).toHaveLength(2);
  });
});

describe("useSessionPanes chooseView", () => {
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
    expect(pane.view).toBe("chat");
  });
});
