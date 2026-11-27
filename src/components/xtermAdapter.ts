import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { ScreenLine, TerminalAdapter } from "./TerminalPane";

const SCROLLBACK = 10_000;

// Named keys ("Backspace", "ArrowLeft", "F12") are ASCII words starting with a capital.
function isTextKey(ev: KeyboardEvent): boolean {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  return [...ev.key].length > 1 && !/^[A-Z][A-Za-z0-9]*$/.test(ev.key);
}

type ClipboardKey = "copy" | "paste" | null;

/** Windows Terminal's keys: Ctrl+C / Ctrl+V, with or without Shift (SRS-FR-025). macOS uses Cmd, which xterm leaves alone. */
function clipboardKey(ev: KeyboardEvent, mac: boolean): ClipboardKey {
  if (mac || !ev.ctrlKey || ev.altKey || ev.metaKey) return null;
  const key = ev.key.toLowerCase();
  return key === "c" ? "copy" : key === "v" ? "paste" : null;
}

const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

// xterm's theme keys are `red` / `brightRed`; the tokens are `--ansi-red` / `--ansi-bright-red`.
function ansiTheme(token: (name: string) => string | undefined): Record<string, string | undefined> {
  return Object.fromEntries(
    ANSI.flatMap((c) => [
      [c, token(`--ansi-${c}`)],
      [`bright${c[0].toUpperCase()}${c.slice(1)}`, token(`--ansi-bright-${c}`)],
    ]),
  );
}

// Kept apart from TerminalPane so tests, which use a fake adapter, never load xterm.
export function createXtermAdapter({ mac = false }: { mac?: boolean } = {}): TerminalAdapter {
  // xterm draws on a canvas, which cannot resolve CSS variables, so read their values now.
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim() || undefined;
  const terminal = new Terminal({
    scrollback: SCROLLBACK,
    fontFamily: token("--font-mono"),
    // xterm's default cursor and selection are light, invisible on the light theme.
    theme: {
      // The token of the inset the terminal sits on, so the canvas meets it without a seam.
      background: token("--oneui-term"),
      foreground: token("--foreground"),
      cursor: token("--foreground"),
      cursorAccent: token("--oneui-term"),
      selectionBackground: token("--selection"),
      ...ansiTheme(token),
    },
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  // XKey replaces a word's tail with one key event whose key is the new text ("ửa");
  // xterm alone would type only its first character.
  terminal.attachCustomKeyEventHandler((ev) => {
    // xterm would send Ctrl+C / Ctrl+V as ^C / ^V and cancel the key, so the webview never copies or pastes.
    const clip = clipboardKey(ev, mac);
    if (clip === "paste") return false;
    if (clip === "copy" && terminal.hasSelection()) {
      if (ev.type === "keydown") {
        ev.preventDefault();
        void navigator.clipboard.writeText(terminal.getSelection()).then(() => terminal.clearSelection());
      }
      return false;
    }
    if (!isTextKey(ev)) return true;
    if (ev.type === "keydown") {
      ev.preventDefault();
      terminal.input(ev.key);
    }
    return false;
  });

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
    screen() {
      const buffer = terminal.buffer.active;
      const cell = buffer.getNullCell();
      const rows: ScreenLine[] = [];
      for (let y = 0; y < terminal.rows; y++) {
        // The live screen, not the viewport: a user scrolled up must not show an old box (RULE-12).
        const line = buffer.getLine(buffer.baseY + y);
        let text = "";
        const dim: boolean[] = [];
        for (let x = 0; line && x < terminal.cols; x++) {
          line.getCell(x, cell);
          // The cell right of a wide character holds no chars; it counts as a space.
          const chars = cell.getChars() || " ";
          text += chars;
          for (let i = 0; i < chars.length; i++) dim.push(cell.isDim() !== 0);
        }
        const end = text.trimEnd().length;
        rows.push({ text: text.slice(0, end), dim: dim.slice(0, end) });
      }
      return rows;
    },
    bracketedPaste: () => terminal.modes.bracketedPasteMode,
    cols: () => terminal.cols,
    onScreenChange(cb) {
      const subscription = terminal.onWriteParsed(cb);
      return () => subscription.dispose();
    },
    dispose: () => terminal.dispose(),
  };
}
