import { describe, expect, it } from "vitest";
import { historyStep, sendPrompt } from "./composerLogic";

describe("sendPrompt", () => {
  it("wraps a multi-line prompt in bracketed paste and submits", () => {
    const text = "chạy lại test\nrồi báo kết quả";
    expect(sendPrompt(text, true)).toEqual({ ok: true, bytes: `\x1b[200~${text}\x1b[201~\r` });
  });

  it("normalises CRLF and lone CR to LF", () => {
    expect(sendPrompt("a\r\nb\rc", true)).toEqual({ ok: true, bytes: "\x1b[200~a\nb\nc\x1b[201~\r" });
  });

  it("rejects empty and whitespace-only text", () => {
    expect(sendPrompt("", true)).toEqual({ ok: false, reason: "empty" });
    expect(sendPrompt(" \r\n\t ", false)).toEqual({ ok: false, reason: "empty" });
  });

  it("sends a single line plus Enter without bracketed paste", () => {
    expect(sendPrompt("xin chào", false)).toEqual({ ok: true, bytes: "xin chào\r" });
  });

  it("refuses multi-line text without bracketed paste", () => {
    expect(sendPrompt("a\nb", false)).toEqual({ ok: false, reason: "unrecognized" });
  });

  it("does not trim a non-empty prompt", () => {
    expect(sendPrompt("  a  ", false)).toEqual({ ok: true, bytes: "  a  \r" });
    expect(sendPrompt("  a  ", true)).toEqual({ ok: true, bytes: "\x1b[200~  a  \x1b[201~\r" });
  });
});

describe("historyStep", () => {
  const h = ["a", "b"];

  it("walks up to older prompts and stops at the oldest", () => {
    expect(historyStep(h, null, "up")).toEqual({ position: 1, text: "b" });
    expect(historyStep(h, 1, "up")).toEqual({ position: 0, text: "a" });
    expect(historyStep(h, 0, "up")).toBeNull();
  });

  it("does nothing on empty history", () => {
    expect(historyStep([], null, "up")).toBeNull();
  });

  it("walks down and leaves browsing past the newest", () => {
    expect(historyStep(h, 0, "down")).toEqual({ position: 1, text: "b" });
    expect(historyStep(h, 1, "down")).toEqual({ position: null, text: "" });
    expect(historyStep(h, null, "down")).toBeNull();
  });
});
