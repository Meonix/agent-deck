import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { labels } from "../labels";
import { QuestionCard } from "./QuestionCard";

const QUESTION = { text: "Dùng thư viện nào để kiểm dữ liệu?", options: ["zod", "yup"] };

function renderQuestion() {
  const onAnswer = vi.fn();
  render(<QuestionCard question={QUESTION} onAnswer={onAnswer} />);
  const card = screen.getByRole("group", { name: QUESTION.text });
  return {
    user: userEvent.setup(),
    onAnswer,
    card,
    radio: (name: string) => within(card).getByRole("radio", { name }),
    other: within(card).getByRole("textbox", { name: labels.other }),
    send: within(card).getByRole("button", { name: labels.send }),
  };
}

describe("QuestionCard (SRS-FR-166)", () => {
  it("shows the question, its options as radios, Khác… and Gửi disabled until something is chosen", () => {
    const { card, send, other } = renderQuestion();
    expect(within(card).getByText(labels.questionHeading)).toHaveClass("side-label");
    expect(card).toHaveTextContent(QUESTION.text);
    const group = within(card).getByRole("radiogroup", { name: QUESTION.text });
    expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["zod", "yup"]);
    expect(within(group).getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(other).toHaveAttribute("placeholder", labels.other);
    expect(send).toBeDisabled();
  });

  it("answers with the chosen option", async () => {
    const { user, radio, send, onAnswer } = renderQuestion();
    await user.click(radio("zod"));
    expect(send).toBeEnabled();
    await user.click(send);
    expect(onAnswer).toHaveBeenCalledWith({ kind: "option", label: "zod" });
  });

  it("unselects the options while Khác… is typed in, and empties Khác… when an option is chosen", async () => {
    const { user, radio, other, send, onAnswer } = renderQuestion();
    await user.click(radio("zod"));
    await user.type(other, "valibot");
    expect(radio("zod")).not.toBeChecked();
    await user.click(send);
    expect(onAnswer).toHaveBeenCalledWith({ kind: "other", text: "valibot" });

    await user.click(radio("yup"));
    expect(other).toHaveValue("");
    expect(radio("yup")).toBeChecked();
  });

  it("keeps Gửi disabled for a Khác… of spaces only", async () => {
    const { user, other, send } = renderQuestion();
    await user.type(other, "   ");
    expect(send).toBeDisabled();
  });

  it("does not take the keyboard when it appears", () => {
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    input.focus();
    renderQuestion();
    expect(input).toHaveFocus();
    input.remove();
  });
});
