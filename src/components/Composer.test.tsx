import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandItem, FileEntry, FileList } from "../api/sessions";
import css from "../index.css?raw";
import { labels } from "../labels";
import { Composer } from "./Composer";
import type { Readiness } from "./inputReady";
import type { SuggestSource } from "./useSuggestionMenu";

const READY: Readiness = { ready: true };
const lockedBy = (reason: "approval" | "unrecognized" | "ended"): Readiness => ({ ready: false, reason });

type Over = {
  value?: string;
  readiness?: Readiness;
  running?: boolean;
  onHistory?: (dir: "up" | "down") => string | null;
  suggest?: SuggestSource;
};

const NO_SUGGESTIONS: SuggestSource = {
  commands: async () => [],
  files: async () => ({ folder: "agent-deck", entries: [] }),
};

/**
 * A Composer whose value is held like useComposer holds it; `onHistory` answers the recalled text, and the
 * Composer browses while a recalled prompt is shown unedited.
 */
function renderComposer({ value = "", readiness = READY, running = false, onHistory, suggest = NO_SUGGESTIONS }: Over = {}) {
  const on = { send: vi.fn(), stop: vi.fn(), change: vi.fn(), history: vi.fn() };
  function Harness() {
    const [text, setText] = useState(value);
    const [browsing, setBrowsing] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    return (
      <Composer
        paneId="p1"
        inputRef={inputRef}
        suggest={suggest}
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

const COMMIT: CommandItem = { name: "commit", description: "Group related…", source: "user-skill" };
const file = (path: string): FileEntry => ({ path, dir: path.endsWith("/") });
const COMP_FILES = [file("src/components/PaneGrid.tsx"), file("src/components/"), file("src/comp.ts"), file("README.md")];

function source({ commands = [COMMIT], entries = COMP_FILES }: { commands?: CommandItem[]; entries?: FileEntry[] } = {}) {
  return {
    commands: vi.fn(async () => commands),
    files: vi.fn(async (): Promise<FileList> => ({ folder: "agent-deck", entries })),
  };
}

const menu = () => screen.queryByRole("listbox");
const options = () => within(screen.getByRole("listbox")).getAllByRole("option");
const names = () => options().map((o) => o.querySelector(".font-mono")?.textContent);
const settle = () => act(async () => {});

describe("suggestion menus (SRS-FR-159, SRS-FR-160)", () => {
  it("shows built-ins and fetched commands for /com, with the skill tag", async () => {
    const { user } = renderComposer({ suggest: source() });
    await user.type(box(), "/com");
    const list = await screen.findByRole("listbox", { name: labels.menuCommands });
    expect(list).toHaveClass("menu");
    expect(within(list).getByText(labels.menuCommands)).toHaveClass("side-label");
    expect(names()).toEqual(["/commit", "/compact"]);
    expect(within(options()[0]).getByText(`${labels.tagSkill} · Group related…`)).toHaveClass("sub");
    expect(within(options()[1]).getByText("Free up context by summarizing the conversation so far")).toHaveClass("sub", "truncate");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    expect(options()[0]).toHaveClass("pick-on");
    expect(options()[1]).toHaveAttribute("aria-selected", "false");
    expect(box()).toHaveAttribute("aria-controls", list.id);
    expect(box()).toHaveAttribute("aria-activedescendant", options()[0].id);
    expect(box()).toHaveAttribute("aria-autocomplete", "list");
  });

  it("chooses the highlighted command on Enter without sending", async () => {
    const { user, on } = renderComposer({ suggest: source() });
    await user.type(box(), "/comm");
    await screen.findByRole("listbox");
    await user.keyboard("{Enter}");
    expect(box()).toHaveValue("/commit ");
    expect(on.send).not.toHaveBeenCalled();
    expect(menu()).toBeNull();
    expect(box()).not.toHaveAttribute("aria-activedescendant");
  });

  it("moves the highlight with ↓ and ↑, wrapping, without recalling history", async () => {
    const { user, on } = renderComposer({ suggest: source() });
    await user.type(box(), "/com");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}");
    expect(options()[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(options()[1]).toHaveAttribute("aria-selected", "true");
    expect(box()).toHaveAttribute("aria-activedescendant", options()[1].id);
    await user.keyboard("{Enter}");
    expect(box()).toHaveValue("/compact ");
    expect(on.history).not.toHaveBeenCalled();
  });

  it("starts the highlight over when the query changes", async () => {
    const { user } = renderComposer({ suggest: source() });
    await user.type(box(), "/co");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}m");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Esc for that word only", async () => {
    const { user, on } = renderComposer({ suggest: source() });
    await user.type(box(), "/com");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    expect(menu()).toBeNull();
    expect(box()).toHaveValue("/com");
    await user.type(box(), "p");
    await settle();
    expect(menu()).toBeNull();
    await user.clear(box());
    await user.type(box(), "/");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(on.send).not.toHaveBeenCalled();
  });

  it("opens when the caret moves back into a command word", async () => {
    const { user } = renderComposer({ suggest: source() });
    await user.type(box(), "/com x");
    await settle();
    expect(menu()).toBeNull();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    await screen.findByRole("listbox");
    await user.keyboard("{Enter}");
    expect(box()).toHaveValue("/commit x");
  });

  it("adds a line on Shift+Enter while a menu is open", async () => {
    const { user, on } = renderComposer({ suggest: source() });
    await user.type(box(), "/com");
    await screen.findByRole("listbox");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(box()).toHaveValue("/com\n");
    expect(on.send).not.toHaveBeenCalled();
  });

  it("shows files under File trong <folder> and chooses one with Tab", async () => {
    const { user } = renderComposer({ suggest: source() });
    await user.type(box(), "Xem lại @src/comp");
    const list = await screen.findByRole("listbox", { name: labels.menuFiles("agent-deck") });
    const heading = within(list).getByText(labels.menuFiles("agent-deck"));
    expect(heading).toHaveClass("side-label");
    // A long folder name stays on one line, so the 8 rows fit without scrolling.
    expect(heading).toHaveClass("truncate");
    expect(heading).toHaveAttribute("title", labels.menuFiles("agent-deck"));
    expect(names()).toEqual(["src/comp.ts", "src/components/", "src/components/PaneGrid.tsx"]);
    await user.keyboard("{ArrowDown}{ArrowDown}{Tab}");
    const chosen = "Xem lại @src/components/PaneGrid.tsx ";
    expect(box()).toHaveValue(chosen);
    expect((box() as HTMLTextAreaElement).selectionStart).toBe(chosen.length);
    expect(box()).toHaveFocus();
    expect(menu()).toBeNull();
  });

  it("keeps the menu open on the files under a chosen folder, from the same list", async () => {
    const suggest = source();
    const { user } = renderComposer({ suggest });
    await user.type(box(), "@src/comp");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(box()).toHaveValue("@src/components/");
    expect(names()[0]).toBe("src/components/PaneGrid.tsx");
    expect(names()).not.toContain("src/components/");
    expect(names()).not.toContain("src/comp.ts");
    expect(suggest.files).toHaveBeenCalledTimes(1);
  });

  it("ignores Enter during IME composition while the menu is open", async () => {
    const { user, on } = renderComposer({ suggest: source() });
    await user.type(box(), "/comm");
    await screen.findByRole("listbox");
    fireEvent.keyDown(box(), { key: "Enter", keyCode: 229 });
    expect(box()).toHaveValue("/comm");
    expect(menu()).not.toBeNull();
    expect(on.send).not.toHaveBeenCalled();
  });

  it("chooses a row on click and keeps the focus", async () => {
    const { user } = renderComposer({ suggest: source() });
    await user.type(box(), "/com");
    await screen.findByRole("listbox");
    await user.click(options()[1]);
    expect(box()).toHaveValue("/compact ");
    expect(box()).toHaveFocus();
  });

  it("shows at most 8 files", async () => {
    const entries = Array.from({ length: 20 }, (_, i) => file(`src/f${i}.ts`));
    const { user } = renderComposer({ suggest: source({ entries }) });
    await user.type(box(), "@src");
    await screen.findByRole("listbox");
    expect(options()).toHaveLength(8);
  });

  it("leaves ↑ to history and Enter to sending when no menu shows", async () => {
    const { user, on } = renderComposer({ suggest: source(), onHistory: () => null });
    await user.click(box());
    await user.keyboard("{ArrowUp}");
    expect(on.history).toHaveBeenCalledWith("up");
    await user.type(box(), "/x");
    await settle();
    expect(menu()).toBeNull();
    await user.keyboard("{Enter}");
    expect(on.send).toHaveBeenCalledTimes(1);
  });

  it("shows no menu for a recalled prompt, so ↑ keeps walking the history", async () => {
    const { user, on } = renderComposer({ suggest: source(), onHistory: () => "/compact" });
    await user.click(box());
    await user.keyboard("{ArrowUp}");
    await settle();
    expect(box()).toHaveValue("/compact");
    expect(menu()).toBeNull();
    await user.keyboard("{ArrowUp}");
    expect(on.history).toHaveBeenCalledTimes(2);
  });

  it("still shows the built-ins when the commands fail", async () => {
    const suggest = { ...source(), commands: vi.fn(() => Promise.reject<CommandItem[]>(new Error("x"))) };
    const { user } = renderComposer({ suggest });
    await user.type(box(), "/com");
    await screen.findByRole("listbox");
    expect(names()).toEqual(["/compact"]);
  });

  it("shows no file menu when the files fail", async () => {
    const suggest = { ...source(), files: vi.fn(() => Promise.reject<FileList>(new Error("x"))) };
    const { user } = renderComposer({ suggest });
    await user.type(box(), "@src");
    await settle();
    expect(suggest.files).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
  });

  it("ignores a reply that lands after the menu closed and fetches again next time", async () => {
    const pending: ((items: CommandItem[]) => void)[] = [];
    const commands = vi.fn(() => new Promise<CommandItem[]>((r) => pending.push(r)));
    const { user } = renderComposer({ suggest: { ...source(), commands } });
    await user.type(box(), "/");
    expect(menu()).toBeNull();
    await user.clear(box());
    await act(async () => pending[0]([COMMIT]));
    expect(menu()).toBeNull();
    await user.type(box(), "/com");
    await settle();
    expect(commands).toHaveBeenCalledTimes(2);
    expect(menu()).toBeNull();
    await act(async () => pending[1]([]));
    expect(names()).toEqual(["/compact"]);
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

  it("draws the suggestion menu as a card", () => {
    expect(rule(".menu")).toMatch(/background: var\(--card\); border: 1px solid var\(--border\); border-radius: 10px/);
  });
});
