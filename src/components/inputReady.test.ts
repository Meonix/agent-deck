import { describe, expect, it } from "vitest";
import * as screens from "./fixtures/claude-screens";
import { inputReadiness } from "./inputReady";

// The fixtures were captured at 120 columns.
const COLS = 120;
const ready = { ready: true };
const locked = (reason: string) => ({ ready: false, reason });

describe("inputReadiness (RULE-12)", () => {
  it("is ended when the session ended, whatever the screen shows", () => {
    expect(inputReadiness(screens.idle, "Ended", COLS)).toEqual(locked("ended"));
  });

  it("waits for approval while the state says so, whatever the screen shows", () => {
    expect(inputReadiness(screens.idle, "Needs Approval", COLS)).toEqual(locked("approval"));
  });

  it.each(["permission", "question", "trust"] as const)("waits for approval on the %s dialog", (name) => {
    expect(inputReadiness(screens[name], "Idle", COLS)).toEqual(locked("approval"));
    expect(inputReadiness(screens[name], "Running", COLS)).toEqual(locked("approval"));
  });

  it("is running while a turn runs", () => {
    expect(inputReadiness(screens.running, "Running", COLS)).toEqual(locked("running"));
  });

  it("is ready on the placeholder or on a bare ❯", () => {
    expect(inputReadiness(screens.idle, "Idle", COLS)).toEqual(ready);
    expect(inputReadiness(screens.afterEsc, "Idle", COLS)).toEqual(ready);
    expect(inputReadiness(screens.running, "Idle", COLS)).toEqual(ready);
  });

  it("does not recognise a box holding typed text", () => {
    expect(inputReadiness(screens.typed, "Idle", COLS)).toEqual(locked("unrecognized"));
  });

  it("reads the bottom-most box, not the ones echoed above it", () => {
    expect(inputReadiness(screens.readyBoxAboveTyped, "Idle", COLS)).toEqual(locked("unrecognized"));
  });

  it("waits for approval on a dialog below the live box", () => {
    expect(inputReadiness(screens.dialogBelowBox, "Idle", COLS)).toEqual(locked("approval"));
  });

  it("ignores dialog words above the live box", () => {
    expect(inputReadiness(screens.dialogTextAboveBox, "Idle", COLS)).toEqual(ready);
  });

  it("does not recognise a screen without a box", () => {
    expect(inputReadiness(screens.noBox, "Idle", COLS)).toEqual(locked("unrecognized"));
  });

  it("does not take rows shorter than half the width as rules", () => {
    expect(inputReadiness(screens.shortRules, "Idle", COLS)).toEqual(locked("unrecognized"));
  });

  it("reads the screen in the Error state too", () => {
    expect(inputReadiness(screens.idle, "Error", COLS)).toEqual(ready);
  });

  it("reads continuation rows before the closing rule", () => {
    expect(inputReadiness(screens.emptyContinuation, "Idle", COLS)).toEqual(ready);
    expect(inputReadiness(screens.dimContinuation, "Idle", COLS)).toEqual(ready);
    expect(inputReadiness(screens.typedContinuation, "Idle", COLS)).toEqual(locked("unrecognized"));
  });

  it("measures the rules against the terminal's columns, not the longest row's code units", () => {
    // NFD Vietnamese and stacked marks take one cell per base letter but many code units.
    const marks = { text: "a" + "\u0301".repeat(300), dim: Array(301).fill(false) };
    expect(inputReadiness([marks, ...screens.idle], "Idle", COLS)).toEqual(ready);
  });
});
