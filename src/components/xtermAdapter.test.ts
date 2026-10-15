import { describe, expect, it, vi } from "vitest";

const xterm = vi.hoisted(() => {
  type Listener = (data: string) => void;
  class FakeTerminal {
    static last: FakeTerminal;
    data = new Set<Listener>();
    binary = new Set<Listener>();
    constructor() {
      FakeTerminal.last = this;
    }
    loadAddon() {}
    onData(cb: Listener) {
      this.data.add(cb);
      return { dispose: () => this.data.delete(cb) };
    }
    onBinary(cb: Listener) {
      this.binary.add(cb);
      return { dispose: () => this.binary.delete(cb) };
    }
  }
  return { FakeTerminal };
});

vi.mock("@xterm/xterm", () => ({ Terminal: xterm.FakeTerminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: class {} }));
vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: class {} }));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

import { createXtermAdapter } from "./xtermAdapter";

describe("createXtermAdapter (fix round 1)", () => {
  it("forwards xterm binary events, such as mouse reports, apart from typed data", () => {
    const adapter = createXtermAdapter();
    const term = xterm.FakeTerminal.last;
    const typed: string[] = [];
    const binary: string[] = [];
    const stopData = adapter.onData((d) => typed.push(d));
    const stopBinary = adapter.onBinary((d) => binary.push(d));

    term.data.forEach((cb) => cb("ă"));
    term.binary.forEach((cb) => cb("\x1b[M #!"));
    expect(typed).toEqual(["ă"]);
    expect(binary).toEqual(["\x1b[M #!"]);

    stopData();
    stopBinary();
    expect(term.data.size).toBe(0);
    expect(term.binary.size).toBe(0);
  });
});
