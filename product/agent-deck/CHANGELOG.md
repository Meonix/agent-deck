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

## CR-006 — Viền nổi bật cho ô đang focus, ẩn/hiện cột trái
Ngày: 2026-10-20
Yêu cầu: "1. khi focus vào session window của active session nào thì hiển thị background có màu nổi bật lên theo kiểu đang select nó. 2. phần side bar bên trái tôi muốn nó thò thụt để chừa phần diện tích cho phần bên phải, ý tưởng của tôi là sẽ có button để người dùng chủ động show/hide side bar." — PO chốt thêm: "1. viền ô. 2. nút đặt ở vertical center, phím tắt là Ctrl + H để đổi state, auto show khi mở lại app".
Status: Approved (2026-10-20)
Ảnh hưởng:
- Viền focus: SRS-FR-014, SRS-FR-015, SRS-FR-037 (archived) chỉ nói chuyển focus, không nói cách hiện — giữ chữ. Code src/components/TerminalPane.tsx:166 hiện viền `border-ring` chỉ khi ô rảnh; ô Running / Needs Approval / Error dùng viền màu trạng thái (statusTone.tsx) nên ô đang focus không phân biệt được. Viền trạng thái chưa có FR riêng — giữ nguyên.
- Ẩn/hiện cột trái: chưa có FR nào. Cột trái chứa Workspace List và Active Sessions (SRS-FR-032, SRS-FR-034, SRS-FR-037, SRS-NFR-009) — ẩn đi thì chỉ còn trạng thái trên tiêu đề và viền ô. Các ô nở ra phải fit lại theo SRS-FR-024 (giữ chữ). Phím tắt chạy cả khi focus ở ô, giống Zoom shortcut (SRS-FR-068).
- Spec/code: openspec/specs/app-shell, pane-shell (viền ô); src/App.tsx, src/components/WorkspaceSidebar.tsx, src/components/TerminalPane.tsx, src/components/useTextZoom.ts (chỗ bắt phím tắt toàn cửa sổ).
- Thiết kế: design/agent-deck/design.html chưa có nút ẩn/hiện cột trái và vòng focus. Vị trí nút PO đã chốt nên không cần /ux-design-ui.
Trả lời của PO (2026-10-20):
- Ô đang focus có thêm một vòng màu iris dày 2px bên ngoài viền. Viền trạng thái giữ nguyên bên trong, nên cùng lúc thấy được cả focus lẫn trạng thái.
- Nút ẩn/hiện nằm ở giữa theo chiều dọc, sát mép phải cột trái; cột ẩn thì nút nằm sát mép trái cửa sổ. Phím tắt: Cmd+B (macOS), Ctrl+B (Windows), không dùng Ctrl+H vì đó là ^H xoá lùi của terminal. Mở lại app thì cột trái luôn hiện, không nhớ trạng thái ẩn.

Diff đề xuất:

Phiên bản: BRD v2.4 → v2.5 (sửa BR-05; không đụng BO). SRS v1.5 → v1.6.

BRD:
- BR-05. Trước: "…phóng to hoặc thu nhỏ cỡ chữ của cả cửa sổ bằng phím tắt, thao tác đầy đủ như trong terminal thường". Sau: "…phóng to hoặc thu nhỏ cỡ chữ của cả cửa sổ bằng phím tắt, thấy rõ ô đang focus, ẩn cột trái để nhường chỗ cho các ô, thao tác đầy đủ như trong terminal thường".
- Mục 5 Trong phạm vi: thêm "Ẩn/hiện cột trái bằng nút hoặc phím tắt; viền nổi bật cho ô đang focus."
- Mục 13 log phỏng vấn: thêm dòng CR-006. Mục 14: dòng v2.5.

SRS — đổi:
- Mục 1 Thuật ngữ thêm: "Focus Outline — vòng màu iris dày 2px bên ngoài viền của ô đang focus". "Sidebar — cột trái chứa Workspace List và Active Sessions". "Sidebar Toggle — nút ở giữa theo chiều dọc, sát mép phải Sidebar (Sidebar ẩn: sát mép trái cửa sổ), bấm để ẩn/hiện Sidebar". "Sidebar shortcut — Cmd+B trên macOS, Ctrl+B trên Windows".
- Mục 2.5: thêm SRS-FR-087.
- Mục 2.13 mới "Ẩn/hiện cột trái": luồng chính 1. người dùng bấm Sidebar Toggle hoặc Sidebar shortcut → Sidebar ẩn, các ô nở ra → SRS-FR-088, SRS-FR-089. 2. Bấm lại → Sidebar hiện → SRS-FR-088, SRS-FR-089. A1 mở lại app → Sidebar hiện → SRS-FR-090.
- Mục 3 App settings: thêm câu "Trạng thái ẩn của Sidebar không được lưu: mở app thì Sidebar luôn hiện (SRS-FR-090)."
- Mục 7: Pane Grid thêm SRS-FR-087; dòng "toàn cửa sổ" thêm "ẩn/hiện Sidebar" và SRS-FR-088, SRS-FR-089, SRS-FR-090. Mục 11: SRS-FR-001 đến SRS-FR-090. Mục 12 dựng lại bằng grep. Mục 14 dòng v1.6.
- SRS-FR-014, SRS-FR-015, SRS-FR-024, SRS-FR-037, SRS-FR-068: không đổi chữ.

SRS — mới:
- SRS-FR-087 — Focused pane outline (BR-05, Should, Test): "While a pane has keyboard focus, the system shall show the Focus Outline around that pane." Giải thích: chỉ một ô có Focus Outline tại một thời điểm; viền màu trạng thái (Running, Needs Approval, Error) vẫn hiện bên trong, không bị thay; áp cả cho ô đang phóng to. Ví dụ: 3 ô, bấm vào ô 2 → ô 2 có Focus Outline, ô 1 và ô 3 không. Ví dụ: ô 2 đang `Needs Approval` và được focus → ô 2 vừa có viền vàng 2px vừa có Focus Outline iris bên ngoài. Ví dụ: bấm dòng một phiên ở Active Sessions → Focus Outline chuyển sang ô của phiên đó.
- SRS-FR-088 — Toggle sidebar by button (BR-05, Should, Test): "When the user clicks the Sidebar Toggle, the system shall hide the Sidebar if it is shown and show it if it is hidden." Giải thích: Sidebar ẩn hẳn, không còn dải icon; vùng ô nở ra chiếm chỗ đó, terminal fit lại theo SRS-FR-024; Session History Panel đang mở vẫn mở; phiên, ô, Pane Shell không đổi. Ví dụ: Sidebar đang hiện, bấm Sidebar Toggle → Sidebar ẩn, 2 ô cạnh nhau rộng thêm, nút nằm ở mép trái cửa sổ. Ví dụ: bấm lần nữa → Sidebar hiện lại như cũ, folder đang chọn giữ nguyên.
- SRS-FR-089 — Toggle sidebar by shortcut (BR-05, Should, Test): "When the user presses the Sidebar shortcut, the system shall hide the Sidebar if it is shown and show it if it is hidden." Giải thích: chạy cả khi focus đang ở ô; ô không nhận phím đó; focus vẫn ở ô cũ. Ví dụ: đang gõ trong ô 1 trên macOS, bấm Cmd+B → Sidebar ẩn, gõ tiếp vẫn vào ô 1. Ví dụ âm: trên macOS, bấm Ctrl+B trong ô → Claude Code nhận phím đó, Sidebar không đổi. Ví dụ âm: bấm Ctrl+H trong ô → ô nhận ^H, Sidebar không đổi.
- SRS-FR-090 — Sidebar shown at launch (BR-05, Should, Test): "When the application starts, the system shall show the Sidebar." Ví dụ: ẩn Sidebar, thoát app, mở lại → Sidebar hiện.

Ngoài phạm vi CR này: dải icon hẹp khi Sidebar ẩn; báo trạng thái trên Sidebar Toggle khi Sidebar ẩn; kéo để đổi độ rộng Sidebar; hiệu ứng trượt; cho người dùng đổi phím tắt.

Backlog — thêm (áp sau GATE CR):
- 20 · Viền nổi bật cho ô đang focus · add-pane-focus-outline · SRS-FR-087 · phụ thuộc 2, 9 · Should; CR-006; chỉ thêm FR mới → /dev-feature.
- 21 · Ẩn/hiện cột trái bằng nút và phím tắt · add-sidebar-toggle · SRS-FR-088, SRS-FR-089, SRS-FR-090 · phụ thuộc 1, 12 · Should; CR-006; chỉ thêm FR mới → /dev-feature.

Việc tiếp theo: /dev-feature add-pane-focus-outline (mục 20) → /dev-feature add-sidebar-toggle (mục 21).

## CR-007 — Ghim việc chính của mỗi phiên, Claude tự nhắc khi lạc đề
Ngày: 2026-10-21
Yêu cầu: "trên ứng dụng này có cách nào detect được yêu cầu chính của user khi chat với claude không? mục tiêu của tôi là mỗi phiên chat của claude chỉ focus và làm xong một việc sau đó phải qua phiên mới làm việc khác." — PO chốt hướng: "Ghim mục tiêu + để Claude tự phát hiện lạc đề qua ngữ cảnh do hook chèn: tận dụng hook sẵn có, không tốn API", và duyệt mô tả: prompt đầu tiên của phiên là việc chính, hiện một dòng (≤ 80 ký tự) trên tiêu đề ô, sửa bằng nút bút chì; mỗi prompt gửi đi, app chèn cho Claude Code việc chính (≤ ~500 ký tự) và luật ranh giới; việc phục vụ việc chính (sửa bug chặn nó, chạy test, commit, hỏi về code vừa viết) là trong phạm vi, việc tạo ra thay đổi riêng đứng độc lập là lạc đề; lạc đề thì Claude không làm, nói rõ và đề nghị mở phiên mới, PO nói "cứ làm" thì làm tiếp; app không chặn cứng; chỉ phiên mở trong agent-deck; phiên mở lại lấy prompt đầu từ dữ liệu phiên; sau /clear ghim lại theo prompt kế tiếp. Ngoài phạm vi: gọi API phân loại prompt, chặn cứng, nút "Xong → phiên mới".
Status: Approved (2026-10-21)
Ảnh hưởng:
- BO: không khớp BO-01 (không sót phiên chờ) hay BO-02 (mở lại phiên nhanh) → thêm BO-03, BRD lên major. SRS-ID dưới BO-03: SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098 (đều mới).
- SRS-FR-030 (Pane header, archived: session-pane) giữ chữ: Goal Line là dòng riêng dưới tiêu đề, không đổi tiêu đề.
- SRS-FR-066, SRS-FR-067 (nhấp đúp tiêu đề để phóng to, archived), SRS-FR-080 (kéo tiêu đề, archived) giữ chữ: Goal Line không thuộc tiêu đề ô, nút Edit Goal là một nút nên không kích hoạt phóng to.
- SRS-NFR-005 (lịch sử phiên chỉ đọc) giữ: Session Goal do app lưu riêng, không ghi vào dữ liệu phiên của Claude Code.
- SRS-NFR-006 (không sửa cấu hình Claude Code toàn máy) giữ: Focus Reminder đi qua cấu hình hook gắn riêng cho phiên app mở, như tín hiệu trạng thái hiện nay.
- SRS-NFR-007 / A-07 (dữ liệu ở trên máy): Focus Reminder là chính prompt của người dùng, đi qua Claude Code như phần còn lại của cuộc chat → ghi A-10 để PO xác nhận.
- Code (cho /dev-feature): src-tauri/src/hooks.rs (`response()` hiện luôn trả body rỗng; test `every_response_is_empty_and_closes`), src-tauri/src/session_title.rs và session_list.rs (đọc prompt đầu từ dữ liệu phiên), src/components/TerminalPane.tsx (tiêu đề ô dòng 178–235), nơi lưu Open Panes (SRS-FR-084).
- Spec: openspec/specs/session-pane, status-board (hook server), pane-restore, session-resume — chỉ thêm requirement, không sửa requirement cũ → /dev-feature.
- Thiết kế: design/agent-deck/design.html chưa có Goal Line; PO đã chọn bố cục (dòng riêng dưới tiêu đề, bút chì bên phải) nên không cần /ux-design-ui.
Trả lời của PO (2026-10-21):
- BO-03 đo bằng tỉ lệ nhắc lạc đề: ≥ 9/10 prompt lạc đề được Claude nhắc ngay ở lượt trả lời đó, ≤ 1/10 prompt trong phạm vi bị nhắc nhầm, kiểm bằng bộ prompt mẫu, trong 2 tuần dùng thử sau khi có tính năng.
- Việc chính hiện ở dòng riêng ngay dưới tiêu đề ô, tiêu đề ô giữ nguyên.

Diff đề xuất:

Phiên bản: BRD v2.5 → v3.0 (thêm BO-03, BR-09). SRS v1.6 → v1.7.

BRD:
- Mục 1 Tóm tắt thêm câu: "Mỗi ô ghim việc chính của phiên, và Claude Code được nhắc để phiên chỉ làm đúng việc đó."
- Mục 2 thêm gạch: "Một phiên Claude Code dễ bị kéo sang việc thứ hai, thứ ba; ngữ cảnh lẫn lộn và việc chính không xong gọn."
- Mục 4 thêm BO-03 | Mỗi phiên Claude Code chỉ làm một việc | Tỉ lệ prompt lạc đề được Claude Code nhắc ngay ở lượt trả lời đó; tỉ lệ prompt trong phạm vi bị nhắc nhầm | ≥ 9/10; ≤ 1/10 | Đạt trong 2 tuần dùng thử ngay sau khi có tính năng.
- Mục 5 Trong phạm vi thêm: "Ghim việc chính của mỗi phiên trên ô, sửa được; nhắc Claude Code giữ phiên trong việc chính." Ngoài phạm vi thêm: "Phân loại prompt bằng dịch vụ AI riêng; chặn cứng prompt lạc đề; nút kết thúc việc để sang phiên mới."
- Mục 6 thêm BR-09 | Người dùng thấy và sửa được việc chính của mỗi phiên đang mở; khi người dùng gửi một yêu cầu khác việc chính, Claude Code nhắc và đề nghị mở phiên mới thay vì làm luôn, trừ khi người dùng bảo cứ làm | BO-03 | Should.
- Mục 11 thêm: "BO-03: trong 2 tuần dùng thử sau khi có tính năng, ≥ 9/10 prompt lạc đề được nhắc ngay, ≤ 1/10 prompt trong phạm vi bị nhắc nhầm."
- Mục 13 log thêm dòng CR-007 (hai câu trả lời ở trên). Mục 14: dòng v3.0.

SRS — đổi:
- Giả định thêm: A-10 | Focus Reminder gửi qua Claude Code cùng prompt không tính là app gửi dữ liệu phiên ra khỏi máy (A-07, SRS-NFR-007) | PO. A-11 | BO-03 kiểm bằng bộ 10 prompt lạc đề + 10 prompt trong phạm vi gửi vào các phiên có Session Goal khác nhau, đếm số lượt Claude Code nhắc | PO.
- Thuật ngữ thêm: "Session Goal — việc chính của một phiên: prompt đầu tiên người dùng gửi trong phiên, hoặc câu người dùng sửa lại". "Goal Line — dòng ngay dưới tiêu đề ô, hiện Session Goal rút gọn một dòng ≤ 80 ký tự, có nút Edit Goal (bút chì) ở bên phải". "Focus Reminder — ngữ cảnh app gửi cho Claude Code cùng mỗi prompt: Session Goal (≤ 500 ký tự), RULE-09 và cách xử lý prompt lạc đề". "Off-goal prompt — prompt không thuộc Session Goal theo RULE-09".
- Mục 2.14 mới "Giữ phiên trong một việc": luồng chính 1. người dùng gửi prompt đầu trong ô → Session Goal, Goal Line hiện → SRS-FR-091, SRS-FR-092. 2. mỗi prompt sau → Claude Code nhận Focus Reminder → SRS-FR-094, SRS-FR-095. A1 người dùng bấm Edit Goal → SRS-FR-093. A2 mở lại app hoặc resume → SRS-FR-096, SRS-FR-097. E1 không gửi được Focus Reminder → SRS-FR-098.
- Mục 3: App settings thêm dòng "Session Goals | Session Goal của từng phiên theo mã phiên | Không | Giữ lại giữa các lần mở app (SRS-FR-096); không ghi vào dữ liệu phiên của Claude Code (SRS-NFR-005)".
- Mục 4 thêm RULE-09 | Một prompt thuộc Session Goal khi nó phục vụ việc chính: sửa lỗi đang chặn việc chính, chạy test, commit, hỏi về phần vừa làm cho việc chính; prompt tạo ra một thay đổi riêng đứng độc lập được là Off-goal prompt. | BR-09.
- Mục 6 thêm dòng: Claude Code (prompt gửi đi) | Nhận Focus Reminder cùng prompt | Mỗi lần người dùng gửi prompt trong ô (SRS-FR-094) | Không nhận được → SRS-FR-098.
- Mục 7 Pane Grid thêm "Goal Line, sửa Session Goal" và SRS-FR-091 đến SRS-FR-098 (liệt kê đủ). Mục 11: SRS-FR-001 đến SRS-FR-098. Mục 12 dựng lại bằng grep. Mục 14 dòng v1.7.
- SRS-FR-030, SRS-FR-066, SRS-FR-067, SRS-FR-080, SRS-FR-084, SRS-NFR-005, SRS-NFR-006, SRS-NFR-007: không đổi chữ.

SRS — mới (BR-09, Should):
- SRS-FR-091 — Pin first prompt as session goal (Test): "When the user sends a prompt in a pane whose session has no Session Goal, the system shall set that prompt as the Session Goal." Giải thích: áp cho phiên mới và cho phiên mới Claude Code tạo sau `/clear`; prompt là lệnh skill (`/dev-bug lỗi X`) thì lấy nguyên câu. Ví dụ: ô mới, gửi "Sửa lỗi resume mất scrollback" → Session Goal là câu đó. Ví dụ âm: gửi tiếp "chạy test" → Session Goal không đổi.
- SRS-FR-092 — Goal Line (Demo): "While the session in a pane has a Session Goal, the system shall show the Goal Line below the pane header." Giải thích: dài hơn 80 ký tự thì cắt và thêm "…"; di chuột lên thì hiện đủ câu; chưa có Session Goal thì không có Goal Line; nhấp đúp hay kéo Goal Line không phóng to, không kéo ô. Ví dụ: Session Goal 120 ký tự → Goal Line hiện 79 ký tự đầu + "…" và nút bút chì.
- SRS-FR-093 — Edit session goal (Test): "When the user confirms a new text in Edit Goal, the system shall replace the Session Goal with that text." Giải thích: bấm bút chì → Goal Line thành ô sửa; Enter lưu, Esc huỷ; câu rỗng thì giữ câu cũ; prompt sau dùng câu mới. Ví dụ: sửa thành "Sửa resume mất scrollback trên Windows", Enter → Goal Line hiện câu mới, prompt kế tiếp có Focus Reminder với câu mới. Ví dụ âm: xoá hết chữ rồi Enter → Session Goal giữ câu cũ.
- SRS-FR-094 — Focus Reminder with each prompt (Test): "When the user sends a prompt in a pane whose session has a Session Goal, the system shall give Claude Code the Focus Reminder with that prompt." Giải thích: Session Goal dài hơn 500 ký tự thì cắt; chỉ cho phiên mở trong ô của agent-deck. Ví dụ: Session Goal "Sửa lỗi resume mất scrollback", gửi "thêm nút export CSV" → Claude Code nhận prompt đó kèm Focus Reminder có câu Session Goal.
- SRS-FR-095 — Off-goal instruction (Inspection): "The system shall word the Focus Reminder so that Claude Code, for an Off-goal prompt, does not carry it out, says it is a different task and suggests a new session, unless the user tells it to go ahead." Giải thích: app không tự chặn prompt nào; Claude Code tự xét theo RULE-09; hiệu quả đo ở BO-03 (A-11). Ví dụ: Session Goal "Sửa lỗi resume", gửi "thêm nút export CSV" → Claude Code trả lời đây là việc khác và đề nghị mở phiên mới. Ví dụ: gửi tiếp "cứ làm" → Claude Code làm. Ví dụ âm: gửi "commit giúp" → Claude Code commit, không nhắc.
- SRS-FR-096 — Keep session goal across launches (Test): "The system shall keep the Session Goal of each session between application launches." Ví dụ: sửa Session Goal, thoát app, mở lại → ô mở lại có Goal Line với câu đã sửa. Ví dụ: đóng ô, sau đó Resume phiên đó → Goal Line như trước khi đóng.
- SRS-FR-097 — Goal of a resumed session without a stored goal (Test): "When the user resumes a session that has no stored Session Goal, the system shall set the first prompt the user sent in that session as its Session Goal." Giải thích: đọc từ lịch sử phiên của Claude Code, không sửa nó (SRS-NFR-005); phiên chưa có prompt nào thì chưa có Session Goal, SRS-FR-091 áp khi gửi prompt. Ví dụ: Resume phiên cũ có prompt đầu "Scaffold Tauri app" → Goal Line "Scaffold Tauri app".
- SRS-FR-098 — Prompt goes through without reminder (Test): "If the system cannot give Claude Code the Focus Reminder for a prompt, then the system shall let that prompt reach Claude Code unchanged." Ví dụ: hook không trả được Focus Reminder → Claude Code vẫn nhận và làm prompt như khi chưa có tính năng; ô không báo lỗi.

Ngoài phạm vi CR này: phân loại prompt bằng dịch vụ AI riêng; chặn cứng prompt lạc đề; nút "Xong → phiên mới" khi Claude Code xong lượt; nhắc cho phiên mở ngoài agent-deck; hiện Session Goal ở Active Sessions hay Session History Panel.

Backlog — thêm (áp sau GATE CR):
- 22 · Ghim việc chính của phiên, Claude Code nhắc khi lạc đề · add-session-goal · SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098 · phụ thuộc 2, 3, 6, 19 · Should; CR-007; chỉ thêm FR mới → /dev-feature.

Việc tiếp theo: /dev-feature add-session-goal (mục 22).

## CR-008 — Dấu focus trên dòng Active Sessions của ô đang focus
Ngày: 2026-10-21
Yêu cầu: "thêm vào SRS dấu focus trên dòng Active Sessions của ô đang focus (ring iris, giống Focus Outline của ô). Dấu này hiện ở mọi trạng thái kể cả Idle, và nằm chồng lên màu trạng thái chứ không thay nó. Sau đó sửa ActiveRow để nhận focusedId." — bối cảnh: "nó chỉ hiển thị màu khi agent đang chạy thôi, còn đang idle thì nó không hiện màu".
Status: Approved (2026-10-21)
Ảnh hưởng:
- SRS-FR-087 (archived: add-pane-focus-outline; openspec/specs/pane-layout) chỉ quy định Focus Outline trên ô — giữ chữ.
- SRS-FR-032 (Status Highlight chỉ tô Running / Needs Approval / Error; Idle, Ended không tô) — giữ chữ; dấu focus nằm chồng lên, không thay màu trạng thái.
- SRS-FR-037, SRS-FR-051, SRS-NFR-009 — giữ chữ.
- BR-05 đã có "thấy rõ ô đang focus" → không đổi BRD.
- Code: src/components/WorkspaceSidebar.tsx (ActiveRow không nhận focusedId), src/App.tsx (truyền panes.focusedId).
- Thiết kế: design/agent-deck/design.html chưa có dấu focus trên dòng; kiểu dấu đã chốt (ring iris như Focus Outline) nên không cần /ux-design-ui.

Diff đề xuất:

Phiên bản: BRD giữ v3.0. SRS v1.7 → v1.8.

SRS — đổi:
- Mục 1 Thuật ngữ thêm: "Row Focus Mark — vòng màu iris dày 2px quanh dòng của phiên trong Active Sessions khi ô của phiên đó có Focus Outline".
- Mục 2.5: thêm SRS-FR-099 ngay sau SRS-FR-087.
- Mục 7: dòng Active Sessions thêm "Row Focus Mark của ô đang focus" và SRS-FR-099. Mục 11: SRS-FR-001 đến SRS-FR-099. Mục 12 dựng lại bằng grep. Mục 14 dòng v1.8.
- SRS-FR-032, SRS-FR-037, SRS-FR-051, SRS-FR-087, SRS-NFR-009: không đổi chữ.

SRS — mới (BR-05, Should):
- SRS-FR-099 — Focused session row mark (Test): "While a pane has the Focus Outline, the system shall show the Row Focus Mark on the row of that pane's session in Active Sessions." Giải thích: chỉ một dòng có Row Focus Mark tại một thời điểm; hiện ở mọi trạng thái kể cả `Idle` và `Ended`; Status Highlight của dòng vẫn hiện bên trong, không bị thay. Ví dụ: 2 ô đều `Idle`, bấm vào ô 2 → dòng của phiên ô 2 có vòng iris, dòng ô 1 không. Ví dụ: ô 1 đang `Running` và được focus → dòng ô 1 vừa tô nền Running vừa có vòng iris. Ví dụ: bấm dòng ô 1 ở Active Sessions → Row Focus Mark chuyển sang dòng ô 1. Ví dụ âm: chưa ô nào được focus → không dòng nào có Row Focus Mark.

Backlog — thêm (áp sau GATE CR):
- 23 · Dấu focus trên dòng Active Sessions · add-active-row-focus-mark · SRS-FR-099 · phụ thuộc 12, 20 · Should; CR-008; chỉ thêm FR mới → /dev-feature.

Việc tiếp theo: /dev-feature add-active-row-focus-mark (mục 23).

## CR-009 — Đóng ô bằng nút × thì hỏi có xoá luôn phiên không
Ngày: 2026-10-21
Yêu cầu: "khi user chủ động click vào "x" button ở góc phải, app sẽ hiển thị popup hỏi user có muốn xóa luôn cả session chat trong history không, nếu có thì xóa giúp user, nếu không thì thôi. nếu user chủ động "/exit" thì cứ giữ behavior như hiện tại"
Status: Approved (2026-10-21)
Đã chốt khi hỏi: (1) một hộp duy nhất cho mọi lần bấm ×, ba nút Cancel · Close · Close and move to Trash; ô bận thì hộp đó thêm dòng cảnh báo, không bao giờ hai hộp liên tiếp; (2) xoá = chuyển vào Thùng rác như Delete hiện có (SRS-FR-047), không xoá hẳn.
Ảnh hưởng:
- SRS-FR-027 (archived: add-status-board; openspec/specs/session-pane) — hộp "Session is still running. Close anyway?" thành dòng cảnh báo trong Close Dialog → /dev-update.
- SRS-FR-063 (archived: add-pane-shell; openspec/specs/pane-shell) — hộp "A command is still running in the shell. Close anyway?" thành dòng cảnh báo; Ví dụ âm "shell ở dấu nhắc, phiên Idle → đóng không hỏi" không còn đúng → /dev-update.
- SRS-FR-029 (archived: add-session-pane; openspec/specs/session-pane) — giữ chữ; Ví dụ thêm bước chọn Close.
- SRS-FR-062 — giữ chữ; Ví dụ "đóng ô và xác nhận" vẫn đúng.
- SRS-FR-047, SRS-FR-050 (archived: add-session-delete; openspec/specs/session-history) — giữ chữ; FR mới dùng lại hành vi chuyển vào Thùng rác và báo lỗi.
- SRS-FR-048, SRS-FR-049 — giữ chữ: chỉ áp cho Delete trên Session History Panel.
- SRS-FR-083 — giữ nguyên: `/exit` đóng ô, không hỏi, không xoá (theo yêu cầu).
- A-05 — giữ chữ.
- BR-08 "xoá một hoặc nhiều phiên cũ của folder" chưa có lối xoá lúc đóng ô → sửa BR-08.
- Code: src/App.tsx (requestClose, hai ConfirmDialog đóng ô, deleteOne), src/components/ConfirmDialog (hiện chỉ một nút hành động), src/App.test.tsx, src/PaneShell.test.tsx.
- Thiết kế: design/agent-deck/design.html và brief.md còn vẽ hộp "…Close anyway?"; bố cục hộp mới đã chốt khi hỏi (một hộp ba nút, dòng cảnh báo khi bận) nên không cần /ux-design-ui.

Diff đề xuất:

Phiên bản: BRD v3.0 → v3.1 (sửa BR-08, không đụng BO). SRS v1.8 → v1.9.

BRD — đổi:
- BR-08. Trước: "Người dùng xoá một hoặc nhiều phiên cũ của folder cùng lúc bằng cách chuyển chúng vào Thùng rác". Sau: "Người dùng xoá một hoặc nhiều phiên cũ của folder cùng lúc, hoặc xoá phiên ngay lúc đóng ô của nó, bằng cách chuyển chúng vào Thùng rác".
- Mục 8 ràng buộc chỉ-đọc: giữ chữ (vẫn là "khi người dùng chọn xoá phiên đó (BR-08)").
- Lịch sử: dòng v3.1 "CR-009: BR-08 thêm xoá phiên lúc đóng ô".

SRS — đổi:
- Mục 1 Thuật ngữ thêm: "Close Dialog — hộp hiện khi người dùng bấm × trên tiêu đề ô, tiêu đề "Close "<title>"?", ba nút Cancel · Close · Close and move to Trash, cùng các dòng cảnh báo khi ô đang bận".
- SRS-FR-027. Trước: "If the user closes a pane whose session is `Running` or `Needs Approval`, then the system shall ask for confirmation before closing that pane." Sau: "If the user chooses × on a pane whose session is `Running` or `Needs Approval`, then the system shall show the warning "Session is still running." in the Close Dialog." Ví dụ âm mới: ô `Running`, bấm × → Close Dialog có dòng "Session is still running."; chọn Cancel → ô vẫn chạy. Ví dụ âm: ô `Idle` → Close Dialog không có dòng này.
- SRS-FR-063. Trước: "If the user closes a pane whose Pane Shell is running a command, then the system shall ask for confirmation before closing that pane." Sau: "If the user chooses × on a pane whose Pane Shell is running a command, then the system shall show the warning "A command is still running in the shell." in the Close Dialog." Giải thích: ô vừa bận theo SRS-FR-027 vừa có shell bận → một Close Dialog có cả hai dòng. Ví dụ: phiên `Idle`, shell ẩn chạy `npm run dev`, bấm × → Close Dialog có dòng "A command is still running in the shell."; Cancel → ô và shell vẫn chạy. Ví dụ âm: shell đứng ở dấu nhắc → Close Dialog không có dòng này.
- SRS-FR-029. Chữ giữ. Ví dụ: "đóng ô có phiên `Idle`" → "bấm × trên ô có phiên `Idle`, chọn Close"; thêm Ví dụ âm: chọn Close → phiên vẫn còn trong Session History Panel.
- Mục 2.5: bước 4 "Người dùng bấm × trên ô, chọn trong Close Dialog → SRS-FR-100"; E1 → "ô đang `Running` hoặc `Needs Approval` → Close Dialog thêm cảnh báo → SRS-FR-027"; thêm A5 "người dùng chọn Close and move to Trash → SRS-FR-101; không chuyển được → SRS-FR-102".
- Mục 2.9: thêm A4 "người dùng bấm × trên ô và chọn Close and move to Trash → SRS-FR-101".
- Mục 2.10 E1: "đóng ô khi Pane Shell đang chạy một lệnh → Close Dialog thêm cảnh báo → SRS-FR-063, SRS-FR-062".
- Mục 7 dòng Pane Grid: thêm "Close Dialog" và SRS-FR-100, SRS-FR-101, SRS-FR-102. Mục 11: SRS-FR-001 đến SRS-FR-102. Mục 12 dựng lại bằng grep. Mục 14 dòng v1.9.
- SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050, SRS-FR-062, SRS-FR-083: không đổi chữ.

SRS — mới:
- SRS-FR-100 — Close Dialog on pane close (BR-05, Should, Test): "When the user chooses × on a pane header, the system shall show the Close Dialog for that pane before closing it." Giải thích: hiện ở mọi trạng thái; Cancel → không đổi gì; Close → đóng ô như SRS-FR-029, phiên còn trong lịch sử; ô chưa có lịch sử phiên trên đĩa (mở phiên mới mà chưa gõ gì) → Close Dialog không có nút Close and move to Trash. Ví dụ: ô "Fix login bug" `Idle`, bấm × → hộp "Close "Fix login bug"?" ba nút. Ví dụ: chọn Cancel → ô vẫn mở. Ví dụ âm: gõ `/exit` → ô đóng ngay, không có Close Dialog (SRS-FR-083), phiên vẫn còn trong lịch sử.
- SRS-FR-101 — Close and move to Trash (BR-08, Should, Test): "When the user chooses Close and move to Trash in the Close Dialog, the system shall close that pane and then move that session's history to the operating system's trash." Giải thích: kết thúc phiên và Pane Shell như SRS-FR-029, SRS-FR-062 trước khi chuyển; phiên biến khỏi Session History Panel như SRS-FR-047; không hỏi thêm hộp "Move … to Trash?" (SRS-FR-048 chỉ áp cho Delete trên Session History Panel). Ví dụ: ô "Fix login bug" `Idle`, bấm × → Close and move to Trash → ô biến mất, dòng "Fix login bug" biến khỏi Session History Panel, file phiên nằm trong Thùng rác. Ví dụ: ô `Running` → hộp có dòng "Session is still running."; Close and move to Trash → phiên kết thúc, ô đóng, phiên vào Thùng rác.
- SRS-FR-102 — Report delete failure after close (BR-08, Should, Test): "If the history of a session closed with Close and move to Trash cannot be moved to the trash, then the system shall keep that session in the Session History Panel and show the message "Session could not be deleted"." Ví dụ âm: file phiên bị khoá quyền ghi → ô vẫn đóng, phiên còn trong Session History Panel, hiện "Session could not be deleted".

Backlog — thêm (áp sau GATE CR):
- 24 · Đóng ô hỏi có chuyển phiên vào Thùng rác · update-pane-close-dialog · SRS-FR-027, SRS-FR-029, SRS-FR-063, SRS-FR-100, SRS-FR-101, SRS-FR-102 · phụ thuộc 2, 11, 13, 17 · Should; CR-009; đổi hành vi đã archived (SRS-FR-027, SRS-FR-063) → /dev-update.

Việc tiếp theo: /dev-update update-pane-close-dialog (mục 24).

## CR-010 — Bỏ nhắc lạc đề, việc chính thành ô chữ đỏ sửa trực tiếp
Ngày: 2026-10-22
Yêu cầu: "hiện tại tính năng pin target của session tôi thấy đang hoạt động không hợp lý, điều chỉnh giúp tôi. 1. xóa hết tất cả những tính năng tự đoán target của session mà trước đó đã làm trên repo này. 2. thay vào đó tôi muốn có một hộp text có thể edit Text được. edit text này sẽ lấy nội dung chính prompt đầu tiên của tôi điền vào, sau đó tôi có thể tùy ý chỉnh sửa. 3. edit text sẽ có màu đỏ. nói chung là chỉ hiển thị target thôi chứ không ràng buộc agent phải follow theo target của session như trước. toi sẽ tự xem xét target và align." — trước prompt đầu: "bỏ trống cho đến khi user prompt"; chọn kiểu B trên mockup (nhiều dòng, tối đa 3 dòng rồi cuộn); PO duyệt mô tả: "ổn". Mô tả đã duyệt: bỏ Focus Reminder và luật lạc đề, app không chèn gì vào prompt; bỏ Goal Line một dòng và nút bút chì; thay bằng ô target dưới tiêu đề mọi ô, chữ đỏ, tối đa 3 dòng rồi cuộn, trống kèm chữ gợi ý tới khi có prompt đầu, prompt đầu điền nguyên văn (giữ xuống dòng), prompt sau không đổi; bấm vào sửa ngay, Enter xuống dòng, rời ô thì lưu, Esc bỏ phần vừa gõ; gõ target trước prompt đầu thì giữ chữ người dùng; xoá trống thì giữ trống, không tự điền lại; giữ lưu theo mã phiên, /clear thì phiên mới trống, Resume phiên cũ lấy prompt đầu trong lịch sử.
Status: Approved (2026-10-22)
Ảnh hưởng:
- BO: BO-03 đo bằng tỉ lệ Claude Code nhắc lạc đề; bỏ nhắc thì không đo được → đổi BO-03, BRD lên major. SRS-ID dưới BO-03: SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098.
- BR-09 bỏ vế "Claude Code nhắc và đề nghị mở phiên mới".
- SRS-FR-094, SRS-FR-095, SRS-FR-098 (archived: add-session-goal) → xoá. RULE-09, A-10, A-11, thuật ngữ "Focus Reminder", "Off-goal prompt", dòng giao diện ngoài "Claude Code (prompt gửi đi)" → xoá.
- SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-096, SRS-FR-097 (archived: add-session-goal) → sửa: Goal Line thành Target Box.
- SRS-FR-030, SRS-FR-066, SRS-FR-067, SRS-FR-080 (tiêu đề ô, nhấp đúp, kéo) giữ chữ: Target Box nằm ngoài tiêu đề ô như Goal Line trước đây.
- SRS-NFR-005 giữ: Session Goal vẫn lưu riêng, không ghi vào dữ liệu phiên của Claude Code. SRS-NFR-006, SRS-NFR-007 giữ: app không còn gửi gì thêm cho Claude Code.
- Code (cho /dev-update): src-tauri/src/session_goal.rs (`focus_reminder`, `reminder_body`, `GoalKeeper::hook` trả body), src-tauri/src/pane_commands.rs, panes.rs, pty/session.rs, commands.rs, lib.rs; src/components/TerminalPane.tsx (`GoalLine`), useSessionPanes.ts, src/api/sessions.ts cùng các test đi kèm.
- Spec: openspec/specs/session-goal (SRS-FR-091 đến SRS-FR-098) → /dev-update add-session-goal.
- Thiết kế: PO đã chọn kiểu B trên mockup (nhiều dòng, tối đa 3 dòng rồi cuộn, chữ đỏ) nên không cần /ux-design-ui.
Trả lời của PO (2026-10-22):
- BO-03 đổi thành "luôn thấy việc chính của mỗi phiên đang mở", đo bằng số thao tác để thấy việc chính = 0.

Diff đề xuất:

Phiên bản: BRD v3.1 → v4.0 (đổi BO-03, BR-09). SRS v1.9 → v1.10.

BRD:
- Mục 1 Tóm tắt: "Mỗi ô ghim việc chính của phiên, và Claude Code được nhắc để phiên chỉ làm đúng việc đó." → "Mỗi ô hiện việc chính của phiên bằng chữ đỏ, người dùng tự đối chiếu để phiên chỉ làm đúng việc đó."
- Mục 2 giữ gạch "Một phiên Claude Code dễ bị kéo sang việc thứ hai…".
- Mục 4 BO-03: "Mỗi phiên Claude Code chỉ làm một việc | Tỉ lệ prompt lạc đề được Claude Code nhắc…; tỉ lệ… nhắc nhầm | ≥ 9/10; ≤ 1/10 | …" → "Luôn thấy việc chính của mỗi phiên đang mở | Số thao tác để thấy việc chính của một ô đang mở đã có prompt | 0 thao tác | Đạt trong 2 tuần dùng thử ngay sau khi có tính năng".
- Mục 5 Trong phạm vi: "Ghim việc chính của mỗi phiên trên ô, sửa được; nhắc Claude Code giữ phiên trong việc chính." → "Hiện việc chính của mỗi phiên trên ô, sửa trực tiếp được." Ngoài phạm vi: thêm "nhắc hay ràng buộc Claude Code theo việc chính" vào đầu dòng hiện có.
- Mục 6 BR-09: "…; khi người dùng gửi một yêu cầu khác việc chính, Claude Code nhắc và đề nghị mở phiên mới thay vì làm luôn, trừ khi người dùng bảo cứ làm" → "Người dùng thấy và sửa được việc chính của mỗi phiên đang mở ngay trên ô; app không ràng buộc Claude Code theo việc chính" | BO-03 | Should.
- Mục 11 BO-03: → "trong 2 tuần dùng thử sau khi có tính năng, mọi ô đã có prompt đều hiện việc chính mà không cần thao tác nào."
- Mục 13 log thêm dòng CR-010 (bỏ nhắc lạc đề, ô target chữ đỏ; BO-03 đo bằng số thao tác = 0). Mục 14: dòng v4.0.

SRS:
- Mục giả định: A-10, A-11 → "Deleted (CR-010)".
- Thuật ngữ: "Session Goal" giữ, thêm "câu rỗng người dùng để lại cũng là Session Goal". "Goal Line" → "Target Box — ô chữ đỏ ngay dưới tiêu đề ô, hiện và sửa trực tiếp Session Goal, cao tối đa 3 dòng rồi cuộn". Bỏ "Focus Reminder", "Off-goal prompt".
- Mục 2.14 đổi tên "Hiện việc chính của phiên": luồng chính 1. gửi prompt đầu → Session Goal, Target Box hiện câu đó → SRS-FR-091, SRS-FR-092. Luồng thay thế A1 sửa trong Target Box → SRS-FR-093; A2 mở lại app hoặc Resume → SRS-FR-096, SRS-FR-097. Bỏ luồng 2 và E1.
- SRS-FR-091: "When the user sends a prompt in a pane whose session has no Session Goal, …" → "When the user sends a prompt in a pane whose session has no stored Session Goal, the system shall set that prompt as the Session Goal." Giải thích thêm: lấy nguyên văn, giữ xuống dòng; người dùng đã gõ vào Target Box trước prompt đầu, hay đã xoá trống nó, thì phiên đã có Session Goal nên prompt không ghi đè. Ví dụ âm mới: gõ "Sửa resume" vào Target Box rồi gửi "chạy test" → Session Goal vẫn "Sửa resume".
- SRS-FR-092 "Goal Line" → "Target Box": "The system shall show the Target Box below the header of every pane." Giải thích: chữ đỏ; cao theo nội dung tối đa 3 dòng, dài hơn thì cuộn trong ô; chưa có Session Goal thì ô trống kèm chữ gợi ý mờ; nhấp đúp hay kéo trong Target Box không phóng to, không kéo ô. Ví dụ: prompt đầu 5 dòng → Target Box hiện 3 dòng đầu, cuộn xem phần còn lại. Ví dụ: ô mới chưa gửi prompt → Target Box trống, có chữ gợi ý. Kiểm chứng: Demo.
- SRS-FR-093 "Edit session goal": "When the user confirms a new text in Edit Goal, …" → "When the Target Box loses focus after the user changed its text, the system shall replace the Session Goal with that text." Giải thích: bấm vào Target Box là sửa ngay, không có nút bút chì; Enter xuống dòng; Esc bỏ phần vừa gõ và trả câu cũ; câu rỗng được lưu, ô giữ trống và không tự điền lại. Ví dụ: sửa thành "Sửa resume trên Windows", bấm ra ngoài → thoát app mở lại vẫn thấy câu mới. Ví dụ âm: gõ "abc" rồi Esc → ô hiện câu cũ. Kiểm chứng: Test.
- SRS-FR-094, SRS-FR-095, SRS-FR-098 → "Deleted (CR-010)", giữ ID, bỏ nội dung.
- SRS-FR-096, SRS-FR-097: giữ câu EARS; ví dụ đổi "Goal Line" → "Target Box". SRS-FR-097 ví dụ âm: phiên chưa có prompt → Target Box trống.
- Mục 3 dòng "Session Goals" giữ.
- RULE-09 → "Deleted (CR-010)".
- Giao diện ngoài: bỏ dòng "Claude Code (prompt gửi đi) | Nhận Focus Reminder cùng prompt…".
- Màn hình Pane Grid: "Goal Line và sửa Session Goal" → "Target Box hiện và sửa Session Goal"; bỏ SRS-FR-094, SRS-FR-095, SRS-FR-098 khỏi danh sách.
- Bảng truy vết: SRS-FR-094, SRS-FR-095, SRS-FR-098 trạng thái "Deleted (CR-010)"; SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-096, SRS-FR-097 "Baselined" (đổi theo CR-010).
- Lịch sử: dòng v1.10 "CR-010: bỏ Focus Reminder và luật lạc đề (xoá SRS-FR-094, SRS-FR-095, SRS-FR-098, RULE-09, A-10, A-11); Goal Line thành Target Box chữ đỏ sửa trực tiếp; theo BRD v4.0".

Backlog — thêm (áp sau GATE CR):
- 25 · Bỏ nhắc lạc đề, việc chính thành Target Box chữ đỏ · update-session-target-box · SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098 · phụ thuộc 22 · Should; CR-010; đổi hành vi đã archived (add-session-goal) → /dev-update.

Việc tiếp theo: /dev-update add-session-goal (mục 25).

## CR-011 — Stash phiên đang dở để mở lại sau
Ngày: 2026-10-22
Yêu cầu: "hiện tại tôi cần tạo một section bên side bar bên trái. section đó tên là "Stashed Sesion" bạn có thể đặt lại tên cho đúng chính tả hoặc nghe hay hơn. Mục đích của session này là dùng để đánh dấu các session chat có thể được mở lại trong tương lai do hiện tại công việc vẫn con dở và chưa thể xử lý được ngay. tôi muốn có nút stash lại ngay trên window session chat kế bên trái nút phóng to. khi bấm vào thì nó sẽ tự close session và lưu vào stash. nếu user sau đó click vào thì mở lại phiên đó." — tên section chốt: "Stashed Sessions".
Status: Approved (2026-10-22)
Trả lời của PO (2026-10-22):
- Mở lại từ Stashed Sessions → mục rời khỏi stash.
- Bấm Stash không hỏi, trừ khi ô đang bận (phiên `Running`/`Needs Approval` hoặc Pane Shell đang chạy lệnh) thì hỏi xác nhận.
- Stashed Sessions giữ lại giữa các lần mở app.
- Mỗi dòng có nút × để gỡ khỏi stash mà không mở lại, phiên vẫn còn trong lịch sử.
Ảnh hưởng:
- BO: không đổi. Stash phục vụ BO-02 (quay lại phiên cũ nhanh: bấm một dòng = 1 thao tác).
- BR-03 thêm vế để dành phiên đang dở → BRD minor.
- Chỉ thêm FR/NFR mới, không sửa câu EARS nào đã archived:
  - SRS-NFR-009 (archived: update-active-sessions, spec status-board) chỉ nói hai section → giữ nguyên, tint section thứ ba đặt ở NFR mới SRS-NFR-010.
  - SRS-FR-041 (archived: add-pane-maximize) liệt kê vùng bị che; Stashed Sessions nằm trong Sidebar nên vẫn bị che → giữ nguyên câu.
  - SRS-FR-015, SRS-FR-016, SRS-FR-017, SRS-FR-029, SRS-FR-062, SRS-FR-084 dùng lại, không sửa.
- Thuật ngữ "Sidebar" (chỉ tài liệu) thêm Stashed Sessions.
- Code (cho /dev-feature): src/components/WorkspaceSidebar.tsx (section mới), src/components/TerminalPane.tsx (nút Stash cạnh Maximize), useSessionPanes.ts, App.tsx; src-tauri lưu danh sách stash cạnh Open Panes / Session Goals.
- Thiết kế: dùng tokens có sẵn trong design/agent-deck/tokens.css; không có màn mới.

Diff đề xuất:

Phiên bản: BRD v4.0 → v4.1 (sửa BR-03). SRS v1.10 → v1.11.

BRD:
- Mục 5 Trong phạm vi: dòng "Xem và mở lại phiên Claude Code đã có trên máy, theo từng folder." → thêm "; để dành phiên đang dở vào danh sách riêng để mở lại sau."
- Mục 6 BR-03: "Người dùng mở lại một phiên cũ để làm tiếp; các phiên đang mở trong ô lúc thoát app tự mở lại đúng chỗ khi mở app" → thêm "; người dùng để dành một phiên đang dở (đóng ô của nó) vào một danh sách riêng và mở lại từ danh sách đó" | BO-02 | Must (giữ).
- Mục 13 log thêm dòng CR-011. Mục 14: dòng v4.1.

SRS:
- Thuật ngữ: "Sidebar" → "Cột trái chứa Workspace List, Active Sessions và Stashed Sessions". Thêm "Stashed Sessions — section trong Sidebar, dưới Active Sessions, liệt kê các phiên người dùng đã để dành". Thêm "Stash Dialog — hộp hiện khi bấm Stash trên ô đang bận, tiêu đề "Stash "<title>"?", hai nút Cancel · Stash, cùng các dòng cảnh báo như Close Dialog".
- Mục mới 2.15 "Để dành phiên đang dở": luồng chính 1. bấm Stash trên tiêu đề ô → ô đóng, phiên vào Stashed Sessions → SRS-FR-103, SRS-FR-104. 2. bấm dòng trong Stashed Sessions → phiên mở trong ô mới, rời stash → SRS-FR-108, SRS-FR-109. Thay thế: A1 ô đang bận → Stash Dialog → SRS-FR-105; A2 gỡ dòng bằng × → SRS-FR-110; A3 mở lại app → danh sách còn nguyên → SRS-FR-111. Ngoại lệ: E1 workspace `Missing` → SRS-FR-016, dòng ở lại; E2 lịch sử phiên không còn → SRS-FR-112.
- SRS-FR-103 — Stash button (BR-03, Should, Demo): "The system shall show a Stash button in the header of every pane immediately to the left of the Maximize button." Giải thích: ô chưa có lịch sử phiên trên đĩa (phiên mới chưa gõ gì) → nút bị tắt, vì không có gì để mở lại; Maximized Pane cũng có nút, bên trái nút Restore. Ví dụ: tiêu đề ô "agent-deck · Fix login bug" → thứ tự nút … Stash · Maximize · ×. Ví dụ âm: ô New Session chưa gửi prompt → nút Stash mờ, bấm không có gì xảy ra.
- SRS-FR-104 — Stash a pane (BR-03, Should, Test): "When the user chooses Stash on a pane that is not busy, the system shall close that pane and add its session to Stashed Sessions." Giải thích: "không bận" = phiên không `Running`/`Needs Approval` và Pane Shell không chạy lệnh; đóng như SRS-FR-029, SRS-FR-062 (kết thúc phiên và shell); không hiện Close Dialog; phiên vẫn còn trong Session History Panel; ô đã đóng không được nhớ theo SRS-FR-084. Ví dụ: ô "Fix login bug" `Idle`, bấm Stash → ô biến mất, Stashed Sessions có dòng "Fix login bug · mokairo". Ví dụ âm: bấm Stash → phiên không bị xoá, vẫn còn trong lịch sử.
- SRS-FR-105 — Confirm stashing a busy pane (BR-03, Should, Test): "If the user chooses Stash on a pane whose session is `Running` or `Needs Approval` or whose Pane Shell is running a command, then the system shall show the Stash Dialog for that pane before stashing it." Giải thích: dòng cảnh báo giống SRS-FR-027, SRS-FR-063; Cancel → không đổi gì; Stash → như SRS-FR-104. Ví dụ: ô `Running`, bấm Stash → hộp "Stash "Fix login bug"?" có dòng "Session is still running."; chọn Stash → phiên kết thúc, ô đóng, phiên vào Stashed Sessions. Ví dụ âm: chọn Cancel → ô vẫn chạy, Stashed Sessions không đổi.
- SRS-FR-106 — List stashed sessions (BR-03, Should, Test): "The system shall list in Stashed Sessions every stashed session across all workspaces, with its title and its workspace name, most recently stashed first." Ví dụ: stash "Fix login bug" (mokairo) lúc 14:00 rồi "Scaffold Tauri app" (agent-deck) lúc 14:10 → dòng đầu "Scaffold Tauri app · agent-deck". Ví dụ âm: phiên chưa từng stash → không có trong Stashed Sessions.
- SRS-FR-107 — Empty stashed sessions (BR-03, Should, Test): "While no session is stashed, the system shall show the message "No stashed sessions" in Stashed Sessions."
- SRS-FR-108 — Reopen a stashed session (BR-03, Should, Test): "When the user chooses a row in Stashed Sessions, the system shall resume that session in a new pane." Giải thích: resume như SRS-FR-013, đặt ô như SRS-FR-046; workspace `Missing` → từ chối như SRS-FR-016, dòng ở lại; Claude Code không khởi động được → SRS-FR-017. Ví dụ: bấm "Fix login bug · mokairo" → ô mới tiếp tục hội thoại cũ, gõ được ngay (1 thao tác, BO-02). Ví dụ âm: `mokairo` `Missing` → không mở ô, hiện "Folder not found", dòng vẫn ở Stashed Sessions.
- SRS-FR-109 — Unstash on open (BR-03, Should, Test): "When a stashed session opens in a pane, the system shall remove that session from Stashed Sessions." Giải thích: mở bằng bất kỳ đường nào (dòng stash, Resume trong Session History Panel). Ví dụ: Resume "Fix login bug" từ Session History Panel khi nó đang trong stash → ô mở, dòng biến khỏi Stashed Sessions.
- SRS-FR-110 — Remove from stash (BR-03, Should, Test): "When the user chooses × on a row in Stashed Sessions, the system shall remove that session from Stashed Sessions without changing its history." Giải thích: × hiện khi rê chuột lên dòng; không hỏi xác nhận; không mở ô. Ví dụ: bấm × trên "Fix login bug" → dòng biến mất, phiên vẫn còn trong Session History Panel. Ví dụ âm: bấm × → không có ô nào mở.
- SRS-FR-111 — Keep stash across launches (BR-03, Should, Test): "The system shall keep Stashed Sessions and their order between application launches." Ví dụ: stash 2 phiên, thoát app, mở lại → Stashed Sessions vẫn 2 dòng cùng thứ tự.
- SRS-FR-112 — Drop stashed sessions without history (BR-03, Should, Test): "If the history of a stashed session no longer exists, then the system shall remove that session from Stashed Sessions." Giải thích: phiên bị xoá vào Thùng rác trong app (SRS-FR-047, SRS-FR-073) hay ngoài app. Ví dụ âm: xoá "Fix login bug" trong Session History Panel → dòng biến khỏi Stashed Sessions.
- SRS-NFR-010 — Stashed Sessions tint (BR-03, Should, Analysis): "The system shall give the Stashed Sessions section a background tint different from the Workspace List and Active Sessions tints, with a contrast ratio of at most 1.25:1 against the sidebar background and a text contrast of at least 4.5:1, in both light and dark themes." Ví dụ: nền 1.10:1, chữ 12:1 → đạt.
- Mục 3 App settings: thêm dòng "Stashed Sessions | Mã phiên, workspace, thời điểm stash của từng phiên để dành | Không | Giữ lại giữa các lần mở app (SRS-FR-111); không ghi vào dữ liệu phiên của Claude Code (SRS-NFR-005)".
- Mục 7 Màn hình: thêm dòng "Cửa sổ chính · Stashed Sessions | Phiên để dành của mọi folder, bấm dòng để mở lại, × để gỡ; tint riêng của section | SRS-FR-106, SRS-FR-107, SRS-FR-108, SRS-FR-109, SRS-FR-110, SRS-FR-111, SRS-FR-112, SRS-NFR-010". Dòng Pane Grid thêm "nút Stash, Stash Dialog" và SRS-FR-103, SRS-FR-104, SRS-FR-105.
- Bảng truy vết: thêm SRS-FR-103 đến SRS-FR-112, SRS-NFR-010, BR-03, "Baselined".
- Lịch sử: dòng v1.11 "CR-011: Stashed Sessions trong Sidebar, nút Stash trên tiêu đề ô bên trái Maximize, hỏi khi ô bận, mở lại thì rời stash, × để gỡ, giữ giữa các lần mở app; thêm SRS-FR-103 đến SRS-FR-112, SRS-NFR-010; theo BRD v4.1".

Backlog — thêm (áp sau GATE CR):
- 26 · Để dành phiên đang dở vào Stashed Sessions · add-session-stash · SRS-FR-103, SRS-FR-104, SRS-FR-105, SRS-FR-106, SRS-FR-107, SRS-FR-108, SRS-FR-109, SRS-FR-110, SRS-FR-111, SRS-FR-112, SRS-NFR-010 · phụ thuộc 6, 10, 12, 24 · Should; CR-011; chỉ thêm FR mới → /dev-feature.

Việc tiếp theo: /dev-feature add-session-stash (mục 26).
