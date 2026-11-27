import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { labels } from "../labels";
import { fakeAdapter, fakeSessions, fakeStream } from "../test/fakes";
import { initialChat } from "./chatState";
import { routeDrop } from "./dropTargets";
import * as claude from "./fixtures/claude-screens";
import { TerminalPane, UNTITLED, type PaneEntry } from "./TerminalPane";

const flush = () => act(async () => {});

function entry(): PaneEntry {
  const adapter = fakeAdapter();
  vi.mocked(adapter.screen).mockReturnValue(claude.idle);
  return {
    pane: { paneId: "p1", sessionId: "s1", started: true },
    workspaceId: "w",
    openedAt: 1,
    workspaceName: "agent-deck",
    adapter,
    stream: fakeStream(),
    openedSize: { cols: 80, rows: 24 },
    ended: false,
    title: UNTITLED,
    graceOver: false,
    status: { state: "Idle", since: 1, reason: null, tracked: false },
    chat: initialChat,
    activity: null,
    shell: null,
    shellFailed: false,
    prompted: false,
    view: "term",
    returnView: "term",
    sentPrompts: [],
  };
}

function renderRouted(client: ReturnType<typeof fakeSessions>) {
  return render(
    <div data-pane-id="p1">
      <TerminalPane entry={entry()} client={client} focused maximized={false} textSize={1} othersBadge={null} onBadge={vi.fn()} onMaximize={vi.fn()} onRestore={vi.fn()} canStash onStash={vi.fn()} onFocus={vi.fn()} onClose={vi.fn()} onChooseView={vi.fn()} onDismissShellFailure={vi.fn()} onSent={vi.fn()} />
    </div>,
  );
}

const dropOnPane = (paths: string[]) => {
  const pane = document.querySelector("[data-pane]")!;
  expect(routeDrop(paths, { x: 1, y: 1 }, 1, () => pane)).toBe(true);
};
const chips = () => within(screen.getByRole("list", { name: labels.attachments })).getAllByRole("listitem").map((c) => c.textContent);

describe("TerminalPane drop target", () => {
  it("copies each dropped path in order: a chip for the saved file, an error chip for too_large", async () => {
    const client = fakeSessions({
      copyPromptFile: vi.fn((p: string) =>
        p.endsWith("big.mov") ? Promise.reject("too_large") : Promise.resolve({ path: `/prompt-files/1-0/${p.split("/").pop()}`, name: p.split("/").pop()!, size: 3 }),
      ),
    });
    renderRouted(client);
    await flush();
    dropOnPane(["/home/u/a.png", "C:\\v\\big.mov"]);
    await flush();
    expect(client.copyPromptFile).toHaveBeenNthCalledWith(1, "/home/u/a.png");
    expect(client.copyPromptFile).toHaveBeenNthCalledWith(2, "C:\\v\\big.mov");
    expect(chips()).toEqual(["a.png · 3 B", `big.mov · ${labels.attachTooLarge}`]);
    expect(screen.getByRole("textbox")).toHaveValue("/prompt-files/1-0/a.png ");
  });

  it("skips a folder and a vanished file", async () => {
    const client = fakeSessions({ copyPromptFile: vi.fn((p: string) => Promise.reject(p === "/d" ? "not_a_file" : "not_found")) });
    renderRouted(client);
    await flush();
    dropOnPane(["/d", "/gone"]);
    await flush();
    expect(screen.queryByRole("list", { name: labels.attachments })).toBeNull();
  });
});
