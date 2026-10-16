import { describe, expect, it, vi } from "vitest";

const xterm = vi.hoisted(() => {
  type Listener = (data: string) => void;
  class FakeTerminal {
    static last: FakeTerminal;
    data = new Set<Listener>();
    binary = new Set<Listener>();
    keyHandler: ((ev: KeyboardEvent) => boolean) | null = null;
    constructor() {
      FakeTerminal.last = this;
    }
    loadAddon() {}
    attachCustomKeyEventHandler(handler: (ev: KeyboardEvent) => boolean) {
      this.keyHandler = handler;
    }
    // Like xterm's `input`: the data goes out through onData.
    input(data: string) {
      this.data.forEach((cb) => cb(data));
    }
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

describe("createXtermAdapter: text sent as one key event (SRS-FR-026)", () => {
  function typedThrough(events: KeyboardEvent[]) {
    createXtermAdapter();
    const term = xterm.FakeTerminal.last;
    const typed: string[] = [];
    term.onData((d) => typed.push(d));
    const passedOn = events.map((ev) => term.keyHandler?.(ev) ?? true);
    return { typed, passedOn };
  }

  it("sends every character of a multi-character key, as XKey replaces 'ưa' with 'ửa'", () => {
    const keydown = new KeyboardEvent("keydown", { key: "ửa", cancelable: true });
    const keypress = new KeyboardEvent("keypress", { key: "ửa", cancelable: true });
    const { typed, passedOn } = typedThrough([keydown, keypress]);

    expect(typed).toEqual(["ửa"]);
    expect(passedOn).toEqual([false, false]);
    expect(keydown.defaultPrevented).toBe(true);
  });

  it("leaves single characters, named keys and shortcuts to xterm", () => {
    const events = [
      new KeyboardEvent("keydown", { key: "a" }),
      new KeyboardEvent("keydown", { key: "ử" }),
      new KeyboardEvent("keydown", { key: "Backspace" }),
      new KeyboardEvent("keydown", { key: "ArrowLeft" }),
      new KeyboardEvent("keydown", { key: "F12" }),
      new KeyboardEvent("keydown", { key: "ửa", metaKey: true }),
      new KeyboardEvent("keydown", { key: "ửa", ctrlKey: true }),
    ];
    const { typed, passedOn } = typedThrough(events);

    expect(typed).toEqual([]);
    expect(passedOn).toEqual(events.map(() => true));
  });
});
