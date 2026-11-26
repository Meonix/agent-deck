import { describe, expect, it } from "vitest";
import * as screens from "./fixtures/claude-screens";
import { inputReadiness } from "./inputReady";

const ready = { ready: true };
const locked = (reason: string) => ({ ready: false, reason });

describe("inputReadiness (RULE-12)", () => {
  it("is ended when the session ended, whatever the screen shows", () => {
    expect(inputReadiness(screens.idle, "Ended")).toEqual(locked("ended"));
  });

  it("waits for approval while the state says so, whatever the screen shows", () => {
    expect(inputReadiness(screens.idle, "Needs Approval")).toEqual(locked("approval"));
  });

  it.each(["permission", "question", "trust"] as const)("waits for approval on the %s dialog", (name) => {
    expect(inputReadiness(screens[name], "Idle")).toEqual(locked("approval"));
    expect(inputReadiness(screens[name], "Running")).toEqual(locked("approval"));
  });

  it("is running while a turn runs", () => {
    expect(inputReadiness(screens.running, "Running")).toEqual(locked("running"));
  });

  it("is ready on the placeholder or on a bare ❯", () => {
    expect(inputReadiness(screens.idle, "Idle")).toEqual(ready);
    expect(inputReadiness(screens.afterEsc, "Idle")).toEqual(ready);
    expect(inputReadiness(screens.running, "Idle")).toEqual(ready);
  });

  it("does not recognise a box holding typed text", () => {
    expect(inputReadiness(screens.typed, "Idle")).toEqual(locked("unrecognized"));
  });

  it("reads the bottom-most box, not the ones echoed above it", () => {
    expect(inputReadiness(screens.readyBoxAboveTyped, "Idle")).toEqual(locked("unrecognized"));
  });

  it("waits for approval on a dialog below the live box", () => {
    expect(inputReadiness(screens.dialogBelowBox, "Idle")).toEqual(locked("approval"));
  });

  it("ignores dialog words above the live box", () => {
    expect(inputReadiness(screens.dialogTextAboveBox, "Idle")).toEqual(ready);
  });

  it("does not recognise a screen without a box", () => {
    expect(inputReadiness(screens.noBox, "Idle")).toEqual(locked("unrecognized"));
  });

  it("does not take rows shorter than half the width as rules", () => {
    expect(inputReadiness(screens.shortRules, "Idle")).toEqual(locked("unrecognized"));
  });

  it("reads the screen in the Error state too", () => {
    expect(inputReadiness(screens.idle, "Error")).toEqual(ready);
  });

  it("reads continuation rows before the closing rule", () => {
    expect(inputReadiness(screens.emptyContinuation, "Idle")).toEqual(ready);
    expect(inputReadiness(screens.dimContinuation, "Idle")).toEqual(ready);
    expect(inputReadiness(screens.typedContinuation, "Idle")).toEqual(locked("unrecognized"));
  });
});
