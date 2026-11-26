export type Delivery =
  | { ok: true; bytes: string }
  | { ok: false; reason: "empty" | "unrecognized" };

/** The bytes that submit `text` as one prompt, as if typed in Term and submitted. */
export function sendPrompt(text: string, bracketedPaste: boolean): Delivery {
  const body = text.replace(/\r\n?/g, "\n");
  if (body.trim() === "") return { ok: false, reason: "empty" };
  if (bracketedPaste) return { ok: true, bytes: `\x1b[200~${body}\x1b[201~\r` };
  // Without bracketed paste a newline would submit early, so only one line is safe.
  if (body.includes("\n")) return { ok: false, reason: "unrecognized" };
  return { ok: true, bytes: `${body}\r` };
}

export type HistoryPosition = number | null; // index into history (oldest first); null = not browsing

/** One ↑ ("up") or ↓ ("down") step. Returns null when the step changes nothing. */
export function historyStep(
  history: readonly string[],
  position: HistoryPosition,
  dir: "up" | "down",
): { position: HistoryPosition; text: string } | null {
  if (dir === "up") {
    const next = position === null ? history.length - 1 : position - 1;
    return next < 0 ? null : { position: next, text: history[next] };
  }
  if (position === null) return null;
  const next = position + 1;
  return next >= history.length ? { position: null, text: "" } : { position: next, text: history[next] };
}
