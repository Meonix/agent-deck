import { describe, expect, it } from "vitest";
import tokens from "../design/agent-deck/tokens.css?raw";
import oneui from "../design/agent-deck/tokens-oneui.css?raw";
import indexCss from "./index.css?raw";

const [light, dark] = tokens.split(/^\.dark\s*\{/m);

function colours(block: string): Map<string, string> {
  return new Map([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(([, name, hex]) => [name, hex]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [text: string, background: string][] = [
  // SRS-NFR-014: status words and status-tinted rows.
  ["--busy-foreground", "--card"],
  ["--busy-foreground", "--accent"],
  ["--ready-foreground", "--card"],
  ["--ready-foreground", "--accent"],
  ["--approval-foreground", "--approval-bg"],
  ["--error-foreground", "--error-bg"],
  ["--running-foreground", "--running-bg"],
  // Readable sidebar labels and hover (app-theme); the selected row is --accent.
  ["--muted-foreground", "--muted"],
  ["--muted-foreground", "--accent"],
];

describe.each([
  ["light", colours(light)],
  ["dark", colours(dark)],
])("token contrast in %s (SRS-NFR-014)", (_, theme) => {
  it.each(PAIRS)("%s on %s is at least 4.5:1", (text, background) => {
    const [fg, bg] = [theme.get(text), theme.get(background)];
    expect(fg, text).toBeDefined();
    expect(bg, background).toBeDefined();
    expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each([
  ["light", colours(light)],
  ["dark", colours(dark)],
])("Row Focus Mark in %s (SRS-FR-099)", (_, theme) => {
  it.each(["--card", "--accent", "--approval-bg", "--error-bg"])("--row-focus on %s is at least 3:1", (background) => {
    expect(theme.get(background), background).toBeDefined();
    expect(ratio(theme.get("--row-focus")!, theme.get(background)!)).toBeGreaterThanOrEqual(3);
  });
});

describe.each([
  ["light", colours(light)],
  ["dark", colours(dark)],
])("sidebar hover in %s (app-theme)", (_, theme) => {
  it("--muted stands out from --card by at least 1.05:1", () => {
    expect(ratio(theme.get("--muted")!, theme.get("--card")!)).toBeGreaterThanOrEqual(1.05);
  });
});

const sources = import.meta.glob(["./**/*.tsx", "!./**/*.test.tsx"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

it("no source uses the old section tints, which One UI dropped", () => {
  // Built from parts, so this file does not match itself.
  const token = new RegExp(`(--|bg-)${"section"}-`);
  const users = Object.entries({ ...sources, "./index.css": indexCss }).filter(([, text]) => token.test(text)).map(([path]) => path);
  expect(users).toEqual([]);
});

/** Resolves the one-line var() aliases of tokens-oneui.css against the colours of tokens.css. */
function oneuiColours(block: string, base: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, ref] of block.matchAll(/(--oneui-[\w-]+):\s*var\((--[\w-]+)\)/g)) {
    const hex = base.get(ref);
    if (hex) out.set(name, hex);
  }
  return out;
}

const [oneuiLight, oneuiDark] = oneui.split(/^\.dark\s*\{/m);
const oneuiThemes: [string, Map<string, string>, Map<string, string>][] = [
  ["light", colours(light), oneuiColours(oneuiLight, colours(light))],
  ["dark", colours(dark), oneuiColours(oneuiDark.split(/^\}/m)[0], colours(dark))],
];

describe.each(oneuiThemes)("One UI shape layer contrast in %s (CR-020)", (_, base, shape) => {
  const onSurface = ["--muted-foreground", "--busy-foreground", "--ready-foreground", "--approval-foreground", "--error-foreground", "--running-foreground"];
  it.each(onSurface)("%s on --oneui-surface is at least 4.5:1", (text) => {
    expect(base.get(text), text).toBeDefined();
    expect(shape.get("--oneui-surface")).toBeDefined();
    expect(ratio(base.get(text)!, shape.get("--oneui-surface")!)).toBeGreaterThanOrEqual(4.5);
  });
  it("subheader (--muted-foreground) on --oneui-canvas is at least 4.5:1", () => {
    expect(shape.get("--oneui-canvas")).toBeDefined();
    expect(ratio(base.get("--muted-foreground")!, shape.get("--oneui-canvas")!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("One UI shape layer in index.css (CR-020)", () => {
  it("imports tokens-oneui.css after tokens.css", () => {
    const a = indexCss.indexOf("tokens.css");
    const b = indexCss.indexOf("tokens-oneui.css");
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
  });
  it.each(["--color-canvas", "--color-surface", "--radius-card", "--radius-dialog", "--radius-group", "--radius-row", "--radius-pill", "--spacing-oneui"])("exposes %s", (name) => {
    expect(indexCss).toContain(name + ":");
  });
});
