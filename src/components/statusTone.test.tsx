import { render } from "@testing-library/react";
import { Archive, Check, Hand, MessageSquare, Play, TriangleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";
import css from "../index.css?raw";
import { markLook, RoundMark } from "./statusTone";

const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.>]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

describe("markLook (CR-020)", () => {
  it("fills the 28px round icon of a live state with its colour and a glyph", () => {
    expect(markLook({ kind: "state", state: "Running" })).toEqual({ round: "state-icon state-icon-busy", Glyph: Play });
    expect(markLook({ kind: "state", state: "Needs Approval" })).toEqual({ round: "state-icon state-icon-app", Glyph: Hand });
    expect(markLook({ kind: "state", state: "Idle" })).toEqual({ round: "state-icon state-icon-ready", Glyph: Check });
    expect(markLook({ kind: "state", state: "Error" })).toEqual({ round: "state-icon state-icon-err", Glyph: TriangleAlert });
  });

  it("draws Ended and an unavailable status as a hollow ring with no glyph", () => {
    expect(markLook({ kind: "state", state: "Ended" })).toEqual({ round: "state-icon state-icon-ring" });
    expect(markLook({ kind: "unavailable" })).toEqual({ round: "state-icon state-icon-ring" });
  });

  it("marks history and stash with a muted icon", () => {
    expect(markLook({ kind: "history" })).toEqual({ Icon: MessageSquare });
    expect(markLook({ kind: "stashed" })).toEqual({ Icon: Archive });
  });
});

describe("round status icon in index.css (CR-020)", () => {
  it("is a 28px circle with a black glyph", () => {
    expect(rule(".state-icon")).toMatch(/width:\s*var\(--oneui-icon\)/);
    expect(rule(".state-icon")).toMatch(/height:\s*var\(--oneui-icon\)/);
    expect(rule(".state-icon")).toMatch(/border-radius:\s*var\(--oneui-radius-pill\)/);
    expect(rule(".state-icon")).toMatch(/color:\s*#000/);
  });

  it.each([
    [".state-icon-busy", "--busy"],
    [".state-icon-app", "--approval"],
    [".state-icon-ready", "--running"],
    [".state-icon-err", "--error"],
  ])("fills %s with var(%s)", (selector, token) => {
    expect(rule(selector)).toMatch(new RegExp(`background:\\s*var\\(${token}\\)`));
  });

  it("leaves the ring hollow in --muted-foreground", () => {
    expect(rule(".state-icon-ring")).toMatch(/border:\s*1\.5px solid var\(--muted-foreground\)/);
    expect(rule(".state-icon-ring")).not.toMatch(/background/);
  });
});

describe("RoundMark", () => {
  it("draws a state as a decorative round icon with its glyph", () => {
    const { container } = render(<RoundMark mark={{ kind: "state", state: "Needs Approval" }} />);
    const mark = container.firstElementChild!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveClass("state-icon", "state-icon-app");
    expect(mark.querySelector("svg")).not.toBeNull();
  });

  it("draws Ended as an empty ring", () => {
    const { container } = render(<RoundMark mark={{ kind: "state", state: "Ended" }} />);
    expect(container.firstElementChild).toHaveClass("state-icon", "state-icon-ring");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("keeps the 8px dot when small, for the badge on a maximized pane", () => {
    const { container } = render(<RoundMark mark={{ kind: "state", state: "Error" }} small />);
    expect(container.firstElementChild).toHaveClass("dot", "dot-err");
  });

  it("draws an icon mark muted, with no filled circle, 14px in rows and 12px when small", () => {
    const { container, rerender } = render(<RoundMark mark={{ kind: "stashed" }} />);
    const mark = container.firstElementChild!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveClass("text-muted-foreground");
    expect(mark.className).not.toMatch(/(^|\s)(rounded-full|bg-\S+)/);
    expect(mark.querySelector("svg")).toHaveAttribute("width", "14");
    rerender(<RoundMark mark={{ kind: "stashed" }} small />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "12");
  });
});
