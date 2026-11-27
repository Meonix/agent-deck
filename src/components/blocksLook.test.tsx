import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttachmentChips } from "./AttachmentChips";
import css from "../index.css?raw";
import activityBar from "./ActivityBar.tsx?raw";
import composer from "./Composer.tsx?raw";
import folderMenu from "./FolderMenu.tsx?raw";
import suggestionMenu from "./SuggestionMenu.tsx?raw";
import cardStyles from "./cardStyles.ts?raw";

const rule = (selector: string) => css.match(new RegExp(`(?:^|[\\s}])${selector.replace(/[.:>*+ ]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

describe("Blocks in the pane (CR-020)", () => {
  it("puts the Composer on an 18px canvas block with no top border, its field transparent", () => {
    expect(composer).not.toMatch(/border-t|bg-card/);
    expect(composer).toMatch(/bg-canvas/);
    expect(composer).toMatch(/rounded-group/);
    expect(composer).toMatch(/mx-3/);
    expect(rule(".field")).toMatch(/background:\s*transparent/);
    expect(rule(".field")).not.toMatch(/border:\s*1px/);
  });

  it("draws Send round in primary and Stop round in error", () => {
    expect(rule(".send")).toMatch(/background:\s*var\(--primary\)/);
    expect(rule(".send")).toMatch(/border-radius:\s*var\(--oneui-radius-pill\)/);
    expect(rule(".stop")).toMatch(/background:\s*var\(--error\);\s*color:\s*var\(--error-solid-foreground\)/);
    expect(rule(".stop")).not.toMatch(/border:/);
  });

  it("draws the Approval Strip as an 18px approval block with split text actions", () => {
    expect(rule(".strip")).toMatch(/background:\s*var\(--approval-bg\)/);
    expect(rule(".strip")).toMatch(/border-radius:\s*var\(--oneui-radius-group\)/);
    expect(rule(".strip")).not.toMatch(/border-top/);
    expect(rule(".strip-actions > * + *")).toMatch(/border-left:\s*1px solid var\(--approval-border\)/);
    expect(rule(".strip .allow")).toMatch(/background:\s*transparent;[^}]*color:\s*var\(--approval-foreground\);[^}]*font-weight:\s*600/);
    expect(rule(".strip .deny")).toMatch(/border:\s*0/);
  });

  it("draws cards as 18px accent blocks with pill options and split actions", () => {
    expect(cardStyles).toMatch(/mx-3/);
    expect(rule(".card")).toMatch(/background:\s*var\(--accent\)/);
    expect(rule(".card")).toMatch(/border:\s*0/);
    expect(rule(".card")).toMatch(/border-radius:\s*var\(--oneui-radius-group\)/);
    expect(rule(".card .side-label")).toMatch(/color:\s*var\(--accent-foreground\)/);
    expect(rule(".card .pick-on")).toMatch(/background:\s*var\(--primary\)/);
    expect(rule(".card-actions > * + *")).toMatch(/border-left:/);
  });

  it("draws a file chip as a pill on the surface, readable on the canvas block", () => {
    render(<AttachmentChips chips={[{ kind: "ok", name: "a.txt", size: 10, path: "/a.txt" }, { kind: "error", name: "big.bin" }]} onRemove={() => {}} />);
    const [ok, err] = screen.getAllByRole("listitem");
    expect(ok).toHaveClass("chip-file");
    expect(err).not.toHaveClass("chip-file");
    expect(rule(".chip-file")).toMatch(/background:\s*var\(--oneui-surface\);\s*color:\s*var\(--foreground\)/);
    expect(rule(".chip")).toMatch(/border-radius:\s*var\(--oneui-radius-pill\)/);
  });

  it("draws the picked option's radio in the colour of its primary pill", () => {
    expect(rule(".card .pick-on input")).toMatch(/accent-color:\s*var\(--primary-foreground\)/);
  });

  it("draws menus on the surface, 18px, no border, with the One UI shadow, picks on a 12px row", () => {
    const m = rule(".menu");
    expect(m).toMatch(/background:\s*var\(--oneui-surface\)/);
    expect(m).toMatch(/border:\s*0/);
    expect(m).toMatch(/border-radius:\s*var\(--oneui-radius-group\)/);
    expect(m).toMatch(/box-shadow:\s*var\(--oneui-shadow\)/);
    expect(suggestionMenu).toMatch(/rounded-row/);
    expect(folderMenu).toMatch(/rounded-row/);
    expect(folderMenu).toMatch(/focus-visible:bg-accent/);
  });

  it("drops the Activity Bar border, keeps the toast pill and adds its shadow, and draws the error callout as a block", () => {
    expect(activityBar).not.toMatch(/border-t/);
    expect(rule(".toast")).toMatch(/box-shadow:\s*var\(--oneui-shadow\)/);
    expect(rule(".callout-err")).toMatch(/border:\s*0/);
    expect(rule(".callout-err")).toMatch(/border-radius:\s*var\(--oneui-radius-group\)/);
  });
});
