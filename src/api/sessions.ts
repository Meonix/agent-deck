import { Channel, invoke } from "@tauri-apps/api/core";
import type { Activity, ChatMessage } from "../components/chatState";

export type OpenedPane = { paneId: string; sessionId: string; started: boolean };

export type SessionState = "Running" | "Needs Approval" | "Idle" | "Error" | "Ended";

export type PaneStatus = {
  state: SessionState;
  since: number;
  reason: string | null;
  tracked: boolean;
};

export type SessionRow = { id: string; title: string; lastActivity: number };
export type SessionListing = { sessions: SessionRow[]; unreadable: number };

export interface PaneStream {
  onOutput(cb: (bytes: Uint8Array) => void): void;
  onExit(cb: (code: number | null) => void): void;
  onStatus(cb: (status: PaneStatus) => void): void;
  /** The session Claude Code moved the pane to, as after `/clear`. */
  onSession(cb: (sessionId: string) => void): void;
  onChat(cb: (message: ChatMessage) => void): void;
  onActivity(cb: (activity: Activity) => void): void;
  dispose(): void;
}

/** A shell sends output and its exit, never a status, a session, a chat or an activity. */
export type ShellStream = Omit<PaneStream, "onStatus" | "onSession" | "onChat" | "onActivity">;

/** `command`: what the shell runs in its foreground; null while busy means the name could not be read. */
export type ShellActivity = { busy: boolean; command: string | null };

export interface SessionsClient {
  /** Passing `resumeSessionId` continues that session; rejects with "already_open" while a pane runs it. */
  open(
    workspaceId: string,
    cols: number,
    rows: number,
    resumeSessionId?: string,
  ): Promise<{ pane: OpenedPane; stream: PaneStream }>;
  write(paneId: string, data: string): Promise<void>;
  resize(paneId: string, cols: number, rows: number): Promise<void>;
  close(paneId: string): Promise<void>;
  title(paneId: string): Promise<string>;
  /** The workspace's Claude Code sessions, newest first; rejects with "folder_missing". */
  list(workspaceId: string): Promise<SessionListing>;
  /**
   * Moves the session's files to the trash; with `paneId` that pane's session is ended first.
   * Rejects with "not_found" when nothing of it is on disk.
   */
  deleteSession(workspaceId: string, sessionId: string, paneId?: string): Promise<void>;
  /**
   * Starts the pane's shell in its workspace folder; the pane's `close` ends it.
   * Rejects with "not_found", "already_open", "shell_failed" or "folder_missing".
   */
  openShell(paneId: string, cols: number, rows: number): Promise<{ stream: ShellStream }>;
  shellWrite(paneId: string, data: string): Promise<void>;
  shellResize(paneId: string, cols: number, rows: number): Promise<void>;
  /** Rejects with "not_found" when the pane has no shell. */
  shellActivity(paneId: string): Promise<ShellActivity>;
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

const STATES: readonly SessionState[] = ["Running", "Needs Approval", "Idle", "Error", "Ended"];

function asStatus(message: unknown): PaneStatus | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !("status" in value)) return null;
  const status = (value as { status: unknown }).status;
  if (status === null || typeof status !== "object") return null;
  const { state, since, reason, tracked } = status as Record<string, unknown>;
  const valid =
    typeof state === "string" &&
    (STATES as readonly string[]).includes(state) &&
    typeof since === "number" &&
    (reason === null || typeof reason === "string") &&
    typeof tracked === "boolean";
  return valid ? ({ state, since, reason, tracked } as PaneStatus) : null;
}

function asSession(message: unknown): string | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !("session" in value)) return null;
  const { session } = value as { session: unknown };
  return typeof session === "string" ? session : null;
}

function field(message: unknown, name: string): Record<string, unknown> | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !(name in value)) return null;
  const inner = (value as Record<string, unknown>)[name];
  return inner !== null && typeof inner === "object" ? (inner as Record<string, unknown>) : null;
}

function asChat(message: unknown): ChatMessage | null {
  const chat = field(message, "chat");
  if (!chat) return null;
  const out: ChatMessage = {};
  if (chat.reset === true) out.reset = true;
  if (chat.unreadable === true) out.unreadable = true;
  if (Array.isArray(chat.items)) out.items = chat.items as ChatMessage["items"];
  return out;
}

function asActivity(message: unknown): Activity | null {
  const a = field(message, "activity");
  if (!a) return null;
  const text = (v: unknown) => v === null || typeof v === "string";
  const valid =
    text(a.tool) && text(a.arg) && (a.context === null || typeof a.context === "number") &&
    typeof a.shells === "number" && typeof a.subagents === "number";
  return valid ? (a as Activity) : null;
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
  let pendingSession: string[] = [];
  let sessionCb: ((sessionId: string) => void) | null = null;
  let statusCb: ((status: PaneStatus) => void) | null = null;
  let pendingChat: ChatMessage[] = [];
  let chatCb: ((message: ChatMessage) => void) | null = null;
  let pendingActivity: Activity[] = [];
  let activityCb: ((activity: Activity) => void) | null = null;

  // The exit waits for queued statuses once a status listener exists: the final status precedes it.
  const deliverExit = () => {
    if (pendingExit && exitCb && pendingOutput.length === 0 && (pendingStatus.length === 0 || !statusCb)) {
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
    const session = asSession(message);
    if (session) {
      if (sessionCb && pendingSession.length === 0) sessionCb(session);
      else pendingSession.push(session);
      return;
    }
    const chat = asChat(message);
    if (chat) {
      if (chatCb && pendingChat.length === 0) chatCb(chat);
      else pendingChat.push(chat);
      return;
    }
    const activity = asActivity(message);
    if (activity) {
      if (activityCb && pendingActivity.length === 0) activityCb(activity);
      else pendingActivity.push(activity);
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
    onSession(cb) {
      sessionCb = cb;
      const queued = pendingSession;
      pendingSession = [];
      queued.forEach(cb);
    },
    onChat(cb) {
      chatCb = cb;
      const queued = pendingChat;
      pendingChat = [];
      queued.forEach(cb);
    },
    onActivity(cb) {
      activityCb = cb;
      const queued = pendingActivity;
      pendingActivity = [];
      queued.forEach(cb);
    },
    dispose() {
      channel.onmessage = () => {};
      chatCb = null;
      pendingChat = [];
      activityCb = null;
      pendingActivity = [];
      sessionCb = null;
      pendingSession = [];
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
  async open(workspaceId, cols, rows, resumeSessionId) {
    const output = new Channel<unknown>();
    const stream = createStream(output);
    try {
      const pane = await invoke<OpenedPane>("open_pane", { workspaceId, cols, rows, resumeSessionId: resumeSessionId ?? null, output });
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
  list: (workspaceId) => invoke<SessionListing>("list_sessions", { workspaceId }),
  deleteSession: (workspaceId, sessionId, paneId) =>
    invoke<void>("delete_session", { workspaceId, sessionId, paneId: paneId ?? null }),
  async openShell(paneId, cols, rows) {
    const output = new Channel<unknown>();
    const stream = createStream(output);
    try {
      await invoke<void>("open_shell", { paneId, cols, rows, output });
      return { stream };
    } catch (e) {
      // The backend may still send `{"exited": null}` on this channel after a failed start.
      stream.dispose();
      throw e;
    }
  },
  shellWrite: (paneId, data) => invoke<void>("shell_write", { paneId, data }),
  shellResize: (paneId, cols, rows) => invoke<void>("shell_resize", { paneId, cols, rows }),
  shellActivity: (paneId) => invoke<ShellActivity>("shell_activity", { paneId }),
};
