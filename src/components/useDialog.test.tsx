import { render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";
import type { PaneStatus } from "../api/sessions";
import { labels } from "../labels";
import { fakeAdapter, fakeSessions } from "../test/fakes";
import type { ChatState } from "./chatState";
import * as claude from "./fixtures/claude-screens";
import type { TerminalAdapter } from "./TerminalPane";
import { ToastProvider } from "./Toast";
import { useDialog } from "./useDialog";

const CHAT: ChatState = {
  loading: false,
  unreadable: false,
  held: {},
  items: [{ kind: "tool", key: "k", id: "t", name: "Bash", arg: "touch a.txt", result: null }],
};
const status = (state: PaneStatus["state"]): PaneStatus => ({ state, since: 0, reason: null, tracked: true });

type Props = { adapter: TerminalAdapter; client: ReturnType<typeof fakeSessions>; status: PaneStatus; ended: boolean; fire: boolean };

// Answers during the commit that brings the new props, before the hook's own effect could take the strip away.
function Harness({ adapter, client, status, ended, fire }: Props) {
  const dialog = useDialog({ paneId: "p1", adapter, status, ended, chat: CHAT, client });
  useLayoutEffect(() => {
    if (fire) dialog.answer({ kind: "allow" });
  }, [fire]);
  return dialog.strip ? <span>strip</span> : null;
}

function harness() {
  const adapter = fakeAdapter();
  adapter.showScreen(claude.permissionNo4);
  const client = fakeSessions();
  const props = { adapter, client, status: status("Needs Approval"), ended: false, fire: false };
  const view = render(
    <ToastProvider>
      <Harness {...props} />
    </ToastProvider>,
  );
  expect(screen.getByText("strip")).toBeInTheDocument();
  const answerWith = (over: Partial<Props>) =>
    view.rerender(
      <ToastProvider>
        <Harness {...props} {...over} fire />
      </ToastProvider>,
    );
  return { client, answerWith };
}

describe("useDialog answers what the pane shows now (SRS-FR-165)", () => {
  it("writes nothing once the session left Needs Approval", () => {
    const { client, answerWith } = harness();
    answerWith({ status: status("Running") });
    expect(client.write).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(labels.requestChanged);
  });

  it("writes nothing once the session ended", () => {
    const { client, answerWith } = harness();
    answerWith({ ended: true });
    expect(client.write).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(labels.requestChanged);
  });

  it("writes the answer while the strip still stands", () => {
    const { client, answerWith } = harness();
    answerWith({});
    expect(client.write).toHaveBeenCalledWith("p1", "1");
  });
});
