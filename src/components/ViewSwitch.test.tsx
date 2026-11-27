import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import css from "../index.css?raw";
import { labels } from "../labels";
import { type PaneView, ViewSwitch } from "./ViewSwitch";

function renderSwitch(view: PaneView = "term", shellCommand: string | null = null, compact = false) {
  const onChoose = vi.fn();
  render(<ViewSwitch view={view} shellCommand={shellCommand} compact={compact} onChoose={onChoose} />);
  const group = screen.getByRole("group", { name: labels.viewSwitch });
  return { onChoose, group, items: within(group).getAllByRole("button") };
}

describe("View Switch (SRS-FR-146)", () => {
  it("is a group named Chế độ của ô with Chat, Term, Shell, Plan in that order", () => {
    const { group, items } = renderSwitch();
    expect(group).toHaveClass("seg");
    expect(items.map((b) => b.textContent)).toEqual(["Chat", "Term", "Shell", "Plan"]);
    for (const b of items) expect(b).toHaveAttribute("type", "button");
  });

  it("marks only the current view as pressed and filled", () => {
    const { items } = renderSwitch("shell");
    expect(items.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false"]);
    expect(items[2]).toHaveClass("seg-on");
    for (const i of [0, 1, 3]) expect(items[i]).not.toHaveClass("seg-on");
  });

  it("chooses Term or Shell on click and on Enter", async () => {
    const user = userEvent.setup();
    const { onChoose, items } = renderSwitch();
    await user.click(items[2]);
    expect(onChoose).toHaveBeenLastCalledWith("shell");
    items[1].focus();
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith("term");
  });

  it("shows only Plan disabled and titled Chưa có, still in the tab order (SRS-FR-146)", () => {
    const { items } = renderSwitch();
    expect(items[3]).toHaveAttribute("aria-disabled", "true");
    expect(items[3]).toHaveAttribute("title", labels.viewNotReady);
    items[3].focus();
    expect(items[3]).toHaveFocus();
    for (const b of items.slice(0, 3)) {
      expect(b).not.toHaveAttribute("aria-disabled");
      expect(b).not.toHaveAttribute("title");
    }
  });

  it("chooses Chat on click and on Enter (SRS-FR-146)", async () => {
    const user = userEvent.setup();
    const { onChoose, items } = renderSwitch();
    await user.click(items[0]);
    expect(onChoose).toHaveBeenLastCalledWith("chat");
    onChoose.mockClear();
    items[0].focus();
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith("chat");
  });

  // The pane ignores the choice and puts the keyboard back in the shown view.
  it("passes a click or Enter on Plan to the pane", async () => {
    const user = userEvent.setup();
    const { onChoose, items } = renderSwitch();
    await user.click(items[3]);
    expect(onChoose).toHaveBeenLastCalledWith("plan");
    onChoose.mockClear();
    items[3].focus();
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith("plan");
  });

  it("reads Shell · <command> for a hidden busy shell, the command in the terminal font (SRS-FR-058)", () => {
    const { items } = renderSwitch("term", "npm run dev");
    expect(items[2]).toHaveAccessibleName(labels.shellRunning("npm run dev").join(" "));
    expect(within(items[2]).getByText("npm run dev")).toHaveClass("font-mono", "truncate");
  });

  it("lets the command of the Shell item shrink before anything else in the switch", () => {
    const { items } = renderSwitch("term", "npm run dev");
    expect(items[2]).toHaveClass("min-w-0");
    expect(within(items[2]).getByText("npm run dev")).toHaveClass("min-w-0");
  });

  it("keeps only Chat, Term and a bare Shell when compact", () => {
    const { items } = renderSwitch("term", "npm run dev", true);
    expect(items.map((b) => b.textContent)).toEqual([labels.views.chat, labels.views.term, labels.views.shell]);
  });
});

describe("View Switch look in index.css (CR-016)", () => {
  const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.>]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("draws the pill on --muted and fills the shown item with --primary (CR-020)", () => {
    expect(rule(".seg")).toMatch(/background:\s*var\(--muted\)/);
    expect(rule(".seg")).toMatch(/border-radius:\s*var\(--oneui-radius-pill\)/);
    expect(rule(".seg")).not.toMatch(/border:/);
    expect(rule(".seg > button")).toMatch(/border-radius:\s*var\(--oneui-radius-pill\)/);
    expect(rule(".seg-on")).toMatch(/background:\s*var\(--primary\)/);
    expect(rule(".seg-on")).toMatch(/color:\s*var\(--primary-foreground\)/);
  });
});
