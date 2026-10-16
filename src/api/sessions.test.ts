import { beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => {
  class FakeChannel<T> {
    static last: FakeChannel<unknown> | null = null;
    onmessage: (m: T) => void;
    constructor(onmessage?: (m: T) => void) {
      this.onmessage = onmessage ?? (() => {});
      FakeChannel.last = this as FakeChannel<unknown>;
    }
  }
  return { FakeChannel, invoke: vi.fn() };
});

vi.mock("@tauri-apps/api/core", () => ({ Channel: tauri.FakeChannel, invoke: tauri.invoke }));

import { tauriSessionsClient } from "./sessions";

const opened = { paneId: "p1", sessionId: "s1", started: true };
const send = (m: unknown) => tauri.FakeChannel.last!.onmessage(m);
const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array) => new TextDecoder().decode(b);

beforeEach(() => {
  tauri.invoke.mockReset();
  tauri.FakeChannel.last = null;
});

describe("tauriSessionsClient (5.1)", () => {
  it("opens with the channel created before the invoke", async () => {
    tauri.invoke.mockImplementation(async (_cmd: string, args: { output: unknown }) => {
      expect(args.output).toBe(tauri.FakeChannel.last);
      return opened;
    });
    const { pane } = await tauriSessionsClient.open("w1", 120, 40);
    expect(pane).toEqual(opened);
    expect(tauri.invoke).toHaveBeenCalledWith("open_pane", {
      workspaceId: "w1",
      cols: 120,
      rows: 40,
      output: tauri.FakeChannel.last,
    });
  });

  it("buffers output sent before the open resolves and before a listener exists", async () => {
    tauri.invoke.mockImplementation(async () => {
      send(bytes("he").buffer);
      send(bytes("llo"));
      return opened;
    });
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const seen: string[] = [];
    stream.onOutput((b) => seen.push(text(b)));
    send(bytes("!").buffer);
    expect(seen).toEqual(["he", "llo", "!"]);
  });

  it("reports the exit message after the output, also when it came early", async () => {
    tauri.invoke.mockImplementation(async () => {
      send(bytes("bye").buffer);
      send({ exited: 3 });
      return opened;
    });
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const events: string[] = [];
    stream.onOutput((b) => events.push(text(b)));
    stream.onExit((code) => events.push(`exit ${code}`));
    expect(events).toEqual(["bye", "exit 3"]);
  });

  it("queues a status sent before onStatus and delivers it, then later ones live", async () => {
    const status = { state: "Needs Approval", since: 1760000000000, reason: "Edit src/main.rs", tracked: true, reportedAt: 1760000000000 };
    tauri.invoke.mockImplementation(async () => {
      send({ status });
      return opened;
    });
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const seen: unknown[] = [];
    stream.onStatus((s) => seen.push(s));
    expect(seen).toEqual([status]);
    send(JSON.stringify({ status: { ...status, state: "Running", reason: null } }));
    expect(seen).toHaveLength(2);
    expect(seen[1]).toMatchObject({ state: "Running", reason: null });
  });

  it("delivers a status queued before the exit ahead of the exit", async () => {
    tauri.invoke.mockImplementation(async () => {
      send({ status: { state: "Ended", since: 1, reason: null, tracked: true } });
      send({ exited: 0 });
      return opened;
    });
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const events: string[] = [];
    stream.onStatus((s) => events.push(`status ${s.state}`));
    stream.onExit((code) => events.push(`exit ${code}`));
    expect(events).toEqual(["status Ended", "exit 0"]);
  });

  it("ignores a status with an unknown state or wrong field types", async () => {
    tauri.invoke.mockResolvedValue(opened);
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const seen: unknown[] = [];
    stream.onStatus((s) => seen.push(s));
    send({ status: { state: "Sleeping", since: 1, reason: null, tracked: true } });
    send({ status: { state: "Idle", since: "1", reason: null, tracked: true } });
    send({ status: { state: "Idle", since: 1, reason: null, tracked: "yes" } });
    send({ status: { state: "Idle", since: 1, reason: 5, tracked: true } });
    expect(seen).toEqual([]);
  });

  it("delivers the exit when no status listener was registered", async () => {
    tauri.invoke.mockImplementation(async () => {
      send({ status: { state: "Ended", since: 1, reason: null, tracked: true } });
      send({ exited: 0 });
      return opened;
    });
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const onExit = vi.fn();
    stream.onExit(onExit);
    expect(onExit).toHaveBeenCalledWith(0);
  });

  it("passes a null exit code through", async () => {
    tauri.invoke.mockResolvedValue(opened);
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const onExit = vi.fn();
    stream.onExit(onExit);
    send({ exited: null });
    expect(onExit).toHaveBeenCalledWith(null);
  });

  it("stops delivering after dispose", async () => {
    tauri.invoke.mockResolvedValue(opened);
    const { stream } = await tauriSessionsClient.open("w1", 80, 24);
    const onOutput = vi.fn();
    stream.onOutput(onOutput);
    stream.dispose();
    send(bytes("late").buffer);
    expect(onOutput).not.toHaveBeenCalled();
  });

  it("rejects with the backend reason", async () => {
    tauri.invoke.mockRejectedValue("folder_missing");
    await expect(tauriSessionsClient.open("w1", 80, 24)).rejects.toBe("folder_missing");
  });

  it("maps write, resize, close and title to their commands", async () => {
    tauri.invoke.mockResolvedValue("Fix login");
    await tauriSessionsClient.write("p1", "ls\r");
    await tauriSessionsClient.resize("p1", 100, 30);
    await tauriSessionsClient.close("p1");
    expect(await tauriSessionsClient.title("p1")).toBe("Fix login");
    expect(tauri.invoke.mock.calls).toEqual([
      ["pane_write", { paneId: "p1", data: "ls\r" }],
      ["pane_resize", { paneId: "p1", cols: 100, rows: 30 }],
      ["close_pane", { paneId: "p1" }],
      ["pane_title", { paneId: "p1" }],
    ]);
  });
});
