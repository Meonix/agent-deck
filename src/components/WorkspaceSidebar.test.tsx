import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Workspace, WorkspacesClient } from "../api/workspaces";
import App from "../App";
import { fakeAdapter, fakeSessions } from "../test/fakes";

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
    expect(await screen.findByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("Folders")).toBeInTheDocument();
  });

  it("shows Missing only on a missing entry", async () => {
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta", true)]));
    const row = (await screen.findByText("beta")).closest("li") as HTMLElement;
    expect(within(row).getByText("Missing")).toBeInTheDocument();
    expect(screen.getAllByText("Missing")).toHaveLength(1);
  });

  it("highlights the clicked entry", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await user.click(await screen.findByText("beta"));
    expect(screen.getByText("beta").closest("li")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("alpha").closest("li")).not.toHaveAttribute("aria-current");
  });
});

describe("adding (5.2)", () => {
  it("leaves the list unchanged when the picker is cancelled", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")]);
    renderSidebar(client);
    await screen.findByText("alpha");
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    expect(client.pickFolder).toHaveBeenCalled();
    expect(client.add).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("adds a picked folder and selects it", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], { pickFolder: vi.fn(async () => "/p/gamma") });
    renderSidebar(client);
    await screen.findByText("alpha");
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    const added = await screen.findByText("gamma");
    expect(added.closest("li")).toHaveAttribute("aria-current", "true");
    expect(client.add).toHaveBeenCalledWith("/p/gamma");
  });

  it("selects the existing entry on a duplicate without adding a row", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha"), ws("b", "beta")], {
      pickFolder: vi.fn(async () => "/p/beta"),
    });
    renderSidebar(client);
    await screen.findByText("beta");
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    await vi.waitFor(() =>
      expect(screen.getByText("beta").closest("li")).toHaveAttribute("aria-current", "true"),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("removing (5.3)", () => {
  it("removes the entry on success", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    const row = (await screen.findByText("alpha")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /^Remove / }));
    await vi.waitFor(() => expect(screen.queryByText("alpha")).not.toBeInTheDocument());
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("keeps the entry and explains when sessions are open", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], {
      remove: vi.fn(async () => ({ ok: false as const, reason: "has_open_panes" as const })),
    });
    renderSidebar(client);
    const row = (await screen.findByText("alpha")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /^Remove / }));
    expect(
      await screen.findByText("Close the open sessions of this folder first"),
    ).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });
});

describe("empty state (5.4)", () => {
  it("shows No folders yet with a working Add Folder button", async () => {
    const user = userEvent.setup();
    const client = fakeClient([], { pickFolder: vi.fn(async () => "/p/gamma") });
    renderSidebar(client);
    expect(await screen.findByText("No folders yet")).toBeInTheDocument();
    expect(screen.getByText("Add a folder you work in with Claude Code.")).toBeInTheDocument();
    const main = screen.getByRole("main");
    await user.click(within(main).getByRole("button", { name: "+ Add Folder" }));
    expect(await screen.findByText("gamma")).toBeInTheDocument();
    expect(screen.queryByText("No folders yet")).not.toBeInTheDocument();
  });
});

describe("robustness (fix round 1)", () => {
  const reject = (m: string) => vi.fn(async () => Promise.reject(new Error(m)));

  it("shows a toast and still renders when the first load fails", async () => {
    renderSidebar(fakeClient([], { list: reject("disk") }));
    expect(await screen.findByText("Could not load folders: disk")).toBeInTheDocument();
    expect(screen.getByText("Folders")).toBeInTheDocument();
    expect(screen.getByText("No folders yet")).toBeInTheDocument();
  });

  it("shows a toast when picking or adding fails", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], {
      pickFolder: vi.fn(async () => "/p/x"),
      add: reject("boom"),
    });
    renderSidebar(client);
    await screen.findByText("alpha");
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    expect(await screen.findByText("Could not add folder: boom")).toBeInTheDocument();
  });

  it("shows a toast when remove rejects", async () => {
    const user = userEvent.setup();
    const client = fakeClient([ws("a", "alpha")], { remove: reject("nope") });
    renderSidebar(client);
    await screen.findByText("alpha");
    await user.click(screen.getByRole("button", { name: "Remove alpha" }));
    expect(await screen.findByText("Could not remove folder: nope")).toBeInTheDocument();
  });

  it("opens the picker once on a double click", async () => {
    const user = userEvent.setup();
    let release: (v: string | null) => void = () => {};
    const client = fakeClient([ws("a", "alpha")], {
      pickFolder: vi.fn(() => new Promise<string | null>((r) => (release = r))),
    });
    renderSidebar(client);
    await screen.findByText("alpha");
    await user.dblClick(screen.getByRole("button", { name: "+ Add Folder" }));
    expect(client.pickFolder).toHaveBeenCalledTimes(1);
    release(null);
    await user.click(screen.getByRole("button", { name: "+ Add Folder" }));
    expect(client.pickFolder).toHaveBeenCalledTimes(2);
    release(null);
  });

  it("selects a row from the keyboard", async () => {
    const user = userEvent.setup();
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta")]));
    await screen.findByText("beta");
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByText("alpha").closest("li")).toHaveAttribute("aria-current", "true");
  });

  it("gives each Remove button a distinct name and exposes Missing", async () => {
    renderSidebar(fakeClient([ws("a", "alpha"), ws("b", "beta", true)]));
    await screen.findByText("beta");
    expect(screen.getByRole("button", { name: "Remove alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beta.*Missing/ })).toBeInTheDocument();
  });
});
