import { vi } from "vitest";
import type { OpenedPane, PaneStream, SessionsClient } from "../api/sessions";
import type { TerminalAdapter, TerminalSize } from "../components/TerminalPane";

export type FakeAdapter = TerminalAdapter & {
  size: TerminalSize;
  written: string[];
  container: HTMLElement | null;
  type(data: string): void;
  inputWired(): boolean;
};

export function fakeAdapter(size: TerminalSize = { cols: 80, rows: 24 }): FakeAdapter {
  let dataCb: ((data: string) => void) | null = null;
  const adapter: FakeAdapter = {
    size,
    written: [],
    container: null,
    open: vi.fn((container: HTMLElement) => {
      adapter.container = container;
    }),
    write: vi.fn((bytes: Uint8Array) => {
      adapter.written.push(new TextDecoder().decode(bytes));
    }),
    onData: vi.fn((cb: (data: string) => void) => {
      dataCb = cb;
      return () => {
        if (dataCb === cb) dataCb = null;
      };
    }),
    focus: vi.fn(),
    fit: vi.fn(() => ({ ...adapter.size })),
    dispose: vi.fn(),
    type: (data) => dataCb?.(data),
    inputWired: () => dataCb !== null,
  };
  return adapter;
}

export type FakeStream = PaneStream & {
  emit(text: string): void;
  exit(code: number | null): void;
};

export function fakeStream(): FakeStream {
  let outputCb: ((bytes: Uint8Array) => void) | null = null;
  let exitCb: ((code: number | null) => void) | null = null;
  return {
    onOutput: (cb) => void (outputCb = cb),
    onExit: (cb) => void (exitCb = cb),
    dispose: vi.fn(() => {
      outputCb = null;
      exitCb = null;
    }),
    emit: (text) => outputCb?.(new TextEncoder().encode(text)),
    exit: (code) => exitCb?.(code),
  };
}

export type FakeSessions = SessionsClient & {
  opened: { pane: OpenedPane; stream: FakeStream }[];
};

export function fakeSessions(over: Partial<SessionsClient> & { started?: boolean; titles?: string[] } = {}) {
  const { started = true, titles = ["Fix login"], ...methods } = over;
  let next = 0;
  let titleCall = 0;
  const client: FakeSessions = {
    opened: [],
    open: vi.fn(async () => {
      next += 1;
      const pane = { paneId: `p${next}`, sessionId: `s${next}`, started };
      const stream = fakeStream();
      client.opened.push({ pane, stream });
      return { pane, stream };
    }),
    write: vi.fn(async () => {}),
    resize: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    title: vi.fn(async () => titles[Math.min(titleCall++, titles.length - 1)]),
    ...methods,
  };
  return client;
}
