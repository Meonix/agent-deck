import { render } from "@testing-library/react";
import { Archive, CircleHelp, Folder, FolderX, Hand, MessageSquare, Play, TriangleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";
import { markLook, RoundMark } from "./statusTone";

describe("markLook (One UI round mark)", () => {
  it("puts a folder on the accent and a missing one on muted", () => {
    expect(markLook({ kind: "folder" })).toEqual({ Icon: Folder, colours: "bg-accent text-accent-foreground" });
    expect(markLook({ kind: "folder", missing: true })).toEqual({ Icon: FolderX, colours: "bg-muted text-muted-foreground" });
  });

  it("gives an attention or running session its solid state colour and a black icon", () => {
    expect(markLook({ kind: "state", state: "Needs Approval" })).toEqual({ Icon: Hand, colours: "bg-approval text-black" });
    expect(markLook({ kind: "state", state: "Error" })).toEqual({ Icon: TriangleAlert, colours: "bg-error text-black" });
    expect(markLook({ kind: "state", state: "Running" })).toEqual({ Icon: Play, colours: "bg-running text-black" });
  });

  it("marks an unavailable status with a question on muted-foreground", () => {
    expect(markLook({ kind: "unavailable" })).toEqual({ Icon: CircleHelp, colours: "bg-muted-foreground text-background" });
  });

  it("draws every other row on the surface", () => {
    const quiet = "bg-surface text-muted-foreground";
    expect(markLook({ kind: "history" })).toEqual({ Icon: MessageSquare, colours: quiet });
    expect(markLook({ kind: "stashed" })).toEqual({ Icon: Archive, colours: quiet });
    expect(markLook({ kind: "state", state: "Idle" })).toEqual({ Icon: MessageSquare, colours: quiet });
    expect(markLook({ kind: "state", state: "Ended" })).toEqual({ Icon: MessageSquare, colours: quiet });
  });
});

describe("RoundMark", () => {
  it("is a decorative circle, 28px in rows and 24px when small", () => {
    const { container, rerender } = render(<RoundMark mark={{ kind: "state", state: "Error" }} />);
    const mark = container.firstElementChild!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveClass("size-7", "rounded-full", "bg-error");
    expect(mark.querySelector("svg")).toHaveAttribute("width", "14");
    rerender(<RoundMark mark={{ kind: "state", state: "Error" }} small />);
    expect(container.firstElementChild).toHaveClass("size-6");
    expect(container.querySelector("svg")).toHaveAttribute("width", "12");
  });
});
