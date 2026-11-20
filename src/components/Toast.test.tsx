import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Fire({ text }: { text: string }) {
  const showToast = useToast();
  return <button onClick={() => showToast(text)}>fire</button>;
}

describe("Toast", () => {
  it("keeps a long message inside a pill that grows with it", () => {
    const text = `Could not open session: ${"a very long detail ".repeat(12).trim()}`;
    render(
      <ToastProvider>
        <Fire text={text} />
      </ToastProvider>,
    );
    act(() => screen.getByText("fire").click());
    const pill = screen.getByRole("alert");
    expect(pill).toContainElement(screen.getByText(text));
    expect(pill).toHaveClass("min-h-11");
    expect(pill.className).not.toMatch(/(^|\s)h-11(\s|$)/);
  });
});
