import type { SavedFile } from "../api/sessions";

/** A stored Prompt File, or a file rejected for its size. */
export type AttachResult = SavedFile | { name: string; error: "too_large" };

export const MAX_ATTACH_BYTES = 50 * 1024 * 1024;

export function tooLarge(size: number): boolean {
  return size > MAX_ATTACH_BYTES;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function insertPaths(
  text: string,
  caret: number,
  paths: readonly string[],
): { text: string; caret: number } {
  if (paths.length === 0) return { text, caret };
  const lead = caret > 0 && !/\s/.test(text[caret - 1]) ? " " : "";
  const block = lead + paths.map((p) => `${p} `).join("");
  return {
    text: text.slice(0, caret) + block + text.slice(caret),
    caret: caret + block.length,
  };
}

export function removePath(text: string, path: string): string {
  const start = text.indexOf(path);
  if (start === -1) return text;
  let end = start + path.length;
  if (text[end] === " ") end += 1;
  return text.slice(0, start) + text.slice(end);
}

/** What a failed store leaves: an error chip for "too_large", nothing for any other failure. */
export function rejectedAttach(name: string, reason: unknown): AttachResult | null {
  return reason === "too_large" ? { name, error: "too_large" } : null;
}
