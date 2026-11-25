import { render } from "@testing-library/react";
import { Archive, CircleHelp, MessageSquare } from "lucide-react";
import { describe, expect, it } from "vitest";
import { markLook, RoundMark } from "./statusTone";

describe("markLook (remote marker)", () => {
  it("gives each session state the remote 8px dot", () => {
    expect(markLook({ kind: "state", state: "Running" })).toEqual({ dot: "dot dot-busy" });
    expect(markLook({ kind: "state", state: "Idle" })).toEqual({ dot: "dot dot-ready" });
    expect(markLook({ kind: "state", state: "Needs Approval" })).toEqual({ dot: "dot dot-app" });
    expect(markLook({ kind: "state", state: "Error" })).toEqual({ dot: "dot dot-err" });
    expect(markLook({ kind: "state", state: "Ended" })).toEqual({ dot: "dot dot-ended" });
  });

  it("marks history, stash and an unavailable status with an icon", () => {
    expect(markLook({ kind: "history" })).toEqual({ Icon: MessageSquare });
    expect(markLook({ kind: "stashed" })).toEqual({ Icon: Archive });
    expect(markLook({ kind: "unavailable" })).toEqual({ Icon: CircleHelp });
  });
});

describe("RoundMark", () => {
  it("draws a state as a decorative dot with no icon", () => {
    const { container } = render(<RoundMark mark={{ kind: "state", state: "Needs Approval" }} />);
    const mark = container.firstElementChild!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveClass("dot", "dot-app");
    expect(mark.querySelector("svg")).toBeNull();
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
