import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Workspace, WorkspacesClient } from "../api/workspaces";
import App from "../App";
import { fakeAdapter, fakeSessions } from "../test/fakes";
import { labels } from "../labels";
import { LEAD_BOX, TREE_ROW } from "./WorkspaceSidebar";

// Folder names also head the Session History Panel once a folder is selected, so rows are found inside the Sidebar.
const sidebar = () => screen.getByRole("complementary", { name: labels.sidebar });
const OTHER_FOLDERS = new RegExp(`^${labels.otherFolders(0).replace("(0)", "\\(\\d+\\)")}$`);
const otherFolders = () => within(sidebar()).getByRole("button", { name: OTHER_FOLDERS });
/** Waits for the list, then makes sure "Folder khác", where every workspace without an open session sits, is open. */
const openOtherFolders = async (user: ReturnType<typeof userEvent.setup>) => {
  const group = await within(sidebar()).findByRole("button", { name: OTHER_FOLDERS });
  if (group.getAttribute("aria-expanded") !== "true") await user.click(group);
};
const nameButton = (name: string) =>
  within(sidebar()).getByRole("button", { name: new RegExp(`^${name}\\s*(${labels.missing})?$`) });
const moreButton = (name: string) => within(sidebar()).getByRole("button", { name: labels.folderMenu(name) });
const menu = () => screen.getByRole("menu");
const item = (name: string) => within(menu()).getByRole("menuitem", { name });

async function openPaneIn(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(nameButton(name));
  const history = screen.getByRole("region", { name: labels.sessionHistory });
  await user.click(within(history).getByRole("button", { name: labels.newSession }));
  await within(sidebar()).findByRole("button", { name: labels.collapse(name) });
}

const renderSidebar = (client: WorkspacesClient) =>
  render(<App workspaces={client} sessions={fakeSessions()} createTerminal={() => fakeAdapter()} />);

const ws = (id: string, name: string, missing = false): Workspace => ({
  id,
  name,
  path: `/p/${name}`,
  missing,
});

function fakeClient(initial: Workspace[], over: Partial<WorkspacesClient> = {}) {
  let items = [...initial];
  const client: WorkspacesClient = {
    list: vi.fn(async () => [...items]),
    pickFolder: vi.fn(async () => null),
    add: vi.fn(async (path: string) => {
      const name = path.split("/").pop() as string;
      const found = items.find((w) => w.path === path);
      if (found) return { outcome: "alreadyPresent" as const, id: found.id };
      items = [...items, { id: `id-${name}`, name, path, missing: false }];
      return { outcome: "added" as const, id: `id-${name}` };
    }),
    remove: vi.fn(async (id: string) => {
      items = items.filter((w) => w.id !== id);
      return { ok: true as const };
    }),
    ...over,
  };
  return client;
}

describe("title (CR-016)", () => {
  it("opens the Sidebar with the app title", async () => {
    renderSidebar(fakeClient([ws("a", "alpha")]));
    const sidebar = await screen.findByRole("complementary", { name: labels.sidebar });
    expect(within(sidebar).getByRole("heading", { name: labels.appTitle })).toHaveTextContent("Agent Deck");
  });
});

describe("listing (5.1)", () => {
  it("renders each folder name", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await openOtherFolders(user);
    expect(nameButton("alpha")).toBeInTheDocument();
    expect(nameButton("beta")).toBeInTheDocument();
  });

  it("shows Missing only on a missing entry", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta", true)]));
    await openOtherFolders(user);
    const row = nameButton("beta").closest("li") as HTMLElement;
    expect(within(row).getByText(labels.missing)).toBeInTheDocument();
    expect(screen.getAllByText(labels.missing)).toHaveLength(1);
  });

  it("highlights the clicked entry", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await openOtherFolders(user);
    await user.click(nameButton("beta"));
    expect(nameButton("beta").closest("li")).toHaveAttribute("aria-current", "true");
    expect(nameButton("alpha").closest("li")).not.toHaveAttribute("aria-current");
  });
});

describe("adding (5.2)", () => {
  it("leaves the list unchanged when the picker is cancelled", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")]);
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    expect(client.pickFolder).toHaveBeenCalled();
    expect(client.add).not.toHaveBeenCalled();
    expect(otherFolders()).toHaveAccessibleName(labels.otherFolders(1));
  });

  it("adds a picked folder and selects it", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], { pickFolder: vi.fn(async () => "/p/gamma") });
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    await vi.waitFor(() => expect(nameButton("gamma").closest("li")).toHaveAttribute("aria-current", "true"));
    expect(client.add).toHaveBeenCalledWith("/p/gamma");
  });

  it("selects the existing entry on a duplicate without adding a row", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha"), ws("b", "beta")], {
      pickFolder: vi.fn(async () => "/p/beta"),
    });
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    await vi.waitFor(() => expect(nameButton("beta").closest("li")).toHaveAttribute("aria-current", "true"));
    expect(otherFolders()).toHaveAccessibleName(labels.otherFolders(2));
  });
});

describe("empty state (5.4)", () => {
  it("shows No folders yet with a working Add Folder button", async () => {
    const user = userEvent.setup();
    const client = fakeClient([], { pickFolder: vi.fn(async () => "/p/gamma") });
    renderSidebar(client);
    expect(await screen.findByText(labels.noFolders)).toBeInTheDocument();
    expect(screen.getByText(labels.noFoldersHint)).toBeInTheDocument();
    const main = screen.getByRole("main");
    await user.click(within(main).getByRole("button", { name: labels.addFolder }));
    await openOtherFolders(user);
    expect(nameButton("gamma")).toBeInTheDocument();
    expect(screen.queryByText(labels.noFolders)).not.toBeInTheDocument();
  });
});

describe("robustness (fix round 1)", () => {
  const reject = (m: string) => vi.fn(async () => Promise.reject(new Error(m)));

  it("shows a toast and still renders when the first load fails", async () => {
    renderSidebar(fakeClient([], { list: reject("disk") }));
    expect(await screen.findByText(`${labels.loadFoldersFailed}: disk`)).toBeInTheDocument();
    expect(within(sidebar()).getByRole("button", { name: labels.addFolder })).toBeInTheDocument();
    expect(screen.getByText(labels.noFolders)).toBeInTheDocument();
  });

  it("shows a toast when picking or adding fails", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], {
      pickFolder: vi.fn(async () => "/p/x"),
      add: reject("boom"),
    });
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    expect(await screen.findByText(`${labels.addFolderFailed}: boom`)).toBeInTheDocument();
  });

  it("shows a toast when remove rejects", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], { remove: reject("nope") });
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(moreButton("alpha"));
    await user.click(item(labels.removeFolder));
    expect(await screen.findByText(`${labels.removeFolderFailed}: nope`)).toBeInTheDocument();
  });

  it("opens the picker once on a double click", async () => {
    const user = userEvent.setup();
    let release: (v: string | null) => void = () => {};
    const client = fakeClient([ws("a", "alpha")], {
      pickFolder: vi.fn(() => new Promise<string | null>((r) => (release = r))),
    });
    renderSidebar(client);
    await openOtherFolders(user);
    await user.dblClick(screen.getByRole("button", { name: labels.addFolder }));
    expect(client.pickFolder).toHaveBeenCalledTimes(1);
    release(null);
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    expect(client.pickFolder).toHaveBeenCalledTimes(2);
    release(null);
  });

  it("selects a row from the keyboard", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await within(sidebar()).findByRole("button", { name: OTHER_FOLDERS });
    // Folder khác comes first and is already open with nothing running (CR-017); its first row follows.
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(nameButton("alpha").closest("li")).toHaveAttribute("aria-current", "true");
  });

  it("keeps Add Folder inside the Workspaces sidebar", async () => {
    renderSidebar(fakeClient([ws("a", "alpha")]));
    await within(sidebar()).findByRole("button", { name: OTHER_FOLDERS });
    expect(within(sidebar()).getByRole("button", { name: labels.addFolder })).toBeInTheDocument();
  });

  it("keeps the sidebar list scroll position across hide and show (SRS-FR-088)", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await within(sidebar()).findByRole("button", { name: OTHER_FOLDERS });
    const aside = sidebar();
    const scroller = aside.classList.contains("overflow-auto") ? aside : (aside.querySelector(".overflow-auto") as HTMLElement);
    scroller.scrollTop = 120;
    await user.click(screen.getByRole("button", { name: labels.hideSidebar }));
    await user.click(screen.getByRole("button", { name: labels.showSidebar }));
    expect(scroller.isConnected).toBe(true);
    expect(scroller.scrollTop).toBe(120);
  });

});

describe("Folder Tree rows (2.6)", () => {
  it("puts Thêm folder right after the last group, as the last tab stop of the Sidebar", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha")]));
    await within(sidebar()).findByRole("button", { name: labels.otherFolders(1) });
    const add = within(sidebar()).getByRole("button", { name: labels.addFolder });
    expect(otherFolders().compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The Folder khác group (folded here by Enter), then Thêm folder.
    await user.tab();
    expect(otherFolders()).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(add).toHaveFocus();
    // Inside the scrolling tree, not a bar pinned to the Sidebar foot.
    expect(add.closest(".overflow-auto")).not.toBeNull();
  });

  it("still selects a workspace and opens its Session History Panel on a click of its name", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await openOtherFolders(user);
    await user.click(nameButton("beta"));
    expect(nameButton("beta").closest("li")).toHaveAttribute("aria-current", "true");
    expect(nameButton("alpha").closest("li")).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("region", { name: labels.sessionHistory })).toBeInTheDocument();
  });

  it("starts every group header and workspace row with the same lead box, so their text lines up", async () => {
    localStorage.setItem(
      "adStashedSessions",
      JSON.stringify({ version: 1, sessions: [{ sessionId: "old", workspaceId: "b", workspaceName: "beta", title: "Old", stashedAt: 1 }] }),
    );
    const sessions = fakeSessions({ list: vi.fn(async () => ({ sessions: [{ id: "old", title: "Old", lastActivity: 1 }], unreadable: 0 })) });
    const user = userEvent.setup();
    render(<App workspaces={fakeClient([ws("a", "alpha"), ws("b", "beta")])} sessions={sessions} createTerminal={() => fakeAdapter()} />);
    await openOtherFolders(user);
    await openPaneIn(user, "alpha");
    const stashHeader = (await within(sidebar()).findByText(labels.stashedCount(1))).parentElement!;
    const workspaceRow = within(sidebar()).getByRole("button", { name: labels.collapse("alpha") }).parentElement!;
    for (const row of [otherFolders(), stashHeader, workspaceRow]) {
      expect(row).toHaveClass(...TREE_ROW.split(" "));
      expect(row.firstElementChild).toHaveClass(...LEAD_BOX.split(" "));
    }
  });

  it("exposes Missing on the workspace name, and every row has its own ⋯", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta", true)]));
    await openOtherFolders(user);
    expect(within(sidebar()).getByRole("button", { name: new RegExp(`beta.*${labels.missing}`) })).toBeInTheDocument();
    expect(screen.getAllByText(labels.missing)).toHaveLength(1);
    expect(moreButton("alpha")).toBeInTheDocument();
    expect(moreButton("beta")).toBeInTheDocument();
  });
});

describe("Folder Menu (3.1 to 3.3)", () => {
  const ITEMS = [labels.viewFiles, labels.copyPath, labels.removeFolder];

  it("opens on ⋯ of a workspace with an open session, items in the design's order (SRS-FR-143)", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    await openPaneIn(user, "mokairo");
    const more = moreButton("mokairo");
    expect(more).toHaveAttribute("aria-haspopup", "menu");
    expect(more).toHaveAttribute("aria-expanded", "false");

    await user.click(more);

    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(within(menu()).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(ITEMS);
    expect(item(labels.removeFolder)).toHaveClass("w-err");
  });

  it("opens on ⋯ of a workspace inside Folder khác", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("n", "notes")]));
    await openOtherFolders(user);
    await user.click(moreButton("notes"));
    expect(within(menu()).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(ITEMS);
  });

  it("shows Xem file disabled; choosing it does nothing", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("m", "mokairo")]);
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    expect(item(labels.viewFiles)).toHaveAttribute("aria-disabled", "true");

    await user.click(item(labels.viewFiles));

    expect(menu()).toBeInTheDocument();
    expect(client.remove).not.toHaveBeenCalled();
    expect(nameButton("mokairo")).toBeInTheDocument();
  });

  it("focuses the first enabled item and moves with ↑ and ↓", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    expect(item(labels.copyPath)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item(labels.removeFolder)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item(labels.viewFiles)).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item(labels.removeFolder)).toHaveFocus();
  });

  it("closes on Esc, on a click outside and on choosing an item, giving focus back to ⋯", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("m", "mokairo")]);
    renderSidebar(client);
    await openOtherFolders(user);
    const more = moreButton("mokairo");

    await user.click(more);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute("aria-expanded", "false");

    await user.click(more);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more).toHaveFocus();

    await user.click(more);
    await user.click(item(labels.copyPath));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    expect(client.remove).not.toHaveBeenCalled();
  });

  it("removes the workspace with Bỏ folder, leaving its history to the backend (SRS-FR-004)", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha"), ws("m", "mokairo")]);
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    await user.click(item(labels.removeFolder));
    await vi.waitFor(() => expect(within(sidebar()).queryByRole("button", { name: "mokairo" })).not.toBeInTheDocument());
    expect(client.remove).toHaveBeenCalledWith("m");
    expect(nameButton("alpha")).toBeInTheDocument();
  });

  it("moves focus to Thêm folder once Bỏ folder has removed the row", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("m", "mokairo")]));
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    await user.click(item(labels.removeFolder));
    await vi.waitFor(() => expect(within(sidebar()).getByRole("button", { name: labels.addFolder })).toHaveFocus());
  });

  it("gives focus back to ⋯ when Bỏ folder is refused", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("m", "mokairo")], {
      remove: vi.fn(async () => ({ ok: false as const, reason: "has_open_panes" as const })),
    });
    renderSidebar(client);
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    await user.click(item(labels.removeFolder));
    expect(await screen.findByText(labels.closeOpenSessionsFirst)).toBeInTheDocument();
    expect(moreButton("mokairo")).toHaveFocus();
  });

  it("keeps a workspace with open panes and says to close them first (SRS-FR-006)", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("m", "mokairo")], {
      remove: vi.fn(async () => ({ ok: false as const, reason: "has_open_panes" as const })),
    });
    renderSidebar(client);
    await openOtherFolders(user);
    await openPaneIn(user, "mokairo");
    await user.click(moreButton("mokairo"));
    await user.click(item(labels.removeFolder));
    expect(await screen.findByText(labels.closeOpenSessionsFirst)).toBeInTheDocument();
    expect(nameButton("mokairo")).toBeInTheDocument();
  });

  it("copies the workspace path with Chép đường dẫn and leaves the tree as it was (SRS-FR-144)", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderSidebar(fakeClient([ws("a", "alpha"), ws("m", "mokairo")]));
    await openOtherFolders(user);
    const before = sidebar().textContent;
    await user.click(moreButton("mokairo"));
    await user.click(item(labels.copyPath));
    expect(writeText).toHaveBeenCalledWith("/p/mokairo");
    expect(sidebar().textContent).toBe(before);
  });

  // The menu is fixed where ⋯ was when it opened, so anything that moves ⋯ closes it.
  it("closes when anything scrolls, giving focus back to ⋯", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    const more = moreButton("mokairo");
    await user.click(more);
    const scroller = sidebar().querySelector(".overflow-auto") as HTMLElement;

    fireEvent.scroll(scroller);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).toHaveFocus();
  });

  it("closes when the window is resized", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    const more = moreButton("mokairo");
    await user.click(more);

    fireEvent(window, new Event("resize"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it("closes when the Sidebar is hidden, without focusing the hidden ⋯", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    const more = moreButton("mokairo");

    await user.keyboard("{Control>}b{/Control}");

    expect(screen.queryByRole("complementary", { name: labels.sidebar })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu", { hidden: true })).not.toBeInTheDocument();
    expect(more).not.toHaveFocus();

    await user.click(screen.getByRole("button", { name: labels.showSidebar }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(moreButton("mokairo")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens above ⋯ when it would run past the window's bottom", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    const more = moreButton("mokairo");
    vi.spyOn(more, "getBoundingClientRect").mockReturnValue(
      { top: 570, bottom: 594, left: 100, right: 124, width: 24, height: 24, x: 100, y: 570, toJSON: () => ({}) } as DOMRect,
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(104);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
    try {
      await user.click(more);
      // 594 + 4 + 104 > 600, so it sits at 570 - 104 - 4.
      expect(menu().style.top).toBe("462px");
      expect(menu().style.left).toBe("100px");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("opens below ⋯ when there is room", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    const more = moreButton("mokairo");
    vi.spyOn(more, "getBoundingClientRect").mockReturnValue(
      { top: 100, bottom: 124, left: 100, right: 124, width: 24, height: 24, x: 100, y: 100, toJSON: () => ({}) } as DOMRect,
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(104);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
    try {
      await user.click(more);
      expect(menu().style.top).toBe("128px");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("says so when the clipboard refuses the path", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => Promise.reject(new Error("denied")));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderSidebar(fakeClient([ws("m", "mokairo")]));
    await openOtherFolders(user);
    await user.click(moreButton("mokairo"));
    await user.click(item(labels.copyPath));
    expect(await screen.findByText(labels.copyPathFailed)).toBeInTheDocument();
  });
});
