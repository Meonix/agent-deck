import { vi } from "vitest";
import type { OpenedPane, PaneStatus, PaneStream, SessionsClient } from "../api/sessions";
import type { TerminalAdapter, TerminalSize } from "../components/TerminalPane";

export type FakeAdapter = TerminalAdapter & {
  size: TerminalSize;
  written: string[];
  container: HTMLElement | null;
  type(data: string): void;
  sendBinary(data: string): void;
  inputWired(): boolean;
};

export function fakeAdapter(size: TerminalSize = { cols: 80, rows: 24 }): FakeAdapter {
  let dataCb: ((data: string) => void) | null = null;
  let binaryCb: ((data: string) => void) | null = null;
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
    onBinary: vi.fn((cb: (data: string) => void) => {
      binaryCb = cb;
      return () => {
        if (binaryCb === cb) binaryCb = null;
      };
    }),
    focus: vi.fn(),
    fit: vi.fn(() => ({ ...adapter.size })),
    dispose: vi.fn(),
    type: (data) => dataCb?.(data),
    sendBinary: (data) => binaryCb?.(data),
    inputWired: () => dataCb !== null,
  };
  return adapter;
}

export type FakeStream = PaneStream & {
  emit(text: string): void;
  exit(code: number | null): void;
  status(status: Partial<PaneStatus> & { state: PaneStatus["state"] }): void;
};

export function fakeStream(): FakeStream {
  let outputCb: ((bytes: Uint8Array) => void) | null = null;
  let exitCb: ((code: number | null) => void) | null = null;
  let statusCb: ((status: PaneStatus) => void) | null = null;
  return {
    onOutput: (cb) => void (outputCb = cb),
    onExit: (cb) => void (exitCb = cb),
    onStatus: (cb) => void (statusCb = cb),
    dispose: vi.fn(() => {
      outputCb = null;
      exitCb = null;
      statusCb = null;
    }),
    emit: (text) => outputCb?.(new TextEncoder().encode(text)),
    exit: (code) => exitCb?.(code),
    status: (status) => statusCb?.({ since: Date.now(), reason: null, tracked: true, reportedAt: null, ...status }),
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
    open: vi.fn(async (_workspaceId: string, _cols: number, _rows: number, resumeSessionId?: string) => {
      next += 1;
      const pane = { paneId: `p${next}`, sessionId: resumeSessionId ?? `s${next}`, started };
      const stream = fakeStream();
      client.opened.push({ pane, stream });
      return { pane, stream };
    }),
    write: vi.fn(async () => {}),
    resize: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    title: vi.fn(async () => titles[Math.min(titleCall++, titles.length - 1)]),
    recordStatusShown: vi.fn(async () => {}),
    latencyReport: vi.fn(async () => ({ within: 0, total: 0 })),
    list: vi.fn(async () => ({ sessions: [], unreadable: 0 })),
    ...methods,
  };
  return client;
}
