import { Channel, invoke } from "@tauri-apps/api/core";

export type OpenedPane = { paneId: string; sessionId: string; started: boolean };

export type SessionState = "Running" | "Needs Approval" | "Idle" | "Error" | "Ended";

export type PaneStatus = {
  state: SessionState;
  since: number;
  reason: string | null;
  tracked: boolean;
  /** When the change reached the app; null when the message only marks the pane tracked. */
  reportedAt: number | null;
};

export type LatencyReport = { within: number; total: number };

export type Checkpoint = { summary: string; result: string; done: boolean; startedAt: string };
export type PaneProgress = {
  tracking: "unset" | "on" | "off";
  checkpoints: Checkpoint[];
  collapsed: boolean;
  updating: boolean;
  failed: boolean;
};

export type SessionRow = { id: string; title: string; lastActivity: number };
export type SessionListing = { sessions: SessionRow[]; unreadable: number };

export interface PaneStream {
  onOutput(cb: (bytes: Uint8Array) => void): void;
  onExit(cb: (code: number | null) => void): void;
  onStatus(cb: (status: PaneStatus) => void): void;
  /** The Session Goal of the pane's session; null when it has none. */
  onGoal(cb: (goal: string | null) => void): void;
  /** The pane's progress tracking state and checkpoints; sent again on every change. */
  onProgress(cb: (progress: PaneProgress) => void): void;
  /** The session Claude Code moved the pane to, as after `/clear`. */
  onSession(cb: (sessionId: string) => void): void;
  dispose(): void;
}

/** A shell sends output and its exit, never a status or a goal. */
export type ShellStream = Omit<PaneStream, "onStatus" | "onGoal" | "onProgress" | "onSession">;

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
  recordStatusShown(sessionId: string, state: SessionState, reportedAt: number, shownAt: number): Promise<void>;
  latencyReport(): Promise<LatencyReport>;
  /** Replaces the pane's goal; the new goal comes back on the stream. Rejects with "not_found" or "not_started". */
  setGoal(paneId: string, text: string): Promise<void>;
  /** Turns progress tracking on or off; the new state comes back on the stream. */
  setProgressTracking(paneId: string, on: boolean): Promise<void>;
  /** Remembers whether the strip is collapsed; the new state comes back on the stream. */
  setProgressCollapsed(paneId: string, collapsed: boolean): Promise<void>;
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
  const { state, since, reason, tracked, reportedAt = null } = status as Record<string, unknown>;
  const valid =
    typeof state === "string" &&
    (STATES as readonly string[]).includes(state) &&
    typeof since === "number" &&
    (reason === null || typeof reason === "string") &&
    typeof tracked === "boolean" &&
    (reportedAt === null || typeof reportedAt === "number");
  return valid ? ({ ...(status as PaneStatus), reportedAt } as PaneStatus) : null;
}

type GoalMessage = { goal: string | null };

function asSession(message: unknown): string | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !("session" in value)) return null;
  const { session } = value as { session: unknown };
  return typeof session === "string" ? session : null;
}

function asGoal(message: unknown): GoalMessage | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !("goal" in value)) return null;
  const { goal } = value as { goal: unknown };
  return goal === null || typeof goal === "string" ? { goal } : null;
}

function isCheckpoint(value: unknown): value is Checkpoint {
  if (value === null || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.summary === "string" && typeof c.result === "string" && typeof c.done === "boolean" && typeof c.startedAt === "string";
}

function asProgress(message: unknown): PaneProgress | null {
  const value = typeof message === "string" ? safeParse(message) : message;
  if (value === null || typeof value !== "object" || !("progress" in value)) return null;
  const { progress } = value as { progress: unknown };
  if (progress === null || typeof progress !== "object") return null;
  const p = progress as Record<string, unknown>;
  const valid =
    (p.tracking === "unset" || p.tracking === "on" || p.tracking === "off") &&
    Array.isArray(p.checkpoints) &&
    p.checkpoints.every(isCheckpoint) &&
    typeof p.collapsed === "boolean" &&
    typeof p.updating === "boolean" &&
    typeof p.failed === "boolean";
  return valid ? (progress as PaneProgress) : null;
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
  let pendingGoal: GoalMessage[] = [];
  let exitCb: ((code: number | null) => void) | null = null;
  let pendingProgress: PaneProgress[] = [];
  let progressCb: ((progress: PaneProgress) => void) | null = null;
  let goalCb: ((goal: string | null) => void) | null = null;
  let pendingSession: string[] = [];
  let sessionCb: ((sessionId: string) => void) | null = null;
  let statusCb: ((status: PaneStatus) => void) | null = null;

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
    const goal = asGoal(message);
    if (goal) {
      if (goalCb && pendingGoal.length === 0) goalCb(goal.goal);
      else pendingGoal.push(goal);
      return;
    }
    const progress = asProgress(message);
    if (progress) {
      if (progressCb && pendingProgress.length === 0) progressCb(progress);
      else pendingProgress.push(progress);
      return;
    }
    const session = asSession(message);
    if (session) {
      if (sessionCb && pendingSession.length === 0) sessionCb(session);
      else pendingSession.push(session);
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
    onGoal(cb) {
      goalCb = cb;
      const queued = pendingGoal;
      pendingGoal = [];
      queued.forEach((m) => cb(m.goal));
    },
    onProgress(cb) {
      progressCb = cb;
      const queued = pendingProgress;
      pendingProgress = [];
      queued.forEach(cb);
    },
    onSession(cb) {
      sessionCb = cb;
      const queued = pendingSession;
      pendingSession = [];
      queued.forEach(cb);
    },
    dispose() {
      channel.onmessage = () => {};
      goalCb = null;
      pendingGoal = [];
      progressCb = null;
      pendingProgress = [];
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
  recordStatusShown: (sessionId, state, reportedAt, shownAt) =>
    invoke<void>("record_status_shown", { sessionId, state, reportedAt, shownAt }),
  latencyReport: () => invoke<LatencyReport>("status_latency_report"),
  setGoal: (paneId, text) => invoke<void>("set_session_goal", { paneId, text }),
  setProgressTracking: (paneId, on) => invoke<void>("set_progress_tracking", { paneId, on }),
  setProgressCollapsed: (paneId, collapsed) => invoke<void>("set_progress_collapsed", { paneId, collapsed }),
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
