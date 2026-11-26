import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { labels } from "../labels";
import { PlanCard } from "./PlanCard";

describe("PlanCard (SRS-FR-167)", () => {
  const PLAN = "1. Thêm hàm refresh()\n2. Viết test";

  function renderPlan(text: string | null = PLAN) {
    const on = { approve: vi.fn(), keep: vi.fn() };
    render(<PlanCard plan={{ text }} onApprove={on.approve} onKeepPlanning={on.keep} />);
    return {
      user: userEvent.setup(),
      on,
      feedback: screen.getByRole("textbox", { name: labels.planFeedback }),
      keep: screen.getByRole("button", { name: labels.keepPlanning }),
      approve: screen.getByRole("button", { name: labels.approvePlan }),
    };
  }

  it("shows the plan as written, with Tiếp tục lên kế hoạch disabled while the feedback is empty", async () => {
    const { user, feedback, keep, approve, on } = renderPlan();
    const card = screen.getByRole("group", { name: labels.planHeading });
    expect(within(card).getByText(labels.planHeading)).toHaveClass("side-label");
    const plan = screen.getByText((_, el) => el?.tagName === "PRE" && el.textContent === PLAN);
    expect(plan).toHaveClass("whitespace-pre-wrap", "font-mono");
    expect(keep).toBeDisabled();
    await user.type(feedback, "   ");
    expect(keep).toBeDisabled();
    expect(approve).toBeEnabled();
    await user.click(approve);
    expect(on.approve).toHaveBeenCalledTimes(1);
  });

  it("keeps planning with the feedback typed", async () => {
    const { user, feedback, keep, on } = renderPlan();
    await user.type(feedback, "thêm bước viết test");
    await user.click(keep);
    expect(on.keep).toHaveBeenCalledWith("thêm bước viết test");
  });

  it("points to Term when there is no plan to show", () => {
    renderPlan(null);
    expect(screen.getByText(labels.planInTerm)).toBeInTheDocument();
    expect(document.querySelector("pre")).toBeNull();
  });
});
