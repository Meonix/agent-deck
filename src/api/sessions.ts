import { Channel, invoke } from "@tauri-apps/api/core";

export type OpenedPane = { paneId: string; sessionId: string; started: boolean };

export type SessionState = "Running" | "Needs Approval" | "Idle" | "Error" | "Ended";

export type PaneStatus = { state: SessionState; since: number; reason: string | null; tracked: boolean };

export interface PaneStream {
  onOutput(cb: (bytes: Uint8Array) => void): void;
  onExit(cb: (code: number | null) => void): void;
  onStatus(cb: (status: PaneStatus) => void): void;
  dispose(): void;
}

export interface SessionsClient {
  open(workspaceId: string, cols: number, rows: number): Promise<{ pane: OpenedPane; stream: PaneStream }>;
  write(paneId: string, data: string): Promise<void>;
  resize(paneId: string, cols: number, rows: number): Promise<void>;
  close(paneId: string): Promise<void>;
  title(paneId: string): Promise<string>;
}

type ExitMessage = { exited: number | null };

function asBytes(message: unknown): Uint8Array | null {
  if (message instanceof Uint8Array) return message;
  // Tag check instead of `instanceof`, which fails for a buffer from another realm.
  if (Object.prototype.toString.call(message) === "[object ArrayBuffer]") {
    return new Uint8Array(message as ArrayBuffer);
  }
  if (ArrayBuffer.isView(message)) return new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  if (Array.isArray(message)) return Uint8Array.from(message as number[]);
  return null;
}

function asExit(message: unknown): ExitMessage | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  return value !== null && typeof value === "object" && "exited" in value ? (value as ExitMessage) : null;
}

function asStatus(message: unknown): PaneStatus | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !("status" in value)) return null;
  const status = (value as { status: unknown }).status;
  return status !== null && typeof status === "object" && "state" in status ? (status as PaneStatus) : null;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Messages can arrive before `open_pane` resolves and before the pane registers
// its listeners, so everything is queued until a listener takes it.
function createStream(channel: Channel<unknown>): PaneStream {
  let pendingOutput: Uint8Array[] = [];
  let pendingExit: ExitMessage | null = null;
  let outputCb: ((bytes: Uint8Array) => void) | null = null;
  let pendingStatus: PaneStatus[] = [];
  let exitCb: ((code: number | null) => void) | null = null;
  let statusCb: ((status: PaneStatus) => void) | null = null;

  // The exit waits for queued statuses: the final status always precedes it.
  const deliverExit = () => {
    if (pendingExit && exitCb && pendingOutput.length === 0 && pendingStatus.length === 0) {
      const { exited } = pendingExit;
      pendingExit = null;
      exitCb(exited);
    }
  };

  channel.onmessage = (message) => {
    const bytes = asBytes(message);
    if (bytes) {
      if (outputCb && pendingOutput.length === 0) outputCb(bytes);
      else pendingOutput.push(bytes);
      return;
    }
    const status = asStatus(message);
    if (status) {
      if (statusCb && pendingStatus.length === 0) statusCb(status);
      else pendingStatus.push(status);
      return;
    }
    const exit = asExit(message);
    if (exit) {
      pendingExit = exit;
      deliverExit();
    }
  };

  return {
    onOutput(cb) {
      outputCb = cb;
      const queued = pendingOutput;
      pendingOutput = [];
      queued.forEach(cb);
      deliverExit();
    },
    onExit(cb) {
      exitCb = cb;
      deliverExit();
    },
    onStatus(cb) {
      statusCb = cb;
      const queued = pendingStatus;
      pendingStatus = [];
      queued.forEach(cb);
      deliverExit();
    },
    dispose() {
      channel.onmessage = () => {};
      outputCb = null;
      exitCb = null;
      statusCb = null;
      pendingStatus = [];
      pendingOutput = [];
      pendingExit = null;
    },
  };
}

export const tauriSessionsClient: SessionsClient = {
  async open(workspaceId, cols, rows) {
    const output = new Channel<unknown>();
    const stream = createStream(output);
    try {
      const pane = await invoke<OpenedPane>("open_pane", { workspaceId, cols, rows, output });
      return { pane, stream };
    } catch (e) {
      stream.dispose();
      throw e;
    }
  },
  write: (paneId, data) => invoke<void>("pane_write", { paneId, data }),
  resize: (paneId, cols, rows) => invoke<void>("pane_resize", { paneId, cols, rows }),
  close: (paneId) => invoke<void>("close_pane", { paneId }),
  title: (paneId) => invoke<string>("pane_title", { paneId }),
};
