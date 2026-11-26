import { vi } from "vitest";
import type { OpenedPane, PaneStatus, PaneStream, SessionsClient } from "../api/sessions";
import type { Activity, ChatMessage } from "../components/chatState";
import type { ScreenLine } from "../components/TerminalPane";
import type { TerminalAdapter, TerminalSize } from "../components/TerminalPane";

export type FakeAdapter = TerminalAdapter & {
  size: TerminalSize;
  written: string[];
  container: HTMLElement | null;
  type(data: string): void;
  sendBinary(data: string): void;
  inputWired(): boolean;
  /** Puts `lines` on the screen and fires the screen change, as written output would. */
  showScreen(lines: ScreenLine[]): void;
};

export function fakeAdapter(size: TerminalSize = { cols: 80, rows: 24 }): FakeAdapter {
  let dataCb: ((data: string) => void) | null = null;
  let binaryCb: ((data: string) => void) | null = null;
  const screenCbs = new Set<() => void>();
  const adapter: FakeAdapter = {
    size,
    written: [],
    container: null,
    open: vi.fn((container: HTMLElement) => {
      adapter.container = container;
      // Stands in for xterm's helper textarea, so focus() moves real DOM focus like xterm does.
      const input = document.createElement("textarea");
      input.setAttribute("aria-hidden", "true");
      container.appendChild(input);
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
    // jsdom ignores `inert`; a browser does not focus inside it.
    focus: vi.fn(() => {
      if (adapter.container?.closest("[inert]")) return;
      adapter.container?.querySelector("textarea")?.focus();
    }),
    fit: vi.fn(() => ({ ...adapter.size })),
    screen: vi.fn((): ScreenLine[] => []),
    onScreenChange: vi.fn((cb: () => void) => {
      screenCbs.add(cb);
      return () => void screenCbs.delete(cb);
    }),
    bracketedPaste: vi.fn(() => true),
    cols: vi.fn(() => adapter.size.cols),
    dispose: vi.fn(),
    type: (data) => dataCb?.(data),
    sendBinary: (data) => binaryCb?.(data),
    inputWired: () => dataCb !== null,
    showScreen: (lines) => {
      vi.mocked(adapter.screen).mockReturnValue(lines);
      screenCbs.forEach((cb) => cb());
    },
  };
  return adapter;
}

export type FakeStream = PaneStream & {
  emit(text: string): void;
  exit(code: number | null): void;
  status(status: Partial<PaneStatus> & { state: PaneStatus["state"] }): void;
  session(id: string): void;
  chat(message: ChatMessage): void;
  activity(activity: Activity): void;
};

export function fakeStream(): FakeStream {
  let outputCb: ((bytes: Uint8Array) => void) | null = null;
  let exitCb: ((code: number | null) => void) | null = null;
  let statusCb: ((status: PaneStatus) => void) | null = null;
  let sessionCb: ((id: string) => void) | null = null;
  let chatCb: ((message: ChatMessage) => void) | null = null;
  let activityCb: ((activity: Activity) => void) | null = null;
  return {
    onOutput: (cb) => void (outputCb = cb),
    onExit: (cb) => void (exitCb = cb),
    onStatus: (cb) => void (statusCb = cb),
    onSession: (cb) => void (sessionCb = cb),
    onChat: (cb) => void (chatCb = cb),
    onActivity: (cb) => void (activityCb = cb),
    dispose: vi.fn(() => {
      sessionCb = null;
      outputCb = null;
      exitCb = null;
      statusCb = null;
      chatCb = null;
      activityCb = null;
    }),
    emit: (text) => outputCb?.(new TextEncoder().encode(text)),
    exit: (code) => exitCb?.(code),
    session: (id) => sessionCb?.(id),
    chat: (message) => chatCb?.(message),
    activity: (activity) => activityCb?.(activity),
    status: (status) => statusCb?.({ since: Date.now(), reason: null, tracked: true, ...status }),
  };
}

export type FakeSessions = SessionsClient & {
  opened: { pane: OpenedPane; stream: FakeStream }[];
  shells: { paneId: string; stream: FakeStream }[];
};

export function fakeSessions(over: Partial<SessionsClient> & { started?: boolean; titles?: string[] } = {}) {
  const { started = true, titles = ["Fix login"], ...methods } = over;
  let next = 0;
  let titleCall = 0;
  const client: FakeSessions = {
    opened: [],
    shells: [],
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
    list: vi.fn(async () => ({ sessions: [], unreadable: 0 })),
    deleteSession: vi.fn(async () => {}),
    openShell: vi.fn(async (paneId: string) => {
      const stream = fakeStream();
      client.shells.push({ paneId, stream });
      return { stream };
    }),
    shellWrite: vi.fn(async () => {}),
    shellResize: vi.fn(async () => {}),
    shellActivity: vi.fn(async () => ({ busy: false, command: null })),
    ...methods,
  };
  return client;
}
