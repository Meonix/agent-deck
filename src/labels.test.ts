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

describe("Folder Tree labels (CR-016)", () => {
  it("names the tree groups, the Folder Menu and the chevron in Vietnamese", () => {
    expect(labels.otherFolders(2)).toBe("Folder khác (2)");
    expect(labels.stashedCount(1)).toBe("Để dành (1)");
    expect(labels.viewFiles).toBe("Xem file");
    expect(labels.copyPath).toBe("Chép đường dẫn");
    expect(labels.copyPathFailed).toBe("Không chép được đường dẫn");
    expect(labels.removeFolder).toBe("Bỏ folder");
    expect(labels.addFolder).toBe("Thêm folder");
    expect(labels.folderMenu("mokairo")).toBe("Tuỳ chọn folder mokairo");
    expect(labels.collapse("mokairo")).toBe("Thu gọn mokairo");
    expect(labels.expand("mokairo")).toBe("Mở mokairo");
    expect(labels.folderCount(2, "Error")).toBe("2 phiên lỗi");
    expect(labels.folderCount(2, "Needs Approval")).toBe("2 phiên cần duyệt");
    expect(labels.folderCount(3, "grey")).toBe("3 phiên đang mở");
  });
});

describe("Session Chooser labels (CR-016)", () => {
  it("names the chooser parts and the + and trash icons in Vietnamese", () => {
    expect(labels.oldSessions).toBe("Mở lại phiên cũ");
    expect(labels.openChooser("agent-deck")).toBe("Mở phiên của agent-deck");
    expect(labels.deleteSession("Scaffold Tauri app")).toBe("Xoá Scaffold Tauri app");
    expect(labels.noPanesHint).toBe("Bấm + trên dòng folder để mở phiên mới hoặc mở lại phiên cũ.");
  });
});
