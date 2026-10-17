import { afterEach, describe, expect, it, vi } from "vitest";
import { countTerminals, type DiagClient, installErrorHooks } from "./diagnostics";
import { fakeAdapter } from "./test/fakes";

function fakeDiag() {
  return { log: vi.fn(async () => {}), report: vi.fn(async () => {}) } satisfies DiagClient;
}

function rejection(reason: unknown) {
  return Object.assign(new Event("unhandledrejection"), { reason });
}

describe("installErrorHooks", () => {
  afterEach(() => vi.useRealTimers());

  it("logs an uncaught error with where it was thrown", () => {
    const diag = fakeDiag();
    const remove = installErrorHooks(diag, window);
    window.dispatchEvent(
      new ErrorEvent("error", { message: "x is undefined", filename: "http://localhost/src/App.tsx", lineno: 42 }),
    );
    remove();
    expect(diag.log).toHaveBeenCalledWith("ERROR", "window", "x is undefined at http://localhost/src/App.tsx:42");
  });

  it("logs an unhandled rejection with its reason", () => {
    const diag = fakeDiag();
    const remove = installErrorHooks(diag, window);
    window.dispatchEvent(rejection(new Error("pane_write failed")));
    window.dispatchEvent(rejection("folder_missing"));
    remove();
    expect(diag.log.mock.calls).toEqual([
      ["ERROR", "promise", "Error: pane_write failed"],
      ["ERROR", "promise", "folder_missing"],
    ]);
  });

  it("writes at most 20 errors a minute, then says how many it dropped", () => {
    vi.useFakeTimers();
    const diag = fakeDiag();
    const remove = installErrorHooks(diag, window);
    for (let i = 0; i < 25; i++) window.dispatchEvent(rejection(`e${i}`));
    expect(diag.log).toHaveBeenCalledTimes(20);

    vi.advanceTimersByTime(60_000);
    expect(diag.log).toHaveBeenLastCalledWith("WARN", "diagnostics", "dropped 5 UI errors in one minute");

    window.dispatchEvent(rejection("after"));
    expect(diag.log).toHaveBeenLastCalledWith("ERROR", "promise", "after");
    remove();
  });

  it("stops listening once removed", () => {
    const diag = fakeDiag();
    installErrorHooks(diag, window)();
    window.dispatchEvent(rejection("late"));
    expect(diag.log).not.toHaveBeenCalled();
  });

  it("never lets a failing log call raise another error", async () => {
    const diag = { log: vi.fn(async () => Promise.reject(new Error("ipc down"))), report: vi.fn(async () => {}) };
    const remove = installErrorHooks(diag, window);
    window.dispatchEvent(rejection("first"));
    await Promise.resolve();
    await Promise.resolve();
    remove();
    expect(diag.log).toHaveBeenCalledTimes(1);
  });
});

describe("countTerminals", () => {
  it("counts terminals created and not yet disposed", () => {
    const made = [fakeAdapter(), fakeAdapter(), fakeAdapter()];
    let i = 0;
    const counted = countTerminals(() => made[i++]);
    const a = counted.factory();
    counted.factory();
    counted.factory();
    expect(counted.live()).toBe(3);
    a.dispose();
    a.dispose();
    expect(counted.live()).toBe(2);
    expect(made[0].dispose).toHaveBeenCalledTimes(2);
  });
});
