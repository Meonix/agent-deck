import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { TerminalAdapter } from "./TerminalPane";

const SCROLLBACK = 10_000;

// Kept apart from TerminalPane so tests, which use a fake adapter, never load xterm.
export function createXtermAdapter(): TerminalAdapter {
  // xterm draws on a canvas, which cannot resolve CSS variables, so read their values now.
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim() || undefined;
  const terminal = new Terminal({
    scrollback: SCROLLBACK,
    fontFamily: token("--font-mono"),
    // xterm's default cursor and selection are light, invisible on the light theme.
    theme: {
      background: token("--background"),
      foreground: token("--foreground"),
      cursor: token("--foreground"),
      cursorAccent: token("--background"),
      selectionBackground: token("--ring"),
    },
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  return {
    open(container) {
      if (terminal.element) {
        if (terminal.element.parentElement !== container) container.appendChild(terminal.element);
        return;
      }
      terminal.open(container);
      try {
        const webgl = new WebglAddon();
        // Too many live WebGL contexts make the browser drop old ones; xterm then falls back to its DOM renderer.
        webgl.onContextLoss(() => webgl.dispose());
        terminal.loadAddon(webgl);
      } catch {
        // No WebGL: the DOM renderer stays.
      }
    },
    write: (bytes) => terminal.write(bytes),
    onData(cb) {
      const subscription = terminal.onData(cb);
      return () => subscription.dispose();
    },
    onBinary(cb) {
      const subscription = terminal.onBinary(cb);
      return () => subscription.dispose();
    },
    focus: () => terminal.focus(),
    fit() {
      fitAddon.fit();
      return { cols: terminal.cols, rows: terminal.rows };
    },
    dispose: () => terminal.dispose(),
  };
}
