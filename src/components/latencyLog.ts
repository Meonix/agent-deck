import type { TerminalAdapter } from "./TerminalPane";

const SAMPLE_COUNT = 200;

/** Opt-in for the SRS-NFR-002 demo: `localStorage.adLatency = "1"`, also in a release build. */
export function latencyLogEnabled(): boolean {
  try {
    return localStorage.getItem("adLatency") === "1";
  } catch {
    return false;
  }
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

/** Measures keystroke → next output chunk, from the oldest keystroke still waiting. */
export function withLatencyLog(
  adapter: TerminalAdapter,
  now: () => number = () => performance.now(),
  log: (line: string) => void = (line) => console.info(line),
): TerminalAdapter {
  let waitingSince: number | null = null;
  let samples: number[] = [];

  return {
    open: (container) => adapter.open(container),
    focus: () => adapter.focus(),
    fit: () => adapter.fit(),
    dispose: () => adapter.dispose(),
    // Mouse reports are not keystrokes; they pass through untimed.
    onBinary: (cb) => adapter.onBinary(cb),
    onData: (cb) =>
      adapter.onData((data) => {
        waitingSince ??= now();
        cb(data);
      }),
    write(bytes) {
      if (waitingSince !== null) {
        samples.push(now() - waitingSince);
        waitingSince = null;
        if (samples.length === SAMPLE_COUNT) {
          const sorted = [...samples].sort((a, b) => a - b);
          const p50 = percentile(sorted, 0.5).toFixed(1);
          const p95 = percentile(sorted, 0.95).toFixed(1);
          log(`adLatency p50 ${p50} ms, p95 ${p95} ms over ${SAMPLE_COUNT} keystrokes`);
          samples = [];
        }
      }
      adapter.write(bytes);
    },
  };
}
