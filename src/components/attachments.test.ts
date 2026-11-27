import { describe, expect, it } from "vitest";
import { MAX_ATTACH_BYTES, formatSize, insertPaths, removePath, tooLarge } from "./attachments";

describe("MAX_ATTACH_BYTES", () => {
  it("is 50 MB in bytes", () => {
    expect(MAX_ATTACH_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("tooLarge", () => {
  it("accepts a file of exactly the limit", () => {
    expect(tooLarge(MAX_ATTACH_BYTES)).toBe(false);
  });

  it("rejects a file one byte over the limit", () => {
    expect(tooLarge(MAX_ATTACH_BYTES + 1)).toBe(true);
  });
});

describe("formatSize", () => {
  it("shows bytes below 1 KB", () => {
    expect(formatSize(500)).toBe("500 B");
  });

  it("shows whole KB, rounded", () => {
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(219136)).toBe("214 KB");
  });

  it("shows MB with one decimal", () => {
    expect(formatSize(125829120)).toBe("120.0 MB");
  });
});

describe("insertPaths", () => {
  it("inserts at the end after a space-terminated word", () => {
    expect(insertPaths("xem lỗi trong ", 14, ["A", "B"])).toEqual({
      text: "xem lỗi trong A B ",
      caret: 18,
    });
  });

  it("adds a leading space when the caret follows a non-space char", () => {
    expect(insertPaths("abc", 3, ["A"])).toEqual({ text: "abc A ", caret: 6 });
  });

  it("inserts into an empty draft without a leading space", () => {
    expect(insertPaths("", 0, ["A"])).toEqual({ text: "A ", caret: 2 });
  });

  it("keeps text after the caret", () => {
    expect(insertPaths("x y", 1, ["A"])).toEqual({ text: "x A  y", caret: 4 });
  });

  it("returns the input unchanged for no paths", () => {
    expect(insertPaths("abc", 3, [])).toEqual({ text: "abc", caret: 3 });
  });
});

describe("removePath", () => {
  it("removes the path and the space after it", () => {
    expect(removePath("A giải thích", "A")).toBe("giải thích");
  });

  it("removes a path at the end", () => {
    expect(removePath("xem A", "A")).toBe("xem ");
  });

  it("returns the text unchanged when the path is absent", () => {
    expect(removePath("xem lỗi", "A")).toBe("xem lỗi");
  });
});
