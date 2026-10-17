---
req-doc: backlog
slug: agent-deck
---
# Backlog — agent-deck

Nguồn: `SRS.md` Baselined v1.1 (2026-10-17), CR-001 thêm mục 9–11. Thứ tự: phụ thuộc → MoSCoW → giá trị BO (BO-01 là mục tiêu chính).

| # | Mục | change-id | SRS-ID | Phụ thuộc | Lý do | Trạng thái |
|---|---|---|---|---|---|---|
| 1 | Danh sách folder làm việc, app chạy trên macOS và Windows | add-workspace-list | SRS-FR-001, SRS-FR-002, SRS-FR-003, SRS-FR-004, SRS-FR-005, SRS-FR-006, SRS-NFR-004, SRS-NFR-008 | | Must; mọi mục sau cần folder để chạy phiên; build cả Windows 11 ngay từ mục đầu theo rủi ro trong BRD | archived |
| 2 | Mở phiên Claude Code mới trong ô, nhiều ô chia sang phải | add-session-pane | SRS-FR-014, SRS-FR-017, SRS-FR-018, SRS-FR-020, SRS-FR-021, SRS-FR-024, SRS-FR-025, SRS-FR-026, SRS-FR-028, SRS-FR-029, SRS-FR-030, SRS-NFR-002 | 1 | Must; phần khó và rủi ro nhất (ô terminal, gõ tiếng Việt) làm sớm để lộ vấn đề sớm; bảng trạng thái cần ô có phiên | archived |
| 3 | Bảng trạng thái Running / Needs Approval / Error | add-status-board | SRS-FR-027, SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-035, SRS-FR-036, SRS-NFR-006 | 2 | Must; trực tiếp phục vụ BO-01, mục tiêu chính; SRS-FR-027 cần biết trạng thái nên đi cùng mục này | archived |
| 4 | Ghi độ trễ trạng thái và báo cáo Status Latency | add-status-latency-report | SRS-FR-038, SRS-FR-039 | 3 | Must; có báo cáo trước 2 tuần dùng thử thì mới đo được BO-01 | archived |
| 5 | Lịch sử phiên theo folder | add-session-history | SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-019, SRS-NFR-003, SRS-NFR-005, SRS-NFR-007 | 1, 2 | Must; nền cho BO-02; SRS-FR-012 và SRS-FR-019 cần ô có phiên nên sau mục 2 | archived |
| 6 | Mở lại phiên cũ | add-session-resume | SRS-FR-013, SRS-FR-015, SRS-FR-016 | 2, 5 | Must; hoàn tất BO-02 (≤ 3 thao tác) | archived |
| 7 | Chia ô xuống dưới, kéo đổi kích thước, chạy 4 ô cùng lúc | add-pane-split-layout | SRS-FR-022, SRS-FR-023, SRS-NFR-001 | 2 | Must; mục 2 đã dùng được với ô chia sang phải, phần này làm bố cục linh hoạt và kiểm tải 4 ô | archived |
| 8 | Bấm thẻ trên bảng trạng thái để tới ô | add-status-card-jump | SRS-FR-037 | 3 | Should; tiện hơn nhưng không chặn BO-01 vì thẻ đã cho biết phiên nào cần mình | archived |
| 9 | Báo trạng thái ở cột trái thay Status Board | update-status-highlight | SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-037, SRS-FR-038, SRS-FR-039, SRS-FR-040 | 3, 4, 8 | Must; CR-001, đổi hành vi đã archived của mục 3, 4, 8 → /dev-update; trực tiếp phục vụ BO-01 | archived |
| 10 | Phóng to một ô ra cả cửa sổ | add-pane-maximize | SRS-FR-041, SRS-FR-042, SRS-FR-043, SRS-FR-044, SRS-FR-045, SRS-FR-046 | 7, 9 | Should; CR-001; badge của ô phóng to dùng Status Highlight của mục 9 | archived |
| 11 | Xoá phiên vào Thùng rác | add-session-delete | SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050, SRS-NFR-005 | 5 | Should; CR-001; nới SRS-NFR-005 đã archived ở mục 5 | todo |
