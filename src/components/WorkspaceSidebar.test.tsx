import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Workspace, WorkspacesClient } from "../api/workspaces";
import App from "../App";
import { fakeAdapter, fakeSessions } from "../test/fakes";
import { labels } from "../labels";

// Folder names also head the Session History Panel once a folder is selected.
const folders = () => within(screen.getByRole("list", { name: labels.folders }));

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

describe("listing (5.1)", () => {
  it("renders each folder name", async () => {
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    expect(await folders().findByText("alpha")).toBeInTheDocument();
    expect(folders().getByText("beta")).toBeInTheDocument();
    expect(screen.getByText(labels.folders)).toBeInTheDocument();
  });

  it("shows Missing only on a missing entry", async () => {
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta", true)]));
    const row = (await folders().findByText("beta")).closest("li") as HTMLElement;
    expect(within(row).getByText(labels.missing)).toBeInTheDocument();
    expect(screen.getAllByText(labels.missing)).toHaveLength(1);
  });

  it("highlights the clicked entry", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await user.click(await folders().findByText("beta"));
    expect(folders().getByText("beta").closest("li")).toHaveAttribute("aria-current", "true");
    expect(folders().getByText("alpha").closest("li")).not.toHaveAttribute("aria-current");
  });
});

describe("adding (5.2)", () => {
  it("leaves the list unchanged when the picker is cancelled", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")]);
    renderSidebar(client);
    await folders().findByText("alpha");
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    expect(client.pickFolder).toHaveBeenCalled();
    expect(client.add).not.toHaveBeenCalled();
    expect(folders().getAllByRole("listitem")).toHaveLength(1);
  });

  it("adds a picked folder and selects it", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], { pickFolder: vi.fn(async () => "/p/gamma") });
    renderSidebar(client);
    await folders().findByText("alpha");
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    const added = await folders().findByText("gamma");
    expect(added.closest("li")).toHaveAttribute("aria-current", "true");
    expect(client.add).toHaveBeenCalledWith("/p/gamma");
  });

  it("selects the existing entry on a duplicate without adding a row", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha"), ws("b", "beta")], {
      pickFolder: vi.fn(async () => "/p/beta"),
    });
    renderSidebar(client);
    await folders().findByText("beta");
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    await vi.waitFor(() =>
      expect(folders().getByText("beta").closest("li")).toHaveAttribute("aria-current", "true"),
    );
    expect(folders().getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("removing (5.3)", () => {
  it("removes the entry on success", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    const row = (await folders().findByText("alpha")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: new RegExp(`^${labels.removeFolder("")}`) }));
    await vi.waitFor(() => expect(screen.queryByText("alpha")).not.toBeInTheDocument());
    expect(folders().getByText("beta")).toBeInTheDocument();
  });

  it("keeps the entry and explains when sessions are open", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], {
      remove: vi.fn(async () => ({ ok: false as const, reason: "has_open_panes" as const })),
    });
    renderSidebar(client);
    const row = (await folders().findByText("alpha")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: new RegExp(`^${labels.removeFolder("")}`) }));
    expect(
      await screen.findByText(labels.closeOpenSessionsFirst),
    ).toBeInTheDocument();
    expect(folders().getByText("alpha")).toBeInTheDocument();
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
    expect(await folders().findByText("gamma")).toBeInTheDocument();
    expect(screen.queryByText(labels.noFolders)).not.toBeInTheDocument();
  });
});

describe("robustness (fix round 1)", () => {
  const reject = (m: string) => vi.fn(async () => Promise.reject(new Error(m)));

  it("shows a toast and still renders when the first load fails", async () => {
    renderSidebar(fakeClient([], { list: reject("disk") }));
    expect(await screen.findByText(`${labels.loadFoldersFailed}: disk`)).toBeInTheDocument();
    expect(screen.getByText(labels.folders)).toBeInTheDocument();
    expect(screen.getByText(labels.noFolders)).toBeInTheDocument();
  });

  it("shows a toast when picking or adding fails", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], {
      pickFolder: vi.fn(async () => "/p/x"),
      add: reject("boom"),
    });
    renderSidebar(client);
    await folders().findByText("alpha");
    await user.click(screen.getByRole("button", { name: labels.addFolder }));
    expect(await screen.findByText(`${labels.addFolderFailed}: boom`)).toBeInTheDocument();
  });

  it("shows a toast when remove rejects", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], { remove: reject("nope") });
    renderSidebar(client);
    await folders().findByText("alpha");
    await user.click(screen.getByRole("button", { name: labels.removeFolder("alpha") }));
    expect(await screen.findByText(`${labels.removeFolderFailed}: nope`)).toBeInTheDocument();
  });

  it("opens the picker once on a double click", async () => {
    const user = userEvent.setup();
    let release: (v: string | null) => void = () => {};
    const client = fakeClient([ws("a", "alpha")], {
      pickFolder: vi.fn(() => new Promise<string | null>((r) => (release = r))),
    });
    renderSidebar(client);
    await folders().findByText("alpha");
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
    await folders().findByText("beta");
    // The first row comes first; labels.addFolder sits at the sidebar foot.
    await user.tab();
    await user.keyboard("{Enter}");
    expect(folders().getByText("alpha").closest("li")).toHaveAttribute("aria-current", "true");
  });

  it("keeps Remove in the tab order right after its folder row", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await folders().findByText("beta");
    // The alpha row, then its Remove.
    for (let i = 0; i < 2; i++) await user.tab();
    expect(screen.getByRole("button", { name: labels.removeFolder("alpha") })).toHaveFocus();
  });

  it("puts + Add Folder after every list row in the tab order", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha")]));
    await folders().findByText("alpha");
    // The alpha row, its Remove, then the sidebar foot.
    for (let i = 0; i < 3; i++) await user.tab();
    expect(screen.getByRole("button", { name: labels.addFolder })).toHaveFocus();
  });

  it("marks the selected folder with the focus bar", async () => {
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await folders().findByText("beta");
    await userEvent.setup().click(folders().getByText("beta"));
    expect(folders().getByText("beta").closest("li")).toHaveClass("border-l-row-focus");
    expect(folders().getByText("alpha").closest("li")).toHaveClass("border-l-transparent");
  });

  it("reveals Remove only on row hover or keyboard focus", async () => {
    renderSidebar(fakeClient([ws("a", "alpha")]));
    await folders().findByText("alpha");
    const remove = screen.getByRole("button", { name: labels.removeFolder("alpha") });
    expect(remove).toHaveClass("opacity-0", "group-hover:opacity-100", "focus-visible:opacity-100");
    expect(remove).toHaveAttribute("title", labels.removeFolder("alpha"));
    expect(remove.closest("li")).toHaveClass("group");
  });

  it("keeps Add Folder inside the Workspaces sidebar", async () => {
    renderSidebar(fakeClient([ws("a", "alpha")]));
    await folders().findByText("alpha");
    const sidebar = screen.getByRole("complementary", { name: labels.sidebar });
    expect(within(sidebar).getByRole("button", { name: labels.addFolder })).toBeInTheDocument();
  });

  it("keeps the sidebar list scroll position across hide and show (SRS-FR-088)", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await folders().findByText("beta");
    const sidebar = screen.getByRole("complementary", { name: labels.sidebar });
    const scroller = sidebar.classList.contains("overflow-auto") ? sidebar : (sidebar.querySelector(".overflow-auto") as HTMLElement);
    scroller.scrollTop = 120;
    await user.click(screen.getByRole("button", { name: labels.hideSidebar }));
    await user.click(screen.getByRole("button", { name: labels.showSidebar }));
    expect(scroller.isConnected).toBe(true);
    expect(scroller.scrollTop).toBe(120);
  });

  it("keeps the three section titles", async () => {
    renderSidebar(fakeClient([ws("a", "alpha")]));
    await folders().findByText("alpha");
    expect(screen.getByText(labels.folders)).toBeInTheDocument();
    expect(screen.getByText(labels.activeCount(0))).toBeInTheDocument();
    expect(screen.getByText(labels.stashedCount(0))).toBeInTheDocument();
  });

  it("gives each Remove button a distinct name and exposes Missing", async () => {
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta", true)]));
    await folders().findByText("beta");
    expect(screen.getByRole("button", { name: labels.removeFolder("alpha") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.removeFolder("beta") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`beta.*${labels.missing}`) })).toBeInTheDocument();
  });
});
