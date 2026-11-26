import { describe, expect, it } from "vitest";
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
    expect(inputReadiness(screen, "Idle")).toEqual({ ready: true });
    adapter.dispose();
  });
});
