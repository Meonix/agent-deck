import type { SessionState } from "./api/sessions";

/** RULE-01's title for a session with no prompt yet; a data value the backend also sends. */
export const UNTITLED_DATA = "(untitled)";

const APP_REASONS: Record<string, string> = {
  "Waiting for you": "Đang chờ bạn",
  Question: "Câu hỏi",
  killed: "bị dừng",
  unknown: "không rõ",
};

const state: Record<SessionState, string> = {
  Running: "Đang chạy",
  "Needs Approval": "Cần duyệt",
  Idle: "Xong lượt",
  Error: "Lỗi",
  Ended: "Đã kết thúc",
};

/** Every label and message the app shows, in Vietnamese (SRS-NFR-008, SRS section 7 › Bảng nhãn). */
export const labels = {
  state,
  /** A session title as shown; "(untitled)" stays the data value everywhere else. */
  title: (title: string) => (title === UNTITLED_DATA ? "(chưa có tên)" : title),
  /** The status reasons the backend makes up itself (signal.rs, machine.rs); tool names and Claude Code's text pass through. */
  reason: (reason: string) => {
    const exit = /^exit code (-?\d+)$/.exec(reason);
    if (exit) return `mã thoát ${exit[1]}`;
    return APP_REASONS[reason] ?? reason;
  },

  sidebar: "Folder làm việc",
  showSidebar: "Hiện cột trái",
  hideSidebar: "Ẩn cột trái",
  folders: "Folder",
  addFolder: "Thêm folder",
  removeFolder: (name: string) => `Bỏ folder ${name}`,
  missing: "Không còn",
  folderStatus: (count: number, s: SessionState) => `${count} ${state[s]}`,
  activeSessions: "Phiên đang mở",
  activeCount: (n: number) => `Phiên đang mở (${n})`,
  noActiveSessions: "Không có phiên đang mở",
  stashedSessions: "Để dành",
  stashedCount: (n: number) => `Để dành (${n})`,
  noStashedSessions: "Chưa để dành phiên nào",
  unstash: (title: string) => `Bỏ ${title} khỏi Để dành`,
  unstashTip: "Bỏ khỏi Để dành",

  noFolders: "Chưa có folder nào",
  noFoldersHint: "Thêm folder bạn hay làm việc với Claude Code để mở phiên.",
  noPanes: "Chưa mở phiên nào",
  pickFolderHint: "Chọn một folder để xem các phiên của nó.",
  noPanesHint: "Mở lại một phiên cũ hoặc bắt đầu phiên mới.",
  newSession: "Phiên mới",

  sessionHistory: "Lịch sử phiên",
  closeHistory: "Đóng lịch sử phiên",
  loadingSessions: "Đang tải phiên",
  folderGone: "Folder này không còn trên máy.",
  sessionsFailed: "Không đọc được các phiên",
  unreadable: (n: number) => `${n} phiên không đọc được`,
  noSessions: "Chưa có phiên nào",
  live: "Đang mở",
  resume: "Mở lại",
  delete: "Xoá",
  select: (title: string) => `Chọn ${title}`,
  selectAll: "Chọn tất cả",
  deleteSelected: (n: number) => `Xoá đã chọn (${n})`,

  justNow: "vừa xong",
  minutesAgo: (n: number) => `${n} phút trước`,
  hoursAgo: (n: number) => `${n} giờ trước`,
  yesterday: "hôm qua",
  daysAgo: (n: number) => `${n} ngày trước`,
  lastWeek: "tuần trước",
  date: (day: number, month: number) => `${day}/${month}`,
  dateWithYear: (day: number, month: number, year: number) => `${day}/${month}/${year}`,

  notStarted: "Chưa khởi động",
  statusUnavailable: "Không theo dõi được trạng thái",
  othersBadge: (n: number) => `${n} phiên cần bạn`,
  othersBadgeText: (n: number) => `${n} cần bạn`,
  stashSession: "Để dành phiên",
  maximizePane: "Phóng to ô",
  restorePane: "Thu về ô",
  closePane: "Đóng ô",
  startFailed: "Không khởi động được Claude Code",
  startFailedHint: "Kiểm tra Claude Code đã được cài và có trong PATH.",
  sessionEnded: "Phiên đã kết thúc",

  shell: "Shell",
  openShell: "Mở shell",
  showShell: "Hiện shell",
  hideShell: "Ẩn shell",
  shellFailed: "Không khởi động được shell",
  dismiss: "Đóng thông báo",

  cancel: "Huỷ",
  close: "Đóng",
  stash: "Để dành",
  closeAndTrash: "Đóng và chuyển vào Thùng rác",
  closeAndMove: "Đóng và chuyển",
  moveToTrash: "Chuyển vào Thùng rác",
  closeTitle: (title: string) => `Đóng “${title}”?`,
  stashTitle: (title: string) => `Để dành “${title}”?`,
  trashTitle: (title: string) => `Chuyển “${title}” vào Thùng rác?`,
  closeAndTrashTitle: (title: string) => `Đóng “${title}” và chuyển vào Thùng rác?`,
  trashManyTitle: (n: number) => `Chuyển ${n} phiên vào Thùng rác?`,
  closeAndTrashManyTitle: (open: number, n: number) => `Đóng ${open} phiên đang mở và chuyển ${n} phiên vào Thùng rác?`,
  restoreHint: "Khôi phục được từ Thùng rác của hệ điều hành.",
  endsSession: "Phiên sẽ dừng và ô của nó sẽ đóng.",
  endsSessions: "Các phiên đó sẽ dừng và ô của chúng sẽ đóng.",
  sessionBusy: "Phiên vẫn đang chạy.",
  shellBusy: "Shell vẫn đang chạy một lệnh.",
  commandStops: "sẽ bị dừng.",
  shellCommandStops: "Lệnh trong shell sẽ bị dừng.",

  folderNotFound: "Không tìm thấy folder",
  closeOpenSessionsFirst: "Đóng các phiên đang mở của folder này trước",
  loadFoldersFailed: "Không tải được danh sách folder",
  addFolderFailed: "Không thêm được folder",
  removeFolderFailed: "Không bỏ được folder",
  openFailed: "Không mở được phiên",
  closeFailed: "Không đóng được phiên",
  reopenFailed: (n: number) => `${n} phiên không mở lại được`,
  deleteFailed: "Không xoá được phiên",
  deletedSome: (k: number, n: number) => `Đã xoá ${k}/${n} phiên`,
};
