import { describe, expect, it } from "vitest";
import { formatShare } from "./latencyReport";

describe("formatShare", () => {
  it("floors to one decimal and drops a trailing .0", () => {
    expect(formatShare(398, 400)).toBe("99.5%");
    expect(formatShare(999, 1000)).toBe("99.9%");
    expect(formatShare(2, 3)).toBe("66.6%");
    expect(formatShare(1, 1)).toBe("100%");
    expect(formatShare(0, 5)).toBe("0%");
  });
});
