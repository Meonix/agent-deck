import type { TerminalAdapter, TerminalAdapterFactory } from "./components/TerminalPane";

export type DiagLevel = "ERROR" | "WARN" | "INFO";

/** What the UI holds, counted by the UI; the backend warns when the counts disagree. */
export type UiReport = { terminals: number; expectedTerminals: number; titleTimers: number; livePanes: number };

export type DiagClient = {
  log(level: DiagLevel, source: string, message: string): Promise<void>;
  report(report: UiReport): Promise<void>;
};

const ERRORS_PER_MINUTE = 20;
const MINUTE = 60_000;

/** Sends uncaught errors and unhandled rejections to the diagnostic log; returns the remover. */
export function installErrorHooks(client: DiagClient, target: Window): () => void {
  let sent = 0;
  let dropped = 0;
  let minuteTimer: ReturnType<typeof setTimeout> | null = null;
  // A failing log call must not raise the next unhandled rejection.
  const send = (level: DiagLevel, source: string, message: string) => void client.log(level, source, message).catch(() => {});

  const record = (source: string, message: string) => {
    minuteTimer ??= setTimeout(() => {
      if (dropped > 0) send("WARN", "diagnostics", `dropped ${dropped} UI errors in one minute`);
      sent = 0;
      dropped = 0;
      minuteTimer = null;
    }, MINUTE);
    if (sent < ERRORS_PER_MINUTE) {
      sent += 1;
      send("ERROR", source, message);
    } else {
      dropped += 1;
    }
  };

  const onError = (e: ErrorEvent) => record("window", e.filename ? `${e.message} at ${e.filename}:${e.lineno}` : e.message);
  const onRejection = (e: PromiseRejectionEvent) => record("promise", String(e.reason));
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    if (minuteTimer !== null) clearTimeout(minuteTimer);
  };
}

/** Wraps a terminal factory to count terminals that were created and not disposed yet. */
export function countTerminals(factory: TerminalAdapterFactory): { factory: TerminalAdapterFactory; live(): number } {
  let live = 0;
  return {
    factory: () => {
      const adapter = factory();
      live += 1;
      let disposed = false;
      const counted: TerminalAdapter = {
        ...adapter,
        dispose: () => {
          if (!disposed) live -= 1;
          disposed = true;
          adapter.dispose();
        },
      };
      return counted;
    },
    live: () => live,
  };
}
