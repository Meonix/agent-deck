import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import css from "../index.css?raw";
import { labels } from "../labels";
import { ActivityBar } from "./ActivityBar";
import { type Activity, type ChatEntry, type ChatState } from "./chatState";
import { ChatView } from "./ChatView";

const chat = (items: ChatEntry[], over: Partial<ChatState> = {}): ChatState => ({ loading: false, unreadable: false, items, held: {}, ...over });

const PROMPT: ChatEntry = { kind: "prompt", key: "u1:0", text: "sửa lỗi đăng nhập" };
const READ: ChatEntry = {
  kind: "tool",
  key: "a1:0",
  id: "t1",
  name: "Read",
  arg: "src/login.ts",
  result: { text: "export function login() {}", isError: false },
};
const REPLY: ChatEntry = { kind: "reply", key: "a2:0", text: "Đã sửa lỗi token hết hạn.\nChạy lại test đã qua." };

const log = () => screen.getByRole("log", { name: labels.chatLog });

describe("Chat view (SRS-FR-149)", () => {
  it("is a polite log that can take focus", () => {
    render(<ChatView chat={chat([])} />);
    expect(log()).toHaveAttribute("aria-live", "polite");
    expect(log()).toHaveAttribute("tabindex", "-1");
  });

  it("shows the prompt bubble, the tool card and the reply in order", () => {
    render(<ChatView chat={chat([PROMPT, READ, REPLY])} />);
    const bubble = within(log()).getByText(PROMPT.text);
    expect(bubble).toHaveClass("bubble", "self-end", "max-w-[70%]");
    const card = within(log()).getByRole("button", { name: "Read src/login.ts" });
    expect(card).toHaveClass("tool");
    expect(card).toHaveAttribute("aria-expanded", "false");
    expect(within(card).getByText("src/login.ts")).toHaveClass("font-mono");
    const reply = within(log()).getByText((_, el) => el !== log() && el?.textContent === REPLY.text);
    expect(bubble.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the line breaks of a reply and renders no markdown", () => {
    render(<ChatView chat={chat([{ kind: "reply", key: "r", text: "**đậm**\ndòng hai" }])} />);
    const reply = within(log()).getByText((_, el) => el !== log() && el?.textContent === "**đậm**\ndòng hai");
    expect(reply).toHaveClass("whitespace-pre-wrap", "max-w-[85%]");
    expect(reply.querySelector("strong")).toBeNull();
  });

  it("opens a tool card to show its result", async () => {
    const user = userEvent.setup();
    render(<ChatView chat={chat([READ])} />);
    expect(screen.queryByText("export function login() {}")).toBeNull();
    const card = screen.getByRole("button", { name: "Read src/login.ts" });
    await user.click(card);
    expect(card).toHaveAttribute("aria-expanded", "true");
    const result = screen.getByText("export function login() {}");
    expect(result.tagName).toBe("PRE");
    expect(result).not.toHaveClass("w-err");
    await user.click(card);
    expect(card).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("export function login() {}")).toBeNull();
  });

  it("shows an error result in red", async () => {
    const user = userEvent.setup();
    const failed: ChatEntry = { ...READ, result: { text: "File does not exist.", isError: true } };
    render(<ChatView chat={chat([failed])} />);
    await user.click(screen.getByRole("button", { name: "Read src/login.ts" }));
    expect(screen.getByText("File does not exist.")).toHaveClass("w-err");
  });

  it("shows đang chạy… in the muted colour on a tool without a result", () => {
    const running: ChatEntry = { kind: "tool", key: "b", id: "t2", name: "Bash", arg: "cargo build", result: null };
    render(<ChatView chat={chat([running])} />);
    const card = screen.getByRole("button", { name: `Bash cargo build ${labels.toolRunning}` });
    expect(within(card).getByText(labels.toolRunning)).toHaveClass("sub");
  });

  it("draws an icon by tool family", () => {
    const tool = (name: string, n: number): ChatEntry => ({ kind: "tool", key: `k${n}`, id: `t${n}`, name, arg: null, result: null });
    const names = ["Read", "Edit", "MultiEdit", "Write", "NotebookEdit", "Bash", "Grep", "Glob", "WebFetch", "WebSearch", "Agent", "Task", "TodoWrite"];
    render(<ChatView chat={chat(names.map(tool))} />);
    const icons = screen.getAllByRole("button").map((b) => b.querySelector("svg")?.getAttribute("class") ?? "");
    const family = icons.map((c) => /lucide-([a-z-]+)/.exec(c.replace("lucide ", ""))?.[1]);
    expect(family).toEqual([
      "file-text", "pencil", "pencil", "file-plus", "file-plus", "terminal",
      "search", "search", "search", "search", "bot", "bot", "wrench",
    ]);
  });

  it("shows skeleton bars and no Đang tải text while loading", () => {
    render(<ChatView chat={chat([], { loading: true })} />);
    expect(log().querySelectorAll(".skel")).toHaveLength(4);
    expect(log()).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/Đang tải/)).toBeNull();
  });

  it("is empty and shows no error for a conversation without entries", () => {
    render(<ChatView chat={chat([])} />);
    expect(log()).toBeEmptyDOMElement();
    expect(log()).not.toHaveAttribute("aria-busy", "true");
  });
});

describe("Unreadable conversation (SRS-FR-153)", () => {
  it("shows Không đọc được hội thoại, xem ở Term with the triangle-alert icon", () => {
    render(<ChatView chat={chat([PROMPT], { unreadable: true })} />);
    const callout = within(log()).getByText(labels.chatUnreadable);
    expect(callout).toHaveClass("callout-err");
    expect(callout.querySelector("svg")).toHaveClass("lucide-triangle-alert");
    expect(screen.queryByText(PROMPT.text)).toBeNull();
  });
});

describe("Chat follows new entries (SRS-FR-149)", () => {
  /** jsdom lays nothing out: the box reports the heights given and keeps the scrollTop set. */
  function layout(box: HTMLElement, sizes: { scrollHeight: number; clientHeight: number }) {
    let top = 0;
    Object.defineProperty(box, "scrollHeight", { configurable: true, get: () => sizes.scrollHeight });
    Object.defineProperty(box, "clientHeight", { configurable: true, get: () => sizes.clientHeight });
    Object.defineProperty(box, "scrollTop", { configurable: true, get: () => top, set: (v: number) => void (top = v) });
    return sizes;
  }
  const scrollTo = (box: HTMLElement, top: number) => {
    box.scrollTop = top;
    box.dispatchEvent(new Event("scroll"));
  };

  it("keeps the newest entry in sight while the user is at the bottom", () => {
    const { rerender } = render(<ChatView chat={chat([PROMPT])} />);
    const sizes = layout(log(), { scrollHeight: 1000, clientHeight: 200 });
    scrollTo(log(), 770);
    sizes.scrollHeight = 1300;
    rerender(<ChatView chat={chat([PROMPT, REPLY])} />);
    expect(log().scrollTop).toBe(1300);
  });

  it("stays put when the user has scrolled up", () => {
    const { rerender } = render(<ChatView chat={chat([PROMPT])} />);
    const sizes = layout(log(), { scrollHeight: 1000, clientHeight: 200 });
    scrollTo(log(), 500);
    sizes.scrollHeight = 1300;
    rerender(<ChatView chat={chat([PROMPT, REPLY])} />);
    expect(log().scrollTop).toBe(500);
  });
});

describe("Activity Bar (SRS-FR-152)", () => {
  const ALL: Activity = { tool: "Bash", arg: "npm test", context: 42, shells: 1, subagents: 2 };

  it("reads the activity with the busy dot while Running", () => {
    render(<ActivityBar state="Running" activity={ALL} />);
    const bar = screen.getByRole("status");
    expect(bar).toHaveTextContent(/^Bash npm test · 42% context · 1 shell · 2 subagent$/);
    expect(bar.textContent).toBe("Bash npm test · 42% context · 1 shell · 2 subagent");
    expect(bar).toHaveClass("h-7");
    expect(bar.querySelector(".dot.dot-busy")).not.toBeNull();
    expect(within(bar).getByText("npm test")).toHaveClass("font-mono");
    expect(within(bar).getByText("42% context")).toHaveClass("ctx-ok");
  });

  it("leaves out the parts not known yet", () => {
    render(<ActivityBar state="Running" activity={{ tool: "Bash", arg: "npm install", context: null, shells: 0, subagents: 0 }} />);
    expect(screen.getByRole("status").textContent).toBe("Bash npm install");
  });

  it("shows the tool alone when arg is null", () => {
    render(<ActivityBar state="Running" activity={{ tool: "Read", arg: null, context: null, shells: 0, subagents: 0 }} />);
    expect(screen.getByRole("status").textContent).toBe("Read");
  });

  it("reads the counts alone when no tool is running", () => {
    render(<ActivityBar state="Running" activity={{ tool: null, arg: null, context: 12, shells: 0, subagents: 1 }} />);
    expect(screen.getByRole("status").textContent).toBe("12% context · 1 subagent");
  });

  it("shows just the busy dot before the first snapshot", () => {
    render(<ActivityBar state="Running" activity={null} />);
    const bar = screen.getByRole("status");
    expect(bar.textContent).toBe("");
    expect(bar.querySelector(".dot.dot-busy")).not.toBeNull();
  });

  it("renders nothing unless Running", () => {
    for (const state of ["Idle", "Needs Approval", "Error", "Ended"] as const) {
      const { container, unmount } = render(<ActivityBar state={state} activity={ALL} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});

describe("Chat look in index.css (CR-016)", () => {
  const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.>]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("draws the bubble, the tool card and the context share as in the design", () => {
    expect(rule(".bubble")).toMatch(/background:\s*var\(--primary\)/);
    expect(rule(".bubble")).toMatch(/color:\s*var\(--primary-foreground\)/);
    expect(rule(".bubble")).toMatch(/border-radius:\s*15px/);
    expect(rule(".tool")).toMatch(/color:\s*var\(--muted-foreground\)/);
    expect(rule(".tool")).toMatch(/border-left:\s*2px solid var\(--border\)/);
    expect(rule(".ctx-ok")).toMatch(/color:\s*var\(--ctx-ok\)/);
    expect(rule(".dot-busy")).toMatch(/background:\s*var\(--busy\)/);
  });
});
