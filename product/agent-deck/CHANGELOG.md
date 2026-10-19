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

## CR-004 — Nhấp đúp phóng to ô, phóng/thu cỡ chữ, xoá nhiều phiên cùng lúc
Ngày: 2026-10-18
Yêu cầu: "1. khi double click vào sesions chat thì nó sẽ tự mở rộng cửa sổ ra full màng hình, tương tự như nút phóng to hiện tại 2. với phần text size của tất cả các text trong màng hình tôi cũng muốn có thể cho phép phóng to hay thu nhỏ bằng tổ hợp phím tắt "Crtl +" và "Crtl -" 3. cho phép user tick chọn nhiều sesion cũ trong history để chọn cho mục đích xóa (chức năng xóa history session hàng loạt)." — gộp cả 3 vào một CR.
Status: Approved (2026-10-18)
Ảnh hưởng:
- Nhấp đúp phóng to: BR-05 đã có "phóng to một ô ra cả cửa sổ", không đổi chữ; SRS-FR-041, SRS-FR-042, SRS-FR-043 (archived: add-pane-maximize) giữ nguyên nghĩa, FR mới gọi lại chúng; SRS-FR-025 (nhấp đúp trong terminal để bôi đen một từ) phải giữ nguyên; SRS-FR-030 tiêu đề ô.
- Cỡ chữ: chưa có BR, BR-05 gần nhất (làm việc trong một cửa sổ, thao tác như terminal thường); SRS-FR-024 fit terminal theo khổ ô (trigger khác, cần FR riêng); SRS-NFR-009 tương phản không đổi; SRS mục 3 chưa có dữ liệu cài đặt app.
- Xoá nhiều phiên: BR-08 "xoá một phiên cũ", log phỏng vấn BRD 2026-10-17 "từng phiên một"; SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050 (archived: add-session-delete, update-active-sessions) giữ nguyên nghĩa; SRS-NFR-005 giữ nguyên chữ.
- Spec/code: openspec/specs/pane-layout, session-history, app-shell; src/components/PaneGrid.tsx, TerminalPane.tsx, PaneShell.tsx, xtermAdapter.ts, SessionHistoryPanel.tsx, App.tsx, src/index.css; src/api/sessions.ts; src-tauri/src/session_trash.rs.
- Thiết kế: design/agent-deck/design.html chưa có checkbox trên dòng history và thanh "Delete selected" → /ux-design-ui. Nhấp đúp và cỡ chữ không cần thiết kế mới.
Trả lời của PO (2026-10-18):
- Nhấp đúp chỉ trên tiêu đề ô, bật/tắt: ô thường → phóng to; ô đang phóng to → thu về. Vùng terminal vẫn nhấp đúp để bôi đen một từ.
- Phím tắt: macOS Cmd, Windows Ctrl (Cmd/Ctrl + to, − nhỏ, 0 về 100%). Ctrl trên macOS vẫn tới terminal.
- Cỡ chữ: mỗi lần ±10%, từ 50% tới 200%, mặc định 100%; giữ lại giữa các lần mở app; áp cho mọi chữ trong cửa sổ (cột trái, Session History Panel, tiêu đề ô, terminal phiên, Pane Shell).
- Xoá nhiều: checkbox trên mỗi dòng history; tick ≥ 1 thì hiện "Delete selected (n)" và "Select all"; một hộp xác nhận cho cả nhóm; phiên đang mở thì đóng ô trước; phiên nào không chuyển được thì giữ lại và báo "k of n sessions deleted"; đổi folder hoặc đóng khung thì bỏ chọn. Nút Delete trên từng dòng giữ nguyên.

Diff đề xuất:

Phiên bản: BRD v2.2 → v2.3 (sửa BR-05, BR-08; không đụng BO). SRS v1.3 → v1.4.

BRD:
- BR-05. Trước: "…mở một terminal thường dưới phiên trong cùng ô và ẩn nó đi mà vẫn chạy, thao tác đầy đủ như trong terminal thường". Sau: "…mở một terminal thường dưới phiên trong cùng ô và ẩn nó đi mà vẫn chạy, phóng to hoặc thu nhỏ cỡ chữ của cả cửa sổ bằng phím tắt, thao tác đầy đủ như trong terminal thường".
- BR-08. Trước: "Người dùng xoá một phiên cũ của folder bằng cách chuyển nó vào Thùng rác". Sau: "Người dùng xoá một hoặc nhiều phiên cũ của folder cùng lúc bằng cách chuyển chúng vào Thùng rác".
- Mục 5 Trong phạm vi: "Xoá phiên cũ vào Thùng rác." → "Xoá một hoặc nhiều phiên cũ vào Thùng rác."; thêm "Phóng to, thu nhỏ cỡ chữ của cả cửa sổ bằng phím tắt."
- Mục 13 log phỏng vấn: thêm dòng CR-004 (dòng 2026-10-17 "từng phiên một" giữ nguyên, là lịch sử).

SRS — đổi:
- Thuật ngữ thêm: "Text Size — tỉ lệ cỡ của mọi chữ trong cửa sổ so với mặc định, từ 50% đến 200%, mặc định 100%". "Zoom shortcut — macOS: Cmd + (hoặc Cmd =) để to, Cmd − để nhỏ, Cmd 0 về 100%; Windows: Ctrl thay cho Cmd". "Session Selection — các phiên đang được tick trong Session History Panel".
- Mục 2.5: thêm A5 nhấp đúp tiêu đề ô để phóng to / thu về → SRS-FR-066, SRS-FR-067.
- Mục 2.9: thêm A3 tick nhiều dòng rồi chọn "Delete selected" → SRS-FR-073 … SRS-FR-079; luồng chính một phiên giữ nguyên.
- Mục 2.11 mới "Cỡ chữ": luồng chính 1. người dùng bấm Zoom shortcut to/nhỏ → SRS-FR-068, SRS-FR-069; 2. mọi chữ đổi cỡ, terminal fit lại → SRS-FR-072; 3. mở lại app vẫn cỡ đó → SRS-FR-071. A1 về 100% → SRS-FR-070. E1 đã tới 200% hoặc 50% → giữ nguyên (Ví dụ âm của SRS-FR-068, SRS-FR-069).
- Mục 3: thêm thực thể "App settings": trường "Text Size · Có · 50%–200%, bước 10%; giữ lại giữa các lần mở app (SRS-FR-071)". Session History Panel: Session Selection không giữ khi đổi workspace, đóng khung (SRS-FR-076) hay mở lại app.
- Mục 7: Pane Grid thêm SRS-FR-066, SRS-FR-067, SRS-FR-072; Session History Panel thêm SRS-FR-073, SRS-FR-074, SRS-FR-075, SRS-FR-076, SRS-FR-077, SRS-FR-078, SRS-FR-079; thêm dòng "Cửa sổ chính · toàn cửa sổ | Phóng to, thu nhỏ, về mặc định cỡ chữ | SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071". Mục 11: SRS-FR-001 đến SRS-FR-079. Mục 12 dựng lại bằng grep. Mục 1 Mục đích: BRD v2.3.
- SRS-FR-025, SRS-FR-041, SRS-FR-042, SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050, SRS-NFR-005: không đổi chữ.

SRS — mới:
- SRS-FR-066 — Maximize on header double-click (BR-05, Should, Test): "When the user double-clicks the header of a pane that is not maximized, the system shall maximize that pane as in SRS-FR-041." Ví dụ: 3 ô, nhấp đúp tiêu đề ô 2 → chỉ thấy ô 2, giống bấm Maximize. Ví dụ âm: nhấp đúp lên một từ trong vùng terminal → từ đó được bôi đen, ô không phóng to (SRS-FR-025); nhấp đúp lên nút trên tiêu đề (Shell, đóng) → chỉ làm việc của nút đó.
- SRS-FR-067 — Restore on header double-click (BR-05, Should, Test): "When the user double-clicks the header of the Maximized Pane, the system shall restore the previous layout as in SRS-FR-042." Ví dụ: hai ô 30/70, nhấp đúp tiêu đề ô 1 → phóng to; nhấp đúp lần nữa → lại 30/70.
- SRS-FR-068 — Increase text size (BR-05, Should, Test): "When the user presses the Zoom shortcut to enlarge, the system shall increase the Text Size by 10 percentage points, up to 200%." Giải thích: áp cho mọi chữ trong cửa sổ: Workspace List, Active Sessions, Session History Panel, tiêu đề ô, terminal phiên, Pane Shell, hộp thoại; phím tắt chạy cả khi focus đang ở ô, ô không nhận phím đó. Ví dụ: Text Size 100%, Cmd + hai lần → 120%, chữ cột trái và chữ trong ô cùng to ra. Ví dụ âm: Text Size 200%, Cmd + → vẫn 200%. Ví dụ âm: macOS, Ctrl − trong ô → Claude Code nhận phím, Text Size không đổi.
- SRS-FR-069 — Decrease text size (BR-05, Should, Test): "When the user presses the Zoom shortcut to shrink, the system shall decrease the Text Size by 10 percentage points, down to 50%." Ví dụ: 100%, Cmd − → 90%. Ví dụ âm: 50%, Cmd − → vẫn 50%.
- SRS-FR-070 — Reset text size (BR-05, Should, Test): "When the user presses the Zoom shortcut to reset, the system shall set the Text Size to 100%." Ví dụ: 150%, Cmd 0 → 100%.
- SRS-FR-071 — Persist text size (BR-05, Should, Test): "The system shall keep the Text Size between application launches." Ví dụ: đặt 130%, thoát app, mở lại → 130%.
- SRS-FR-072 — Reflow on text size change (BR-05, Should, Demo): "When the Text Size changes, the system shall fit the content of every session terminal and Pane Shell to its pane at the new Text Size." Giải thích: như SRS-FR-024, khổ ô không đổi nhưng số cột/dòng đổi. Ví dụ: 2 ô, Cmd + → khung nhập của Claude Code ở cả 2 ô vẽ lại vừa ô, không vỡ dòng.
- SRS-FR-073 — Select a session (BR-08, Should, Test): "When the user ticks the checkbox of a row in the Session History Panel, the system shall add that session to the Session Selection." Giải thích: bỏ tick thì bỏ khỏi Session Selection; tick không mở phiên. Ví dụ: tick "Scaffold Tauri app" và "Fix login bug" → Session Selection có 2 phiên. Ví dụ âm: tick một dòng → không mở ô nào.
- SRS-FR-074 — Delete selected action (BR-08, Should, Test): "While the Session Selection is not empty, the system shall show the action "Delete selected (<n>)" and the action "Select all" in the Session History Panel, where <n> is the number of selected sessions." Ví dụ: tick 2 dòng → "Delete selected (2)". Ví dụ âm: bỏ tick hết → hai nút ẩn.
- SRS-FR-075 — Select all sessions (BR-08, Should, Test): "When the user chooses Select all, the system shall add every session listed in the Session History Panel to the Session Selection." Ví dụ: folder 5 phiên, đã tick 1, chọn Select all → "Delete selected (5)".
- SRS-FR-076 — Clear the selection (BR-08, Should, Test): "When the Session History Panel switches to another workspace or closes, the system shall empty the Session Selection." Ví dụ: tick 2 phiên ở `agent-deck`, chọn `mokairo` rồi quay lại `agent-deck` → không dòng nào được tick.
- SRS-FR-077 — Confirm deleting selected sessions (BR-08, Should, Test): "When the user chooses Delete selected, the system shall ask "Move <n> sessions to Trash?" before deleting." Giải thích: có <k> phiên đang mở trong ô thì câu là "Close <k> open sessions and move <n> sessions to Trash?". Ví dụ: 3 phiên, 1 đang mở → "Close 1 open sessions and move 3 sessions to Trash?". Ví dụ âm: chọn Cancel → không phiên nào bị chuyển, Session Selection giữ nguyên.
- SRS-FR-078 — Delete selected sessions (BR-08, Should, Test): "When the user confirms deleting the selected sessions, the system shall delete each selected session as in SRS-FR-047 and SRS-FR-049." Ví dụ: 3 phiên, 1 đang `Running` ở ô 2 → ô 2 đóng, cả 3 vào Thùng rác, 3 dòng biến mất, Session Selection rỗng.
- SRS-FR-079 — Report partial delete failure (BR-08, Should, Test): "If some selected sessions cannot be moved to the trash, then the system shall keep those sessions in the Session History Panel and in the Session Selection and show the message "<k> of <n> sessions deleted"." Giải thích: thay cho thông báo của SRS-FR-050 khi xoá nhiều. Ví dụ âm: 3 phiên, 1 file bị khoá quyền ghi → 2 dòng biến mất, dòng còn lại vẫn được tick, hiện "2 of 3 sessions deleted".

Ngoài phạm vi CR này: Shift-click chọn một dải dòng; chọn phiên ở nhiều folder cùng lúc; khôi phục từ Thùng rác trong app; cỡ chữ riêng cho từng ô; chỉnh cỡ chữ qua menu hay thanh trượt; nhấp đúp ở chỗ khác ngoài tiêu đề ô.

Backlog — thêm (áp sau GATE CR):
- 14 · Nhấp đúp tiêu đề ô để phóng to / thu về · add-pane-header-double-click · SRS-FR-066, SRS-FR-067 · phụ thuộc 10 · Should; CR-004; chỉ thêm FR mới → /dev-feature.
- 15 · Phóng to, thu nhỏ cỡ chữ cả cửa sổ bằng phím tắt · add-text-zoom · SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071, SRS-FR-072 · phụ thuộc 2, 13 · Should; CR-004; chỉ thêm FR mới → /dev-feature.
- 16 · Tick chọn và xoá nhiều phiên cùng lúc · add-bulk-session-delete · SRS-FR-073, SRS-FR-074, SRS-FR-075, SRS-FR-076, SRS-FR-077, SRS-FR-078, SRS-FR-079 · phụ thuộc 11, 12 · Should; CR-004; chỉ thêm FR mới → /dev-feature; checkbox và thanh "Delete selected" theo /ux-design-ui.

Thiết kế: design/agent-deck/design.html chưa có checkbox dòng history và thanh "Delete selected" → /ux-design-ui bổ sung trước khi code mục 16. Không sửa ở CR này.

Việc tiếp theo: /dev-feature add-pane-header-double-click (mục 14) → /dev-feature add-text-zoom (mục 15) → /ux-design-ui (checkbox + Delete selected) → /dev-feature add-bulk-session-delete (mục 16).

## CR-005 — Mở lại các ô khi mở app, kéo thả ô để đặt vị trí, `/exit` thì đóng ô
Ngày: 2026-10-19
Yêu cầu: "1. khi tắt app thì lưu các session đang mở, khi mở lại app thì tự mở lại các session đó thay vì bỏ trống như hiện tại. 2. các icon mở thêm tab mới bên phải, bên dưới rất khó dùng hiện tại, tôi muốn sửa lại theo kiểu drag and drop để khi nắm cửa sổ session kéo thì sẽ cho chọn vị trí để cố định khung chat. 3. khi gõ /exit của claude trong cửa sổ session chat thì cửa sổ chat cũng sẽ biến mất theo luôn, mở rộng các cửa sổ còn lại." — gộp cả 3 vào một CR.
Status: Approved (2026-10-19)
Ảnh hưởng:
- Mở lại ô khi mở app: BR-03 chỉ có "mở lại một phiên cũ để làm tiếp", chưa có tự mở khi khởi động; SRS-FR-013 (archived: add-session-resume) dùng lại để resume, không đổi chữ; SRS mục 3 Pane ghi Pane Shell "không giữ lại giữa các lần mở app" — giữ nguyên; App settings chưa có dữ liệu ô. Phiên mới mở bằng `--session-id` (src-tauri/src/pane_commands.rs) nên phiên chưa gửi yêu cầu nào thì chưa có trên máy, không resume được.
- Kéo thả ô: SRS-FR-022 Split down (archived: add-pane-split-layout, openspec/specs/pane-layout) bị bỏ; SRS-FR-021 (archived: add-session-pane) giữ chữ — phiên mới vẫn mở bên phải ô đang focus; SRS-FR-046 Ví dụ nhắc "bấm Split Right" (archived: add-pane-maximize) phải đổi; SRS-FR-023, SRS-FR-024 giữ nguyên; mục 2.5 luồng A1.
- `/exit` đóng ô: SRS-FR-028 (archived: add-session-pane, openspec/specs/session-pane) ngược hẳn — Ví dụ đang là "/exit → Session ended"; SRS-FR-064 (archived: add-pane-shell, openspec/specs/pane-shell) Ví dụ "/exit → shell vẫn chạy" ngược; SRS-FR-027, SRS-FR-063 (hỏi xác nhận khi đóng ô) không áp cho ô tự đóng; RULE-07 `Ended` giữ nguyên.
- Spec/code: openspec/specs/session-pane, pane-layout, pane-shell; src/components/TerminalPane.tsx (nút Split right/Split down), paneTree.ts, useSessionPanes.ts (onExit → ended), PaneGrid.tsx, App.tsx; src-tauri/src/pane_commands.rs; lưu bố cục cần chỗ lưu cài đặt app (như Text Size).
- Thiết kế: design/agent-deck/design.html không có nút Split nên không phải gỡ; chưa có vùng thả khi kéo ô → /ux-design-ui.
Trả lời của PO (2026-10-19):
- Kéo thả: nắm tiêu đề ô kéo lên một ô khác, ô đó hiện 4 vùng thả trái/phải/trên/dưới; thả vào vùng nào thì ô kéo chuyển tới cạnh đó, chia đôi ô đích. Bỏ hẳn nút Split right/Split down. Phiên mới vẫn mở bên phải ô đang focus.
- Mở lại: đúng các phiên đang có ô lúc thoát app, đúng vị trí và tỉ lệ ô. Không khôi phục trạng thái phóng to, Pane Shell, ô đã "Session ended". Phiên không mở lại được (folder `Missing`, phiên đã xoá) thì bỏ ô đó, ô khác nở ra, báo "<k> sessions could not be reopened".
- `/exit`: thoát bình thường (mã thoát 0: `/exit`, Ctrl+D) → ô đóng ngay, ô còn lại nở ra, Pane Shell của ô cũng kết thúc. Thoát bất thường → giữ ô, hiện "Session ended" như cũ để đọc lỗi.

Diff đề xuất:

Phiên bản: BRD v2.3 → v2.4 (sửa BR-03, BR-05; không đụng BO). SRS v1.4 → v1.5.

BRD:
- BR-03. Trước: "Người dùng mở lại một phiên cũ để làm tiếp". Sau: "Người dùng mở lại một phiên cũ để làm tiếp; các phiên đang mở trong ô lúc thoát app tự mở lại đúng chỗ khi mở app".
- BR-05. Trước: "…trong một cửa sổ, chia ô ngang và dọc, phóng to…". Sau: "…trong một cửa sổ, kéo thả ô để đặt nó sang trái, phải, trên hoặc dưới một ô khác, ô tự đóng khi phiên thoát bình thường, phóng to…".
- Mục 5 Trong phạm vi: "Chạy nhiều phiên Claude Code tương tác cùng lúc, chia ô trong một cửa sổ." → "…chia ô trong một cửa sổ bằng kéo thả, tự mở lại các ô khi mở lại app."
- Mục 13 log phỏng vấn: thêm dòng CR-005. Mục 14: dòng v2.4.

SRS — đổi:
- Mục 1 Mục đích: BRD v2.4. Thuật ngữ thêm: "Drop Zone — một trong bốn vùng trái, phải, trên, dưới hiện trên một ô khi người dùng kéo tiêu đề một ô khác lên nó". "Thoát bình thường — phiên Claude Code kết thúc với mã thoát 0 (`/exit`, Ctrl+D); mọi kiểu kết thúc khác là thoát bất thường".
- Mục 2.5 Luồng chính bước 1: "mỗi phiên mở ra bằng cách chia đôi ô đang focus" giữ; A1 "người dùng chọn chia xuống dưới" → "người dùng kéo tiêu đề ô thả lên Drop Zone của ô khác → SRS-FR-080, SRS-FR-081, SRS-FR-082"; A2 → "phiên thoát bình thường → ô đóng → SRS-FR-083; thoát bất thường → ô báo "Session ended" → SRS-FR-028".
- SRS-FR-022 — Split down on request: Deleted (CR-005), thay bằng SRS-FR-080, SRS-FR-081.
- SRS-FR-028. Trước: "When the session in a pane exits, the system shall show the message "Session ended" in that pane." Ví dụ "gõ `/exit` …". Sau: "When the session in a pane exits abnormally, the system shall show the message "Session ended" in that pane." Ví dụ: Claude Code bị kill → ô hiện "Session ended", vẫn xem lại được nội dung cũ. Ví dụ âm: gõ `/exit` → ô đóng (SRS-FR-083), không hiện "Session ended".
- SRS-FR-046 Ví dụ. Trước: "bấm Split Right trên ô 1". Sau: "đang phóng to ô 1, bấm New Session → bố cục cũ hiện lại, ô mới nằm bên phải ô 1". Câu SHALL giữ nguyên.
- SRS-FR-064. Trước: "While the session in a pane has ended, …". Sau: "While the session in a pane has exited abnormally, the system shall keep that pane's Pane Shell running." Ví dụ: Claude Code bị kill → phần trên hiện "Session ended", shell vẫn chạy `npm run dev`. Ví dụ âm: gõ `/exit` → ô đóng, shell kết thúc theo (SRS-FR-083). Mục 2.10 A3 sửa theo.
- Mục 2.12 mới "Mở lại các ô khi mở app": luồng chính 1. người dùng thoát app khi đang có ô → SRS-FR-084; 2. mở lại app → các ô hiện lại đúng chỗ, phiên tiếp tục → SRS-FR-085. E1 có phiên không mở lại được → SRS-FR-086.
- Mục 3 App settings thêm trường "Open Panes · Không · phiên của từng ô và bố cục (vị trí, tỉ lệ); giữ lại giữa các lần mở app (SRS-FR-084); không gồm phóng to, Pane Shell". Pane: dòng Pane Shell "không giữ lại giữa các lần mở app" giữ nguyên.
- Mục 7 Pane Grid: bỏ SRS-FR-022; thêm SRS-FR-080 đến SRS-FR-086; "chia ô" → "kéo thả ô". Mục 11: SRS-FR-001 đến SRS-FR-086 (trừ SRS-FR-022, SRS-FR-031 đã xoá). Mục 12 dựng lại bằng grep. Mục 14 dòng v1.5.
- SRS-FR-013, SRS-FR-021, SRS-FR-023, SRS-FR-024, SRS-FR-027, SRS-FR-063, RULE-07: không đổi chữ.

SRS — mới:
- SRS-FR-080 — Show drop zones (BR-05, Should, Test): "While the user drags the header of a pane over another pane, the system shall show the Drop Zones of that other pane." Ví dụ: 2 ô, kéo tiêu đề ô 1 lên ô 2 → ô 2 hiện 4 vùng trái/phải/trên/dưới, vùng dưới con trỏ sáng lên. Ví dụ âm: chỉ có 1 ô → kéo tiêu đề không hiện vùng thả nào. Ví dụ âm: kéo từ nút trên tiêu đề (Shell, Maximize, đóng) → không bắt đầu kéo.
- SRS-FR-081 — Move a pane by drop (BR-05, Should, Test): "When the user drops a pane on a Drop Zone of another pane, the system shall move the dropped pane to that side of the other pane, splitting the other pane in half." Giải thích: chỗ cũ của ô được kéo trả cho các ô còn lại; phiên và Pane Shell vẫn chạy, nội dung giữ nguyên, terminal fit lại theo SRS-FR-024. Ví dụ: ô 1 | ô 2 cạnh nhau, thả ô 1 vào vùng dưới của ô 2 → ô 2 trên, ô 1 dưới, mỗi ô cao nửa cửa sổ, ô 1 vẫn `Running`.
- SRS-FR-082 — Cancel a drag (BR-05, Should, Test): "If the user releases a dragged pane outside any Drop Zone or presses Esc while dragging, then the system shall keep the layout unchanged." Ví dụ âm: kéo ô 1 rồi thả lên chính ô 1 → bố cục không đổi.
- SRS-FR-083 — Close pane on normal exit (BR-05, Should, Test): "When the session in a pane exits normally, the system shall close that pane and give its space to the remaining panes." Giải thích: không hỏi xác nhận (SRS-FR-027, SRS-FR-063 chỉ áp cho người dùng đóng ô); Pane Shell của ô kết thúc theo; dòng của phiên rời Active Sessions; ô đang phóng to thì bố cục còn lại hiện lại. Ví dụ: 3 ô ngang, gõ `/exit` ở ô 2 → ô 2 biến mất, ô 1 và ô 3 chia nhau chỗ trống. Ví dụ: ô duy nhất gõ `/exit` → vùng ô trống như lúc chưa mở phiên nào.
- SRS-FR-084 — Remember open panes (BR-03, Should, Test): "The system shall keep the session of every open pane and the pane layout between application launches." Giải thích: ô đã "Session ended" và ô của phiên mới chưa gửi yêu cầu nào không được nhớ (phiên đó chưa có trên máy, không resume được). Ví dụ: 3 ô, ô 3 đang "Session ended", thoát app → nhớ ô 1, ô 2 và vị trí, tỉ lệ của chúng.
- SRS-FR-085 — Reopen panes at launch (BR-03, Should, Demo): "When the application starts, the system shall resume each remembered session in a pane at its remembered position and size." Giải thích: resume như SRS-FR-013; không phóng to, không mở Pane Shell. Ví dụ: thoát app khi có ô 1 | ô 2 chia 30/70, mở lại → 2 ô 30/70, cả hai phiên gõ tiếp được, 0 thao tác.
- SRS-FR-086 — Report panes not reopened (BR-03, Should, Test): "If a remembered session cannot be resumed at launch, then the system shall leave out its pane, give its space to the other panes and show the message "<k> sessions could not be reopened"." Ví dụ âm: 3 ô, folder của ô 2 đã `Missing` → mở ô 1 và ô 3 chia nhau chỗ, hiện "1 sessions could not be reopened". Ví dụ âm: phiên của ô 1 đã bị xoá vào Thùng rác ở ngoài app → tương tự.

Ngoài phạm vi CR này: kéo ô sang cửa sổ khác hoặc ra ngoài app; vùng thả giữa để đổi chỗ hai ô; khôi phục Pane Shell, trạng thái phóng to, nội dung cuộn cũ của terminal; nhớ ô khi app bị kill hay mất điện (chỉ đảm bảo khi thoát app bình thường).

Backlog — thêm (áp sau GATE CR):
- 17 · Phiên thoát bình thường thì đóng ô · update-pane-exit-close · SRS-FR-028, SRS-FR-064, SRS-FR-083 · phụ thuộc 2, 13 · Should; CR-005; đổi hành vi đã archived của mục 2, 13 → /dev-update.
- 18 · Kéo thả ô để đặt vị trí, bỏ nút Split · update-pane-drag-drop · SRS-FR-022, SRS-FR-046, SRS-FR-080, SRS-FR-081, SRS-FR-082 · phụ thuộc 7, 10 · Should; CR-005; bỏ hành vi đã archived của mục 7 → /dev-update; Drop Zone theo /ux-design-ui.
- 19 · Mở lại các ô khi mở app · add-pane-restore · SRS-FR-084, SRS-FR-085, SRS-FR-086 · phụ thuộc 6, 17, 18 · Should; CR-005; chỉ thêm FR mới → /dev-feature; làm sau 17, 18 để lưu đúng bố cục đã đổi.

Thiết kế: design/agent-deck/design.html chưa có Drop Zone → /ux-design-ui trước khi code mục 18. Không sửa ở CR này.

Việc tiếp theo: /dev-update add-session-pane, add-pane-shell (mục 17) → /ux-design-ui (Drop Zone) → /dev-update add-pane-split-layout (mục 18) → /dev-feature add-pane-restore (mục 19).
