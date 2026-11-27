import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import css from "../index.css?raw";
import { labels } from "../labels";
import { ApprovalStrip } from "./ApprovalStrip";

function renderStrip(strip = { tool: "Bash" as string | null, detail: "npm install" }) {
  const on = { allow: vi.fn(), deny: vi.fn() };
  render(<ApprovalStrip strip={strip} onAllow={on.allow} onDeny={on.deny} />);
  return { on, group: screen.getByRole("group", { name: labels.permissionGroup }) };
}

describe("ApprovalStrip (SRS-FR-163)", () => {
  it("reads the tool and its command, then Từ chối and Cho phép", () => {
    const { group } = renderStrip();
    expect(group).toHaveTextContent("Bash · npm install");
    expect(within(group).getByText("Bash").tagName).toBe("B");
    expect(within(group).getByText("npm install")).toHaveClass("font-mono");
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([labels.deny, labels.allow]);
  });

  it("answers with Cho phép and Từ chối", async () => {
    const user = userEvent.setup();
    const { on, group } = renderStrip();
    await user.click(within(group).getByRole("button", { name: labels.allow }));
    expect(on.allow).toHaveBeenCalledTimes(1);
    await user.click(within(group).getByRole("button", { name: labels.deny }));
    expect(on.deny).toHaveBeenCalledTimes(1);
  });

  it("shows a multi-line command whole: its lines kept, up to four rows, the whole of it in the title", () => {
    const { group } = renderStrip({ tool: "Bash", detail: "echo one\ntouch d.txt" });
    const detail = within(group).getByText((_, el) => el?.textContent === "echo one\ntouch d.txt");
    expect(detail).toHaveClass("font-mono", "whitespace-pre-wrap", "max-h-20", "overflow-y-auto");
    expect(detail).toHaveAttribute("title", "echo one\ntouch d.txt");
  });

  it("shows only the command when the tool is unknown", () => {
    const { group } = renderStrip({ tool: null, detail: "touch a.txt" });
    expect(group).toHaveTextContent(/^touch a\.txt/);
    expect(group).not.toHaveTextContent("·");
  });

  it("does not take the keyboard when it appears", () => {
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    input.focus();
    renderStrip();
    expect(input).toHaveFocus();
    input.remove();
  });
});

describe("Approval CSS (design cr016 strip())", () => {
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
  };

  it("draws the strip and Từ chối in the approval colours, Cho phép in primary", () => {
    expect(rule(".strip")).toMatch(/background: var\(--approval-bg\); color: var\(--approval-foreground\)/);
    expect(rule(".strip")).not.toMatch(/border-top/);
    expect(rule(".deny")).toMatch(/color: var\(--approval-foreground\)/);
    expect(rule(".allow")).toMatch(/background: var\(--primary\); color: var\(--primary-foreground\); border-radius: 22px/);
  });
});
