---
req-doc: changelog
slug: agent-deck
---
# CHANGELOG — agent-deck

## CR-001 — Xoá phiên, phóng to ô, gộp Status Board vào cột Sessions
Ngày: 2026-10-17
Yêu cầu: "1. thêm giúp tôi nút xóa session chat đối với một folder cụ thể 2. trong cửa sổ chat của một session cụ thể, cho tôi một button dùng để phóng to cửa sổ đó thành fullsize, lắp đầy space của cả cửa sổ ứng dụng. 3. tôi nghĩ nên ghép Status board vào cột Sessions bên trái và cho nó theo dạng thông báo kiểu đổi màu background item + badget cho đỡ chiếm diện tích."
Status: Approved (2026-10-17)
Ảnh hưởng:
- Xoá phiên: đụng ràng buộc BRD mục 8 "Chỉ đọc dữ liệu phiên của Claude Code trên máy, không sửa dữ liệu đó" và SRS-NFR-005 (archived: add-session-history → /dev-update); SRS-FR-004 (archived: add-workspace-list) giữ nguyên nghĩa; chưa có BR cho xoá phiên.
- Phóng to ô: thêm FR mới dưới BR-05 (mục 2.5); liên quan SRS-FR-021, SRS-FR-023, SRS-FR-024 (archived: add-session-pane, add-pane-split-layout).
- Gộp Status Board: SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034 (archived: add-status-board → /dev-update), SRS-FR-037 (archived: add-status-card-jump), SRS-FR-038, SRS-FR-039 (archived: add-status-latency-report, mốc "hiện trên bảng"); BR-06, BR-07 ("một bảng", "từ bảng trạng thái"); BO-01 (chỉ số "hiện trên bảng trạng thái"); SRS mục 1 Thuật ngữ, mục 3 Status Change Record, mục 7 Màn hình.
- Spec/code: openspec/specs/status-board, status-latency, session-history, workspace-list; src/App.tsx, src/components/BoardColumn.tsx, statusBoard.ts, WorkspaceSidebar.tsx, useSessionPanes.ts, src-tauri/src/hooks.rs, pane_status.rs, status_latency.rs.
- Thiết kế: design/agent-deck/brief.md, stories/Wireframe.stories.js, stories/render.js → /ux-design-ui.
Trả lời của PO (2026-10-17):
- Xoá phiên = chuyển phiên vào Thùng rác của hệ điều hành (khôi phục được), không xoá vĩnh viễn.
- Xoá từng phiên một, nút trên mỗi dòng của Session List, hỏi xác nhận trước.
- Phiên đang mở trong ô: hỏi xác nhận, kết thúc phiên, đóng ô, rồi mới chuyển vào Thùng rác.
- Phóng to: ô che cả cột trái và các ô khác; các ô khác vẫn chạy; tiêu đề ô phóng to có badge đếm phiên khác đang `Needs Approval` / `Error`, bấm badge thì thu nhỏ và tới phiên đó.
- Phiên ở folder khác: dòng folder đổi màu nền theo trạng thái gấp nhất + badge đếm.
- Dòng phiên: tiêu đề + badge trạng thái; khi `Needs Approval` / `Error` thêm dòng phụ "giờ · lý do".

Diff đề xuất:

Phiên bản: BRD v1.0 → v2.0 (đổi chỉ số BO-01: "hiện trên bảng trạng thái" → "hiện dấu báo trạng thái"; ngưỡng ≤ 3 giây giữ nguyên). SRS v1.0 → v1.1.
SRS-ID dưới BO-01 (qua BR-05, BR-06, BR-07): SRS-FR-021, SRS-FR-022, SRS-FR-023, SRS-FR-024, SRS-FR-025, SRS-FR-026, SRS-FR-027, SRS-FR-028, SRS-FR-029, SRS-FR-030, SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-035, SRS-FR-036, SRS-FR-037, SRS-FR-038, SRS-FR-039, SRS-NFR-001, SRS-NFR-002, SRS-NFR-008. Trong đó chỉ SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-037, SRS-FR-038, SRS-FR-039 đổi chữ; còn lại giữ nguyên.

BRD:
- BO-01 chỉ số. Trước: "…đến lúc phiên đó hiện trên bảng trạng thái". Sau: "…đến lúc phiên đó hiện dấu báo trạng thái trong app (dòng phiên, dòng folder, hoặc badge của ô phóng to)".
- BR-05. Trước: "…chia ô ngang và dọc, thao tác đầy đủ như trong terminal thường". Sau: "…chia ô ngang và dọc, phóng to một ô ra cả cửa sổ, thao tác đầy đủ như trong terminal thường".
- BR-06. Trước: "Người dùng thấy trên một bảng phiên nào đang chạy, phiên nào cần duyệt, phiên nào lỗi". Sau: "Người dùng thấy ngay trên danh sách folder và danh sách phiên phiên nào đang chạy, phiên nào cần duyệt, phiên nào lỗi".
- BR-07. Trước: "Từ bảng trạng thái, người dùng chuyển thẳng tới ô của phiên đó". Sau: "Từ dấu báo trạng thái, người dùng chuyển thẳng tới ô của phiên đó".
- BR-08 mới: "Người dùng xoá một phiên cũ của folder bằng cách chuyển nó vào Thùng rác" · BO-02 · Should.
- Mục 8 ràng buộc. Trước: "Chỉ đọc dữ liệu phiên của Claude Code trên máy, không sửa dữ liệu đó." Sau: "Không sửa dữ liệu phiên của Claude Code trên máy; chỉ được chuyển cả một phiên vào Thùng rác khi người dùng chọn xoá phiên đó (BR-08)."
- Mục 1, mục 5, mục 7 bước 5–6, mục 11: "bảng trạng thái" → "dấu báo trạng thái ở cột trái".

SRS — đổi:
- Thuật ngữ: bỏ "Status Board"; thêm "Status Highlight — màu nền + badge trạng thái trên dòng phiên, dòng folder, và badge trên tiêu đề ô phóng to"; thêm "Maximized Pane — ô đang phóng to ra cả cửa sổ".
- SRS-FR-031 — Deleted (CR-001). Không còn bảng ba cột.
- SRS-FR-032. Trước: "…shall show a card for that session in the column of that state." Sau: "While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system shall show the Status Highlight of that state on the row of that session in the session list." Ví dụ: ô 1 `Running`, ô 2 `Needs Approval`, ô 3 `Idle`, cùng folder đang chọn → dòng 1 nền Running + badge "Running", dòng 2 nền Needs Approval + badge "Needs Approval", dòng 3 không tô. Ví dụ âm: `npm test` fail rồi Claude Code tự sửa tiếp → dòng vẫn Running (RULE-06).
- SRS-FR-033. Trước: "…show on each card the workspace name, the session title, the time the session entered its current state, and the reason of that state." Sau: "While a session row shows the Status Highlight of `Needs Approval` or `Error`, the system shall show below the session title the time the session entered that state and the reason of that state." Ví dụ: dòng "Scaffold Tauri app" badge "Needs Approval", dòng phụ "14:02 · Edit src/main.rs". Ví dụ âm: dòng `Running` → không có dòng phụ.
- SRS-FR-034. Trước: "…shall update the Status Board within 3 seconds." Sau: "When a session open in a pane changes state, the system shall update every Status Highlight of that session within 3 seconds."
- SRS-FR-037. Trước: "When the user clicks a card on the Status Board, …" Sau: "When the user clicks a session row that shows a Status Highlight, the system shall move keyboard focus to the pane of that session."
- SRS-FR-038. Trước: "…and the time the Status Board showed it." Sau: "…and the time the Status Highlight showed it."
- SRS-FR-039. Trước: "…that appeared on the Status Board within 3 seconds." Sau: "…whose Status Highlight appeared within 3 seconds."
- SRS-NFR-005. Trước: "The system shall not modify any Claude Code session history on the machine." Sau: "The system shall not modify any Claude Code session history on the machine other than moving a session the user deletes to the operating system's trash." Ví dụ âm: bỏ workspace, resume, đóng ô → không file nào bị sửa hay xoá.
- Mục 2.6, 2.7: viết lại luồng theo Status Highlight. Mục 3: Session "(chỉ đọc …)" → "(chỉ đọc, trừ xoá vào Thùng rác theo SRS-FR-047)"; Status Change Record "Lúc hiện trên bảng" → "Lúc hiện Status Highlight". Mục 7: bỏ dòng "Status Board"; Workspace List thêm SRS-FR-040; Session List thêm SRS-FR-032, SRS-FR-033, SRS-FR-037, SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050; Pane Grid thêm SRS-FR-041, SRS-FR-042, SRS-FR-043, SRS-FR-044, SRS-FR-045, SRS-FR-046. Mục 12 dựng lại bằng grep.

SRS — mới:
- SRS-FR-040 — Workspace status (BR-06, Test): "While at least one session of a workspace open in a pane is `Running`, `Needs Approval` or `Error`, the system shall show on that workspace's row the Status Highlight of its most urgent state and the number of its sessions in that state." Thứ tự gấp: `Error` > `Needs Approval` > `Running`. Ví dụ: `mokairo` có 1 phiên `Error`, 2 phiên `Running` → dòng `mokairo` nền Error, badge "1". Ví dụ âm: mọi phiên `Idle` → dòng không tô.
- SRS-FR-041 — Maximize pane (BR-05, Demo): "When the user chooses Maximize on a pane, the system shall show that pane over the whole application window below the title bar, covering the Workspace List, the session list and the other panes." Giải thích: các ô khác vẫn chạy, không kết thúc phiên nào. Ví dụ: 3 ô, phóng to ô 2 → chỉ thấy ô 2; ô 1 và ô 3 vẫn `Running`.
- SRS-FR-042 — Restore pane (BR-05, Demo): "When the user chooses Restore on the Maximized Pane, the system shall show the previous layout with the same pane sizes." Ví dụ: chia 30/70, phóng to rồi Restore → vẫn 30/70.
- SRS-FR-043 — Reflow on maximize (BR-05, Demo): "When a pane is maximized or restored, the system shall fit the session's terminal content to the new pane size." (theo SRS-FR-024)
- SRS-FR-044 — Maximized pane status badge (BR-06, Test): "While a pane is maximized and at least one other session open in a pane is `Needs Approval` or `Error`, the system shall show in the header of the Maximized Pane a badge with the number of those sessions." Badge màu `Error` nếu có ít nhất một phiên `Error`, còn lại màu `Needs Approval`. Ví dụ: phóng to ô 1, ô 3 sang `Needs Approval` lúc 14:02:00 → tiêu đề ô 1 có badge "1" trước 14:02:03. Ví dụ âm: các ô khác chỉ `Running` → không badge.
- SRS-FR-045 — Jump from the maximized badge (BR-07, Demo): "When the user clicks the status badge of the Maximized Pane, the system shall restore the layout and move keyboard focus to the pane of the most urgent other session." Gấp nhất: `Error` trước `Needs Approval`; cùng trạng thái thì phiên vào trạng thái sớm nhất.
- SRS-FR-046 — Restore before a new pane (BR-05, Test): "If a new pane opens while a pane is maximized, then the system shall restore the layout before placing the new pane." Ví dụ: đang phóng to ô 1, bấm Split Right trên ô 1 → bố cục cũ hiện lại, ô mới nằm bên phải ô 1.
- SRS-FR-047 — Delete a session (BR-08, Test): "When the user confirms deleting a session, the system shall move that session's history to the operating system's trash and remove the session from the session list." Ví dụ: xoá "Scaffold Tauri app" → dòng biến mất; khôi phục từ Trash rồi chọn lại folder → thấy lại phiên.
- SRS-FR-048 — Confirm deleting a session (BR-08, Test): "When the user chooses Delete on a session row, the system shall ask "Move "<title>" to Trash?" before deleting." Ví dụ âm: chọn Cancel → phiên vẫn còn, không file nào bị chuyển.
- SRS-FR-049 — Delete an open session (BR-08, Test): "If the user confirms deleting a session that is open in a pane, then the system shall end that session and close its pane before moving its history to the trash." Giải thích: câu xác nhận đổi thành "Close "<title>" and move it to Trash?". Ví dụ: phiên `Running` ở ô 2, xoá + đồng ý → ô 2 đóng, phiên kết thúc, rồi vào Thùng rác.
- SRS-FR-050 — Report delete failure (BR-08, Test): "If a session's history cannot be moved to the trash, then the system shall keep that session in the session list and show the message "Session could not be deleted"." Ví dụ âm: file bị khoá quyền ghi → phiên vẫn còn, hiện thông báo.

Backlog — thêm (áp sau GATE CR):
- 9 · Báo trạng thái ở cột trái thay Status Board · update-status-highlight · SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-037, SRS-FR-038, SRS-FR-039, SRS-FR-040 · phụ thuộc 3, 4, 8 · Must; đổi hành vi đã archived → /dev-update.
- 10 · Phóng to một ô · add-pane-maximize · SRS-FR-041, SRS-FR-042, SRS-FR-043, SRS-FR-044, SRS-FR-045, SRS-FR-046 · phụ thuộc 7, 9 · Should; badge dùng Status Highlight của mục 9.
- 11 · Xoá phiên vào Thùng rác · add-session-delete · SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050, SRS-NFR-005 · phụ thuộc 5 · Should.

Thiết kế: design/agent-deck/ (brief.md, Wireframe.stories.js, render.js) còn vẽ Status Board 3 cột → /ux-design-ui cập nhật wireframe trước khi code mục 9 và 10. Không sửa ở CR này.

Việc tiếp theo: /ux-design-ui (cột trái có Status Highlight, ô phóng to) → /dev-update add-status-board (mục 9) → /dev-feature add-pane-maximize (mục 10) → /dev-feature add-session-delete (mục 11).

## CR-002 — Tách "Active Sessions" ở cột trái, lịch sử phiên sang khung phải
Ngày: 2026-10-17
Yêu cầu: "1. update tính năng hiển thị "Sessions" sang tên là "Active Sessions" nghĩa là các Session đang chạy còn history thì sẽ hiển thị bên phải khi mà user chọn/click vào folder. 2. màu của section tôi nghĩ nên thêm màu hoặc border color để phân biệt 2 section khác nhau. 2 màu này tuyệt đối không dùng màu hight contrast"
Status: Approved (2026-10-17)
Ảnh hưởng:
- Lịch sử phiên: SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-NFR-003 (archived: add-session-history → /dev-update); "session list" đổi chỗ hiện.
- Dùng "session list": SRS-FR-013 (archived: add-session-resume), SRS-FR-019 (archived: add-session-pane), SRS-FR-032, SRS-FR-033, SRS-FR-037 (archived: update-status-highlight), SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050 (archived: add-session-delete).
- Phóng to: SRS-FR-041 "covering the Workspace List, the session list and the other panes" (archived: add-pane-maximize). Ghi chú: lần trước nói nhầm SRS-FR-043; SRS-FR-043 là reflow, không đổi.
- SRS mục 1 Thuật ngữ (Session History), mục 2.1 luồng chính bước 3, mục 2.2, mục 7 Màn hình. BRD: BR-06 ("danh sách phiên") → sửa chữ; BR-02 không nói vị trí → không đổi.
- Spec/code: openspec/specs/session-history, session-resume, pane-layout, status-board; src/App.tsx, src/components/WorkspaceSidebar.tsx, useSessionList.ts, sessionList.ts.
- Thiết kế: design/agent-deck/brief.md mục Cửa sổ chính, stories/WireframeCr001 → /ux-design-ui (màu hai section).
Trả lời của PO (2026-10-17):
- Active Sessions liệt kê phiên đang mở trong ô của mọi folder, mỗi dòng ghi tên folder.
- Lịch sử phiên hiện ở một cột riêng giữa cột trái và các ô (các ô hẹp lại, terminal fit lại); đóng bằng nút × hoặc bấm lại folder đang chọn.
- Active Sessions giữ trạng thái: Status Highlight, dòng phụ "giờ · lý do", bấm dòng bất kỳ để tới ô. Khung lịch sử giữ quản lý: New Session, Resume, Delete, nhãn `Live`, không tô trạng thái.
- Active Sessions xếp gấp trước (`Error` > `Needs Approval` > `Running` > `Idle` > `Ended`), cùng trạng thái thì phiên vào trạng thái sớm nhất ở trên; rỗng → "No active sessions".
- Hai section có màu là Folders và Active Sessions ở cột trái. Ngưỡng: nền mỗi section so với nền cột trái ≤ 1.25:1, chữ trên nền đó ≥ 4.5:1, cả light và dark.

Diff đề xuất:

Phiên bản: BRD v2.0 → v2.1 (sửa BR-06; không đụng BO). SRS v1.1 → v1.2.

BRD:
- BR-06. Trước: "Người dùng thấy ngay trên danh sách folder và danh sách phiên phiên nào đang chạy, phiên nào cần duyệt, phiên nào lỗi". Sau: "Người dùng thấy ngay trên danh sách folder và danh sách phiên đang mở phiên nào đang chạy, phiên nào cần duyệt, phiên nào lỗi".

SRS — đổi:
- Thuật ngữ: thêm "Active Sessions — section ở cột trái, liệt kê mọi phiên đang mở trong ô của mọi workspace"; thêm "Session History Panel — cột nằm giữa cột trái và các ô, hiện Session History của workspace đang chọn"; Status Highlight "trên dòng phiên…" → "trên dòng của Active Sessions…".
- Mục 2.1 luồng chính bước 3. Trước: "lịch sử phiên của nó hiện ra (2.2)". Sau: "Session History Panel mở ra với lịch sử phiên của nó (2.2)".
- Mục 2.2 luồng: bước 2 "liệt kê trong Session History Panel"; thêm A3 người dùng đóng khung → SRS-FR-054.
- SRS-FR-007. Trước: "When the user selects a workspace, the system shall list every Claude Code session that belongs to that workspace per RULE-02." Sau: "When the user selects a workspace, the system shall open the Session History Panel listing every Claude Code session that belongs to that workspace per RULE-02." Ví dụ: chọn `agent-deck` có 3 phiên → khung bên phải cột trái mở, 3 dòng; các ô hẹp lại, terminal fit theo SRS-FR-024.
- SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-013, SRS-FR-019, SRS-FR-047, SRS-FR-050, SRS-NFR-003: "the session list" → "the Session History Panel"; nghĩa khác giữ nguyên.
- SRS-FR-012 thêm Ví dụ âm: dòng `Live` trong Session History Panel không có Status Highlight.
- SRS-FR-048. Trước: "When the user chooses Delete on a session row, …". Sau: "When the user chooses Delete on a row of the Session History Panel, …".
- SRS-FR-032. Trước: "…on the row of that session in the session list." Sau: "…on the row of that session in Active Sessions." Ví dụ: `agent-deck` ô 1 `Running`, `mokairo` ô 2 `Needs Approval`, ô 3 `Idle` → dòng ô 2 nền Needs Approval, dòng ô 1 nền Running, dòng ô 3 không tô, bất kể folder nào đang chọn.
- SRS-FR-037. Trước: "When the user clicks a session row that shows a Status Highlight, …". Sau: "When the user clicks a row in Active Sessions, the system shall move keyboard focus to the pane of that session." Tên: "Jump to pane from Active Sessions". Ví dụ âm mới: bấm dòng `Idle` → vẫn tới ô đó.
- SRS-FR-041. Trước: "…covering the Workspace List, the session list and the other panes." Sau: "…covering the Workspace List, Active Sessions, the Session History Panel and the other panes."
- Mục 2.6 bước 3, mục 2.7 bước 1, mục 2.9 bước 1: theo tên mới. Mục 7: "Session List" tách thành "Active Sessions" (SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-037, SRS-FR-038, SRS-FR-051, SRS-FR-052, SRS-FR-053, SRS-NFR-009) và "Session History Panel" (SRS-FR-007 … SRS-FR-013, SRS-FR-016, SRS-FR-018, SRS-FR-019, SRS-FR-020, SRS-FR-047 … SRS-FR-050, SRS-FR-054, SRS-NFR-003); Workspace List thêm SRS-NFR-009. Mục 11: SRS-FR-001 đến SRS-FR-054, SRS-NFR-001 đến SRS-NFR-009. Mục 12 dựng lại bằng grep.
- SRS-FR-033, SRS-FR-040, SRS-FR-043, SRS-FR-044: không đổi.

SRS — mới:
- SRS-FR-051 — List active sessions (BR-06, Test): "The system shall list in Active Sessions every session open in a pane across all workspaces, with its title and its workspace name." Ví dụ: `agent-deck` có 1 ô, `mokairo` có 1 ô → Active Sessions 2 dòng "Scaffold Tauri app · agent-deck", "Fix login bug · mokairo". Ví dụ âm: phiên cũ không mở trong ô → không có trong Active Sessions.
- SRS-FR-052 — Order active sessions (BR-06, Test): "The system shall order Active Sessions by state urgency, `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, and within one state by the time the session entered that state, earliest first." Ví dụ: ô 1 `Running` từ 14:00, ô 2 `Error` từ 14:05, ô 3 `Needs Approval` từ 14:03 → thứ tự ô 2, ô 3, ô 1.
- SRS-FR-053 — Empty active sessions (BR-06, Test): "While no session is open in a pane, the system shall show the message "No active sessions" in Active Sessions." Ví dụ âm: mở app, chưa mở ô nào → hiện "No active sessions".
- SRS-FR-054 — Close the Session History Panel (BR-02, Test): "When the user chooses Close on the Session History Panel or clicks the selected workspace again, the system shall hide the Session History Panel." Giải thích: các ô rộng ra, terminal fit lại (SRS-FR-024); bấm folder lần nữa thì mở lại (SRS-FR-007). Ví dụ: khung `agent-deck` đang mở, bấm lại `agent-deck` → khung đóng.
- SRS-NFR-009 — Sidebar section tints (BR-06, Analysis): "The system shall give the Workspace List section and the Active Sessions section two different background tints, each with a contrast ratio of at most 1.25:1 against the sidebar background and a text contrast of at least 4.5:1, in both light and dark themes." Ví dụ âm: nền section 1.6:1 so với nền cột trái → không đạt.

Backlog — thêm (áp sau GATE CR):
- 12 · Tách Active Sessions ở cột trái, lịch sử phiên sang khung phải · update-active-sessions · SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-013, SRS-FR-019, SRS-FR-032, SRS-FR-037, SRS-FR-041, SRS-FR-047, SRS-FR-048, SRS-FR-050, SRS-FR-051, SRS-FR-052, SRS-FR-053, SRS-FR-054, SRS-NFR-003, SRS-NFR-009 · phụ thuộc 5, 6, 9, 10, 11 · Should; CR-002, đổi hành vi đã archived của mục 5, 6, 9, 10, 11 → /dev-update.

Thiết kế: design/agent-deck/brief.md, stories (wireframe cột trái + Session History Panel, hai tint) → /ux-design-ui. Không sửa ở CR này.

Việc tiếp theo: /ux-design-ui (Active Sessions, Session History Panel, hai tint) → /dev-update add-session-history (mục 12).

## CR-003 — Terminal phụ dưới mỗi ô phiên
Ngày: 2026-10-17
Yêu cầu: "thêm một nút trên các session window mục đích dùng để mở thêm một cửa sổ chạy terminal (không chạy claude) bên dưới, cửa sổ này có thể ẩn đi để chạy ngầm."
Status: Approved (2026-10-17)
Ảnh hưởng:
- BR-05 (chưa có terminal không chạy Claude Code); SRS mục 1 Thuật ngữ "Pane — chạy đúng một phiên", mục 2.5, mục 3 Pane, mục 7 Pane Grid, mục 10 "Claude Code là agent duy nhất" (shell không phải agent, giữ nguyên).
- SRS-FR-029 "Close pane ends its session", giải thích "không để phiên chạy ngầm không ai thấy" (archived: add-session-pane → /dev-update nếu đổi nghĩa); SRS-FR-027 xác nhận đóng ô bận; SRS-FR-030 tiêu đề ô; SRS-FR-024, SRS-FR-041, SRS-FR-043 (fit lại khi ô đổi khổ / phóng to); SRS-NFR-001 số ô chạy cùng lúc.
- Spec/code: openspec/specs/session-pane, pane-layout; src/components/TerminalPane.tsx, PaneGrid.tsx, useSessionPanes.ts, paneTree.ts; src-tauri/src/pty/, panes.rs, pane_commands.rs, launcher.rs.
- Thiết kế: design/agent-deck/design.html, brief.md (tiêu đề ô, khu terminal phụ) → /ux-design-ui.
Trả lời của PO (2026-10-17):
- Terminal phụ gắn với ô: ẩn thì nút Shell trên tiêu đề ô có chấm báo đang chạy; đóng ô thì kết thúc luôn shell, hỏi xác nhận nếu shell đang chạy một lệnh. SRS-FR-029 giữ nguyên nghĩa, thêm FR mới cho shell.
- Mỗi ô tối đa 1 terminal phụ, nằm dưới phiên Claude Code trong cùng ô, mặc định cao 30% ô, có vách kéo đổi chiều cao; bấm nút lần nữa thì ẩn/hiện.
- Shell mặc định của máy (macOS: shell đăng nhập của người dùng; Windows: PowerShell), mở ở folder của workspace. Phiên Claude Code kết thúc thì shell vẫn chạy tới khi đóng ô. Shell tự thoát thì khu terminal phụ đóng; bấm nút lại thì mở shell mới.

Diff đề xuất:

Phiên bản: BRD v2.1 → v2.2 (sửa BR-05; không đụng BO). SRS v1.2 → v1.3.

BRD:
- BR-05. Trước: "…chia ô ngang và dọc, phóng to một ô ra cả cửa sổ, thao tác đầy đủ như trong terminal thường". Sau: "…chia ô ngang và dọc, phóng to một ô ra cả cửa sổ, mở một terminal thường dưới phiên trong cùng ô và ẩn nó đi mà vẫn chạy, thao tác đầy đủ như trong terminal thường".
- Mục 5 Trong phạm vi: thêm "Một terminal thường (không chạy Claude Code) dưới mỗi phiên, ẩn đi được mà vẫn chạy."
- Mục 13 log phỏng vấn: thêm dòng CR-003.

SRS — đổi:
- Thuật ngữ. Pane trước: "Một ô trong cửa sổ, chạy đúng một phiên". Sau: "Một ô trong cửa sổ, chạy đúng một phiên, kèm tối đa một Pane Shell". Thêm "Pane Shell — terminal chạy shell mặc định của hệ điều hành (không chạy Claude Code), nằm dưới phiên trong cùng ô; không có trạng thái, không có trong Active Sessions".
- Mục 2.10 mới "Terminal phụ trong ô": luồng chính 1. bấm Shell trên tiêu đề ô → SRS-FR-055; 2. gõ lệnh; 3. bấm Shell để ẩn → SRS-FR-056, SRS-FR-058; 4. bấm lại để hiện → SRS-FR-057. A1 kéo vách → SRS-FR-059, SRS-FR-060; A2 gõ `exit` → SRS-FR-061; A3 phiên Claude Code kết thúc → SRS-FR-064; E1 đóng ô khi shell đang chạy lệnh → SRS-FR-063; E2 shell không khởi động được → SRS-FR-065.
- Mục 3 Pane: thêm trường "Pane Shell · có/không, ẩn/hiện, chiều cao · Không bắt buộc · Tối đa một mỗi ô (SRS-FR-055); không giữ lại giữa các lần mở app".
- Mục 6: thêm dòng "Shell mặc định của hệ điều hành · Nhận phím, trả nội dung hiển thị · Khi mở Pane Shell (SRS-FR-055) · Không khởi động được → SRS-FR-065".
- Mục 7 Pane Grid: thêm SRS-FR-055, SRS-FR-056, SRS-FR-057, SRS-FR-058, SRS-FR-059, SRS-FR-060, SRS-FR-061, SRS-FR-062, SRS-FR-063, SRS-FR-064, SRS-FR-065. Mục 11: SRS-FR-001 đến SRS-FR-065. Mục 12 dựng lại bằng grep.
- SRS-FR-027, SRS-FR-029, SRS-FR-030, SRS-FR-041, SRS-NFR-001: không đổi chữ (SRS-FR-029 vẫn chỉ nói phiên Claude Code; shell có FR riêng SRS-FR-062).

SRS — mới (mọi FR Nguồn: BR-05, Ưu tiên: Should):
- SRS-FR-055 — Open the pane shell (Demo): "When the user chooses Shell on a pane that has no Pane Shell, the system shall open a Pane Shell below the session in that pane, running the operating system's default shell in the workspace folder." Giải thích: mặc định cao 30% ô; phiên Claude Code chiếm phần còn lại. Ví dụ: ô "agent-deck · Scaffold Tauri app", bấm Shell → khu dưới hiện prompt ở folder `agent-deck`, gõ `pwd` ra đường dẫn folder đó.
- SRS-FR-056 — Hide the pane shell (Test): "When the user chooses Shell on a pane whose Pane Shell is visible, the system shall hide the Pane Shell and keep its process running." Ví dụ: shell đang chạy `npm run dev`, bấm Shell → khu dưới biến mất, phiên Claude Code chiếm cả ô, server vẫn trả lời ở `localhost:1420`.
- SRS-FR-057 — Show the pane shell again (Demo): "When the user chooses Shell on a pane whose Pane Shell is hidden, the system shall show the Pane Shell with its previous output and height." Ví dụ: ẩn lúc cao 40% ô, bấm lại → hiện cao 40%, thấy log `npm run dev` in ra trong lúc ẩn.
- SRS-FR-058 — Hidden shell marker (Test): "While a pane's Pane Shell is hidden, the system shall show a running marker on that pane's Shell button." Giải thích: thay cho lời giải thích của SRS-FR-029, shell ẩn vẫn có người thấy. Ví dụ âm: ô chưa mở shell, hoặc shell đang hiện → nút Shell không có chấm.
- SRS-FR-059 — Resize the pane shell (Demo): "When the user drags the divider between the session and the Pane Shell, the system shall resize both to follow the divider." Ví dụ: kéo vách lên 100 px → shell cao thêm, phần Claude Code thấp đi tương ứng.
- SRS-FR-060 — Reflow the pane shell (Demo): "When the Pane Shell changes size, the system shall fit the Pane Shell's content to its new size." Giải thích: gồm kéo vách, đổi khổ ô (SRS-FR-023), phóng to/thu về (SRS-FR-041, SRS-FR-042); phần phiên Claude Code vẫn theo SRS-FR-024. Ví dụ: phóng to ô đang hiện shell chạy `htop` → `htop` vẽ lại vừa khổ mới.
- SRS-FR-061 — Shell exits (Test): "When the Pane Shell's process exits, the system shall close the Pane Shell." Ví dụ: gõ `exit` → khu dưới đóng, phiên Claude Code chiếm cả ô, nút Shell không chấm; bấm Shell lại → shell mới, không còn nội dung cũ.
- SRS-FR-062 — Close pane ends its shell (Test): "When the user closes a pane, the system shall end the Pane Shell process of that pane." Giải thích: đúng cả khi shell đang ẩn; cũng áp khi ô đóng vì xoá phiên (SRS-FR-049). Ví dụ: shell ẩn chạy `npm run dev`, đóng ô và xác nhận → `localhost:1420` ngừng trả lời.
- SRS-FR-063 — Confirm closing a pane with a busy shell (Test): "If the user closes a pane whose Pane Shell is running a command, then the system shall ask for confirmation before closing that pane." Giải thích: "đang chạy một lệnh" = shell không đứng ở dấu nhắc chờ lệnh. Ô vừa bận theo SRS-FR-027 vừa có shell bận → chỉ một hộp xác nhận. Ví dụ: phiên `Idle`, shell ẩn chạy `npm run dev`, bấm đóng → hộp "A command is still running in the shell. Close anyway?"; chọn Cancel → ô và shell vẫn chạy. Ví dụ âm: shell đứng ở dấu nhắc, phiên `Idle` → đóng không hỏi.
- SRS-FR-064 — Shell outlives the session (Test): "While the session in a pane has ended, the system shall keep that pane's Pane Shell running." Ví dụ: gõ `/exit` trong Claude Code → phần trên hiện "Session ended" (SRS-FR-028), shell vẫn chạy `npm run dev`.
- SRS-FR-065 — Report shell start failure (Test): "If the Pane Shell cannot start, then the system shall show the message "Shell could not start" in that pane and keep the session running." Ví dụ âm: shell mặc định không chạy được → ô hiện thông báo, phiên Claude Code vẫn `Running`, nút Shell không chấm.

Ngoài phạm vi CR này: nhiều shell / tab shell trong một ô; giữ shell hay nội dung shell qua lần mở app; trạng thái hay Status Highlight cho shell; chọn shell khác shell mặc định.

Backlog — thêm (áp sau GATE CR):
- 13 · Terminal phụ dưới mỗi ô · add-pane-shell · SRS-FR-055, SRS-FR-056, SRS-FR-057, SRS-FR-058, SRS-FR-059, SRS-FR-060, SRS-FR-061, SRS-FR-062, SRS-FR-063, SRS-FR-064, SRS-FR-065 · phụ thuộc 7, 10 · Should; CR-003; chỉ thêm FR mới, không đổi hành vi đã archived → /dev-feature.

Thiết kế: design/agent-deck/design.html chưa có nút Shell và khu shell trong ô → /ux-design-ui bổ sung trước khi code mục 13. Không sửa ở CR này.

Việc tiếp theo: /ux-design-ui (nút Shell + chấm, khu shell + vách kéo) → /dev-feature add-pane-shell (mục 13).
