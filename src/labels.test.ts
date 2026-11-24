import { describe, expect, it } from "vitest";
import { labels } from "./labels";

describe("labels.reason", () => {
  it("translates the reasons the app itself makes up", () => {
    expect(labels.reason("Waiting for you")).toBe("Đang chờ bạn");
    expect(labels.reason("Question")).toBe("Câu hỏi");
    expect(labels.reason("killed")).toBe("bị dừng");
    expect(labels.reason("exit code 3")).toBe("mã thoát 3");
    expect(labels.reason("unknown")).toBe("không rõ");
  });

  it("keeps tool names, paths and Claude Code's own text as they are", () => {
    expect(labels.reason("Edit src/main.rs")).toBe("Edit src/main.rs");
    expect(labels.reason("Bash npm install")).toBe("Bash npm install");
    expect(labels.reason("rate_limit")).toBe("rate_limit");
  });
});
