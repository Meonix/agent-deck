import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import css from "../index.css?raw";
import { labels } from "../labels";
import { Composer } from "./Composer";
import type { Readiness } from "./inputReady";

const READY: Readiness = { ready: true };
const lockedBy = (reason: "approval" | "unrecognized" | "ended"): Readiness => ({ ready: false, reason });

type Over = {
  value?: string;
  readiness?: Readiness;
  running?: boolean;
  onHistory?: (dir: "up" | "down") => string | null;
};

/**
 * A Composer whose value is held like useComposer holds it; `onHistory` answers the recalled text, and the
 * Composer browses while a recalled prompt is shown unedited.
 */
function renderComposer({ value = "", readiness = READY, running = false, onHistory }: Over = {}) {
  const on = { send: vi.fn(), stop: vi.fn(), change: vi.fn(), history: vi.fn() };
  function Harness() {
    const [text, setText] = useState(value);
    const [browsing, setBrowsing] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    return (
      <Composer
        paneId="p1"
        inputRef={inputRef}
        value={text}
        browsing={browsing}
        onChange={(t) => {
          on.change(t);
          setBrowsing(false);
          setText(t);
        }}
        readiness={readiness}
        running={running}
        onSend={on.send}
        onStop={on.stop}
        onHistory={(dir) => {
          on.history(dir);
          const recalled = onHistory?.(dir);
          if (recalled == null) return;
          setText(recalled);
          setBrowsing(recalled !== "");
        }}
      />
    );
  }
  render(<Harness />);
  return { user: userEvent.setup(), on };
}

const box = () => screen.getByRole("textbox", { name: labels.composerLabel });

describe("Composer (SRS-FR-154, SRS-FR-155, SRS-FR-157)", () => {
  it("reads Nhắn cho Claude… and offers Gửi when ready", () => {
    renderComposer();
    expect(box()).toHaveAttribute("placeholder", labels.composerPlaceholder);
    expect(box()).toHaveAttribute("data-composer", "p1");
    expect(box()).toHaveAttribute("rows", "1");
    expect(box()).not.toHaveAttribute("aria-describedby");
    const send = screen.getByRole("button", { name: labels.send });
    expect(send).toHaveClass("send");
    expect(send).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("button", { name: labels.stop })).toBeNull();
  });

  it.each([
    ["approval", labels.composerLockApproval],
    ["unrecognized", labels.composerLockUnrecognized],
    ["ended", labels.composerLockEnded],
  ] as const)("shows the %s lock as the placeholder and disables send", async (reason, text) => {
    const { user, on } = renderComposer({ value: "chạy lại test", readiness: lockedBy(reason) });
    expect(box()).toHaveAttribute("placeholder", text);
    expect(box()).not.toBeDisabled();
    expect(box()).toHaveAccessibleDescription(text);
    const send = screen.getByRole("button", { name: labels.send });
    expect(send).toHaveClass("send-off");
    expect(send).not.toHaveClass("send");
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toHaveAccessibleDescription(text);

    await user.click(send);
    await user.type(box(), "{Enter}");
    expect(on.send).not.toHaveBeenCalled();
    expect(box()).toHaveValue("chạy lại test");
  });

  it("shows the lock reason above the field once it holds text, and on Gửi as a tip", () => {
    renderComposer({ value: "chạy lại test", readiness: lockedBy("approval") });
    const reason = screen.getByText(labels.composerLockApproval);
    expect(reason).not.toHaveClass("sr-only");
    expect(reason).toHaveClass("text-[11px]", "truncate");
    expect(screen.getByRole("button", { name: labels.send })).toHaveAttribute("title", labels.composerLockApproval);
    expect(box()).toHaveAccessibleDescription(labels.composerLockApproval);
  });

  it("keeps the reason to the placeholder while the field is empty", () => {
    renderComposer({ readiness: lockedBy("approval") });
    expect(screen.getByText(labels.composerLockApproval)).toHaveClass("sr-only");
    expect(box()).toHaveAccessibleDescription(labels.composerLockApproval);
  });

  it("shows no reason when ready or running", () => {
    renderComposer({ value: "chạy lại test" });
    expect(screen.queryByText(labels.composerLockApproval)).toBeNull();
    expect(screen.queryByText(labels.composerLockUnrecognized)).toBeNull();
  });

  it("shows no reason line while running", () => {
    renderComposer({ value: "tiếp", readiness: lockedBy("approval"), running: true });
    expect(screen.getByText(labels.composerLockApproval)).toHaveClass("sr-only");
  });

  it("lets the user type ahead while locked", async () => {
    const { user } = renderComposer({ readiness: lockedBy("approval") });
    await user.type(box(), "sau đó");
    expect(box()).toHaveValue("sau đó");
  });

  it("shows Dừng instead of Gửi while running, with the normal placeholder", async () => {
    const { user, on } = renderComposer({ value: "tiếp", readiness: { ready: false, reason: "running" }, running: true });
    expect(screen.queryByRole("button", { name: labels.send })).toBeNull();
    const stop = screen.getByRole("button", { name: labels.stop });
    expect(stop).toHaveClass("stop");
    expect(box()).toHaveAttribute("placeholder", labels.composerPlaceholder);
    expect(box()).not.toHaveAttribute("aria-describedby");

    await user.type(box(), "{Enter}");
    expect(on.send).not.toHaveBeenCalled();
    await user.click(stop);
    expect(on.stop).toHaveBeenCalledTimes(1);
  });

  it("sends on Enter and on Gửi", async () => {
    const { user, on } = renderComposer({ value: "chạy lại test" });
    await user.type(box(), "{Enter}");
    expect(on.send).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue("chạy lại test");
    await user.click(screen.getByRole("button", { name: labels.send }));
    expect(on.send).toHaveBeenCalledTimes(2);
  });

  it("adds a line on Shift+Enter", async () => {
    const { user, on } = renderComposer();
    await user.type(box(), "sửa lỗi đăng nhập{Shift>}{Enter}{/Shift}rồi chạy test");
    expect(box()).toHaveValue("sửa lỗi đăng nhập\nrồi chạy test");
    expect(on.send).not.toHaveBeenCalled();
  });

  it("does not send on Enter while an IME is composing", () => {
    const { on } = renderComposer({ value: "tiếng" });
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(box(), { key: "Enter", keyCode: 229 });
    expect(on.send).not.toHaveBeenCalled();
  });

  it("marks the field once it holds text", async () => {
    const { user } = renderComposer();
    const field = box().parentElement!;
    expect(field).toHaveClass("field");
    expect(field).not.toHaveClass("field-on");
    await user.type(box(), "a");
    expect(field).toHaveClass("field-on");
  });

  describe("height", () => {
    const LINE = 20;
    afterEach(() => vi.restoreAllMocks());

    it("grows with its text up to 8 rows, then scrolls", async () => {
      vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) {
        return this.value.split("\n").length * LINE;
      });
      const { user } = renderComposer();
      expect(box().style.height).toBe(`${LINE}px`);
      await user.type(box(), "1{Shift>}{Enter}{/Shift}2{Shift>}{Enter}{/Shift}3");
      expect(box().style.height).toBe(`${3 * LINE}px`);
      expect(box().style.overflowY).toBe("hidden");
      for (let i = 4; i <= 10; i++) await user.type(box(), `{Shift>}{Enter}{/Shift}${i}`);
      expect(box().style.height).toBe(`${8 * LINE}px`);
      expect(box().style.overflowY).toBe("auto");
    });
  });
});

describe("Composer history (SRS-FR-158)", () => {
  it("asks for an older prompt on ↑ in an empty Composer and walks with ↑ and ↓", async () => {
    const history = ["một", "hai"];
    let position: number | null = null;
    const { user, on } = renderComposer({
      onHistory: (dir) => {
        position = dir === "up" ? (position === null ? 1 : Math.max(0, position - 1)) : position === 1 ? null : 1;
        return position === null ? "" : history[position];
      },
    });
    await user.click(box());
    await user.keyboard("{ArrowUp}");
    expect(box()).toHaveValue("hai");
    await user.keyboard("{ArrowUp}");
    expect(box()).toHaveValue("một");
    await user.keyboard("{ArrowDown}");
    expect(box()).toHaveValue("hai");
    await user.keyboard("{ArrowDown}");
    expect(box()).toHaveValue("");
    expect(on.history.mock.calls.map(([d]) => d)).toEqual(["up", "up", "down", "down"]);
  });

  it("leaves ↑ and ↓ to the caret in text the user typed", async () => {
    const { user, on } = renderComposer({ onHistory: () => "cũ" });
    await user.type(box(), "mới");
    await user.keyboard("{ArrowUp}{ArrowDown}");
    expect(on.history).not.toHaveBeenCalled();
    expect(box()).toHaveValue("mới");
  });

  it("stops browsing once a recalled prompt is edited", async () => {
    const { user, on } = renderComposer({ onHistory: () => "cũ" });
    await user.click(box());
    await user.keyboard("{ArrowUp}");
    expect(box()).toHaveValue("cũ");
    await user.keyboard("!{ArrowUp}");
    expect(on.history).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue("cũ!");
  });

  it("takes ↑ only on the first row and ↓ only on the last row", async () => {
    const { user, on } = renderComposer({ onHistory: () => "a\nb" });
    await user.click(box());
    await user.keyboard("{ArrowUp}");
    expect(box()).toHaveValue("a\nb");
    // The caret sits at the end, on the last row: ↑ moves it to the first row, it does not recall.
    const area = box() as HTMLTextAreaElement;
    area.setSelectionRange(3, 3);
    fireEvent.keyDown(area, { key: "ArrowUp" });
    expect(on.history).toHaveBeenCalledTimes(1);
    area.setSelectionRange(0, 0);
    fireEvent.keyDown(area, { key: "ArrowDown" });
    expect(on.history).toHaveBeenCalledTimes(1);
    area.setSelectionRange(3, 3);
    fireEvent.keyDown(area, { key: "ArrowDown" });
    expect(on.history).toHaveBeenLastCalledWith("down");
  });
});

describe("Composer CSS (design cr016 composer())", () => {
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
  };

  it("draws the field, Gửi, the locked Gửi and Dừng as in the design", () => {
    expect(rule(".field")).toMatch(/background: var\(--background\); border: 1px solid var\(--border\); border-radius: 22px; color: var\(--muted-foreground\)/);
    expect(rule(".field-on")).toMatch(/color: var\(--foreground\)/);
    expect(rule(".send-off")).toMatch(/background: var\(--muted\); color: var\(--muted-foreground\); border-radius: 22px/);
    expect(rule(".stop")).toMatch(/background: var\(--muted\); color: var\(--foreground\); border: 1px solid var\(--border\); border-radius: 22px/);
  });
});
