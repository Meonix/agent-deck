import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAdapter } from "../test/fakes";
import { latencyLogEnabled, withLatencyLog } from "./latencyLog";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("latency log (5.4)", () => {
  it("is on only when localStorage adLatency is 1", () => {
    expect(latencyLogEnabled()).toBe(false);
    localStorage.setItem("adLatency", "1");
    expect(latencyLogEnabled()).toBe(true);
  });

  it("is off when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(latencyLogEnabled()).toBe(false);
  });

  it("logs p50 and p95 from keystroke to next output after 200 samples", () => {
    const inner = fakeAdapter();
    let clock = 0;
    const log = vi.fn();
    const adapter = withLatencyLog(inner, () => clock, log);
    const typed: string[] = [];
    adapter.onData((d) => typed.push(d));
    const chunk = new TextEncoder().encode("x");

    for (let i = 1; i <= 200; i++) {
      inner.type("a");
      inner.type("b");
      clock += i;
      adapter.write(chunk);
      adapter.write(chunk);
      expect(log).toHaveBeenCalledTimes(i === 200 ? 1 : 0);
    }

    expect(log).toHaveBeenCalledWith("adLatency p50 100.0 ms, p95 190.0 ms over 200 keystrokes");
    expect(typed).toHaveLength(400);
    expect(inner.written).toHaveLength(400);
  });
});
