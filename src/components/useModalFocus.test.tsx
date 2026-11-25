import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useModalFocus } from "./useModalFocus";

type ModalProps = { active?: boolean; onEscape?: () => void; returnTo?: RefObject<HTMLElement | null>; onInnerKey?: () => void };

function Modal({ active = true, onEscape = () => {}, returnTo, onInnerKey }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useModalFocus(dialog, first, onEscape, { active, returnTo });
  return (
    <div ref={dialog} role="dialog" onKeyDown={onInnerKey}>
      <button ref={first}>first</button>
      <button disabled>off</button>
      <input aria-label="field" />
      <button>last</button>
    </div>
  );
}

function Page({ open, ...modal }: ModalProps & { open: boolean }) {
  return (
    <>
      <button>opener</button>
      <button>elsewhere</button>
      {open && <Modal {...modal} />}
    </>
  );
}

const button = (name: string) => screen.getByRole("button", { name });

/** Renders the page with the opener focused, then opens the modal. */
function openFrom(props: ModalProps = {}) {
  const view = render(<Page open={false} {...props} />);
  act(() => button("opener").focus());
  view.rerender(<Page open {...props} />);
  return { ...view, reopen: (next: ModalProps & { open: boolean }) => view.rerender(<Page {...props} {...next} />) };
}

describe("useModalFocus", () => {
  it("focuses the initial control on activation", () => {
    openFrom();
    expect(button("first")).toHaveFocus();
  });

  it("cycles Tab and Shift+Tab among the enabled controls inside, skipping disabled ones", async () => {
    const user = userEvent.setup();
    openFrom();

    await user.tab();
    expect(screen.getByRole("textbox", { name: "field" })).toHaveFocus();
    await user.tab();
    expect(button("last")).toHaveFocus();
    await user.tab();
    expect(button("first")).toHaveFocus();
    await user.tab({ shift: true });
    expect(button("last")).toHaveFocus();
  });

  it("calls onEscape on Esc and keeps Esc and Tab from anything behind it", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    const onInnerKey = vi.fn();
    openFrom({ onEscape, onInnerKey });

    await user.keyboard("{Escape}");
    await user.tab();

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onInnerKey).not.toHaveBeenCalled();
  });

  it("pulls focus that leaves the dialog back to the initial control", () => {
    openFrom();
    act(() => button("elsewhere").focus());
    expect(button("first")).toHaveFocus();
  });

  it("gives focus back to the element focused before activation once gone, its listeners released", () => {
    const onEscape = vi.fn();
    const { reopen } = openFrom({ onEscape });

    reopen({ open: false });

    expect(button("opener")).toHaveFocus();
    fireEvent.keyDown(button("opener"), { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
    act(() => button("elsewhere").focus());
    expect(button("elsewhere")).toHaveFocus();
  });

  it("gives focus to returnTo instead when given, and nowhere while it holds null", () => {
    const target = { current: null as HTMLElement | null };
    const { reopen } = openFrom({ returnTo: target });
    target.current = button("elsewhere");
    reopen({ open: false });
    expect(button("elsewhere")).toHaveFocus();

    reopen({ open: true });
    target.current = null;
    reopen({ open: false });
    expect(document.body).toHaveFocus();
  });

  it("does nothing while inactive", () => {
    const onEscape = vi.fn();
    openFrom({ active: false, onEscape });

    expect(button("opener")).toHaveFocus();
    const tab = fireEvent.keyDown(button("opener"), { key: "Tab" });
    fireEvent.keyDown(button("opener"), { key: "Escape" });
    act(() => button("elsewhere").focus());

    expect(tab).toBe(true);
    expect(onEscape).not.toHaveBeenCalled();
    expect(button("elsewhere")).toHaveFocus();
  });

  it("stands down while a stacked dialog is above, leaving focus where that dialog puts it", () => {
    const onEscape = vi.fn();
    const { reopen } = openFrom({ onEscape });
    act(() => button("last").focus());

    reopen({ open: true, active: false });
    expect(button("last")).toHaveFocus();
    act(() => button("elsewhere").focus());
    fireEvent.keyDown(button("elsewhere"), { key: "Escape" });
    expect(button("elsewhere")).toHaveFocus();
    expect(onEscape).not.toHaveBeenCalled();

    act(() => button("last").focus());
    reopen({ open: true, active: true });
    expect(button("last")).toHaveFocus();

    reopen({ open: false });
    expect(button("opener")).toHaveFocus();
  });
});
