import { Terminal } from "@xterm/xterm";
import { describe, expect, it, vi } from "vitest";
import { inputReadiness, type ScreenLine } from "./inputReady";
import { createXtermAdapter } from "./xtermAdapter";

// Claude Code's idle input box as it wrote it, with the rules cut to xterm's default 80 columns.
const RULE = `\x1b[38;2;59;130;246m${"─".repeat(80)}\x1b[39m`;
const IDLE_BOX = [
  "\x1b[?2004h",
  `${RULE}\r\r\n`,
  `❯\xa0\x1b[2mTry\x1b[7G"how\x1b[12Gdo\x1b[15GI\x1b[17Glog\x1b[21Gan\x1b[24Gerror?"\x1b[22m\r\r\n`,
  `${RULE}\r\r\n`,
].join("");

// xterm parses written bytes asynchronously.
async function screenWhen(read: () => ScreenLine[], done: (screen: ScreenLine[]) => boolean): Promise<ScreenLine[]> {
  for (let i = 0; i < 100; i++) {
    const screen = read();
    if (done(screen)) return screen;
    await new Promise((resolve) => setTimeout(resolve));
  }
  throw new Error("xterm did not parse the output");
}

describe("xterm adapter screen", () => {
  it("reads the rows, the dim cells and the paste mode Claude Code wrote", async () => {
    const adapter = createXtermAdapter();
    expect(adapter.bracketedPaste()).toBe(false);

    adapter.write(new TextEncoder().encode(IDLE_BOX));
    const screen = await screenWhen(
      () => adapter.screen(),
      (rows) => rows.some((row) => row.text.startsWith("❯")),
    );

    const prompt = screen.find((row) => row.text.startsWith("❯"))!;
    expect(prompt.text).toBe('❯\xa0Try "how do I log an error?"');
    expect(prompt.dim[0]).toBe(false);
    expect(prompt.dim.slice(2, 5)).toEqual([true, true, true]);
    expect(screen.filter((row) => row.text === "─".repeat(80))).toHaveLength(2);
    expect(adapter.bracketedPaste()).toBe(true);
    expect(adapter.cols()).toBe(80);
    expect(inputReadiness(screen, "Idle", adapter.cols())).toEqual({ ready: true });
    adapter.dispose();
  });

  it("reads the live screen while the user has scrolled up", async () => {
    // The adapter keeps its Terminal private; the spy hands the test the real instance.
    const attach = vi.spyOn(Terminal.prototype, "attachCustomKeyEventHandler");
    const adapter = createXtermAdapter();
    const terminal = attach.mock.contexts[0] as Terminal;
    attach.mockRestore();

    const filler = Array.from({ length: 30 }, (_, i) => `line ${i}\r\n`).join("");
    adapter.write(new TextEncoder().encode(`${IDLE_BOX}${filler} Esc to cancel`));
    await screenWhen(
      () => adapter.screen(),
      (rows) => rows.some((row) => row.text.includes("Esc to cancel")),
    );
    terminal.scrollLines(-20);

    const screen = adapter.screen();
    expect(terminal.buffer.active.viewportY).toBeLessThan(terminal.buffer.active.baseY);
    expect(screen[screen.length - 1].text).toBe(" Esc to cancel");
    expect(inputReadiness(screen, "Idle", adapter.cols())).toEqual({ ready: false, reason: "approval" });
    adapter.dispose();
  });

  it("tells once written output is on the screen, until the listener is removed", async () => {
    const adapter = createXtermAdapter();
    const seen: string[] = [];
    const stop = adapter.onScreenChange(() => seen.push(adapter.screen()[0].text));
    adapter.write(new TextEncoder().encode("xin chào"));
    await vi.waitFor(() => expect(seen).toEqual(["xin chào"]));

    stop();
    adapter.write(new TextEncoder().encode("!"));
    await screenWhen(
      () => adapter.screen(),
      (rows) => rows[0].text === "xin chào!",
    );
    expect(seen).toEqual(["xin chào"]);
    adapter.dispose();
  });
});
