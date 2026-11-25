import { describe, expect, it } from "vitest";
import tokens from "../design/agent-deck/tokens.css?raw";

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
  ["--busy-foreground", "--section-active"],
  ["--ready-foreground", "--card"],
  ["--ready-foreground", "--section-active"],
  ["--approval-foreground", "--approval-bg"],
  ["--error-foreground", "--error-bg"],
  ["--running-foreground", "--running-bg"],
  // Readable sidebar labels and hover (app-theme).
  ["--section-label", "--card"],
  ["--muted-foreground", "--muted"],
  ["--muted-foreground", "--section-active"],
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
  it.each(["--card", "--section-active", "--approval-bg", "--error-bg"])("--row-focus on %s is at least 3:1", (background) => {
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

it("no row hovers on --section-hover, which sits too close to --card", () => {
  const users = Object.entries(sources).filter(([, text]) => text.includes("hover:bg-section-hover")).map(([path]) => path);
  expect(users).toEqual([]);
});
