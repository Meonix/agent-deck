---
req-doc: backlog
slug: agent-deck
---
# Backlog — agent-deck

Nguồn: `SRS.md` Baselined v1.5 (2026-10-19), CR-001 thêm mục 9, 10, 11; CR-002 thêm mục 12; CR-003 thêm mục 13; CR-004 thêm mục 14, 15, 16; CR-005 thêm mục 17, 18, 19. Thứ tự: phụ thuộc → MoSCoW → giá trị BO (BO-01 là mục tiêu chính).

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
| 11 | Xoá phiên vào Thùng rác | add-session-delete | SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050, SRS-NFR-005 | 5 | Should; CR-001; nới SRS-NFR-005 đã archived ở mục 5 | archived |
| 12 | Tách Active Sessions ở cột trái, lịch sử phiên sang khung phải | update-active-sessions | SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-013, SRS-FR-019, SRS-FR-032, SRS-FR-037, SRS-FR-041, SRS-FR-047, SRS-FR-048, SRS-FR-050, SRS-FR-051, SRS-FR-052, SRS-FR-053, SRS-FR-054, SRS-NFR-003, SRS-NFR-009 | 5, 6, 9, 10, 11 | Should; CR-002, đổi hành vi đã archived của mục 5, 6, 9, 10, 11 → /dev-update; màu hai section theo /ux-design-ui | archived |
| 13 | Terminal phụ dưới mỗi ô | add-pane-shell | SRS-FR-055, SRS-FR-056, SRS-FR-057, SRS-FR-058, SRS-FR-059, SRS-FR-060, SRS-FR-061, SRS-FR-062, SRS-FR-063, SRS-FR-064, SRS-FR-065 | 7, 10 | Should; CR-003; chỉ thêm FR mới, không đổi hành vi đã archived → /dev-feature; nút Shell và khu shell theo /ux-design-ui | archived |
| 14 | Nhấp đúp tiêu đề ô để phóng to / thu về | add-pane-header-double-click | SRS-FR-066, SRS-FR-067 | 10 | Should; CR-004; chỉ thêm FR mới → /dev-feature | archived |
| 15 | Phóng to, thu nhỏ cỡ chữ cả cửa sổ bằng phím tắt | add-text-zoom | SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071, SRS-FR-072 | 2, 13 | Should; CR-004; chỉ thêm FR mới → /dev-feature | archived |
| 16 | Tick chọn và xoá nhiều phiên cùng lúc | add-bulk-session-delete | SRS-FR-073, SRS-FR-074, SRS-FR-075, SRS-FR-076, SRS-FR-077, SRS-FR-078, SRS-FR-079 | 11, 12 | Should; CR-004; chỉ thêm FR mới → /dev-feature; checkbox và thanh "Delete selected" theo /ux-design-ui | archived |
| 17 | Phiên thoát bình thường thì đóng ô | update-pane-exit-close | SRS-FR-028, SRS-FR-064, SRS-FR-083 | 2, 13 | Should; CR-005; đổi hành vi đã archived của mục 2, 13 → /dev-update | archived |
| 18 | Kéo thả ô để đặt vị trí, bỏ nút Split | update-pane-drag-drop | SRS-FR-022, SRS-FR-046, SRS-FR-080, SRS-FR-081, SRS-FR-082 | 7, 10 | Should; CR-005; bỏ hành vi đã archived của mục 7 → /dev-update; Drop Zone theo /ux-design-ui | archived |
| 19 | Mở lại các ô khi mở app | add-pane-restore | SRS-FR-084, SRS-FR-085, SRS-FR-086 | 6, 17, 18 | Should; CR-005; chỉ thêm FR mới → /dev-feature; làm sau 17, 18 để lưu đúng bố cục đã đổi | applied |
