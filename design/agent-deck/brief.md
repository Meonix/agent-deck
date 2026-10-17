# Design brief — agent-deck

Nguồn: `product/agent-deck/BRD.md` (Approved v2.1), `product/agent-deck/SRS.md` (Baselined v1.2) mục 7. CR-001 (2026-10-17) bỏ Status Board, thêm phóng to ô và xoá phiên. CR-002 (2026-10-17) tách Active Sessions ở cột trái, lịch sử phiên sang Session History Panel.

## Nền tảng

App desktop (Tauri 2), giao diện web React/TS, chạy macOS 14+ và Windows 11. Nhãn tiếng Anh (SRS-NFR-008).

## Người dùng

Một người dùng, cũng là PO. Lập trình viên quen terminal, chạy song song nhiều phiên Claude Code.

## Giá trị cốt lõi

1. Không sót phiên chờ duyệt hoặc lỗi — Status Highlight (màu nền + badge) trên dòng của Active Sessions (mọi folder, gấp nhất ở trên), dòng folder, và badge của ô phóng to phải nhìn thấy ngay (BO-01).
2. Mở lại phiên cũ ≤ 3 thao tác: chọn folder (mở Session History Panel) → chọn phiên → Resume (BO-02).
3. Ô terminal chiếm phần lớn màn hình, dùng như terminal thường, phóng to được ra cả cửa sổ (BR-05). Bỏ cột Status Board là để trả chỗ cho ô.

## Cảm giác

Hiện đại kiểu Linear / Raycast: thoáng, bo góc, thẻ nổi, chữ vừa. Đánh đổi đã biết: tốn chỗ hơn
cho terminal so với kiểu VS Code / Zed — bố cục phải bù bằng cách cho vùng ô chiếm tối đa.

## Màn hình (SRS mục 7)

| Màn hình | Vùng | SRS-FR |
| --- | --- | --- |
| Cửa sổ chính · cột trái | Workspace List (section Folders) — thêm, bỏ, chọn folder; nhãn `Missing`; dòng folder tô theo trạng thái gấp nhất + badge đếm; bấm lại folder đang chọn thì đóng Session History Panel; tint riêng | SRS-FR-001 … SRS-FR-006, SRS-FR-040, SRS-FR-054, SRS-NFR-009 |
| Cửa sổ chính · cột trái | Active Sessions — phiên mở trong ô của mọi folder, tiêu đề + tên folder, dòng tô + badge trạng thái, dòng phụ "giờ · lý do" khi Needs Approval / Error, xếp gấp trước, bấm dòng bất kỳ để tới ô, rỗng "No active sessions"; tint riêng | SRS-FR-032, SRS-FR-033, SRS-FR-037, SRS-FR-051 … SRS-FR-053, SRS-NFR-009 |
| Cửa sổ chính · Session History Panel | Cột giữa cột trái và các ô; tiêu đề tên folder + nút ×; New Session; phiên của folder, `Live` (không tô trạng thái), Resume, Delete từng dòng, hộp xác nhận | SRS-FR-007 … SRS-FR-020, SRS-FR-047 … SRS-FR-050, SRS-FR-054 |
| Cửa sổ chính | Pane Grid — các ô terminal, header ô, chia phải/xuống, đóng ô, nút Maximize / Restore | SRS-FR-014 … SRS-FR-030, SRS-FR-036, SRS-FR-041 … SRS-FR-043, SRS-FR-046 |
| Cửa sổ chính · ô phóng to | Một ô che cả cửa sổ dưới thanh tiêu đề; badge đếm phiên khác Needs Approval / Error trên header, bấm để thu về và tới phiên gấp nhất | SRS-FR-041, SRS-FR-044, SRS-FR-045 |
| ~~Status Board~~ | Bỏ theo CR-001 (SRS-FR-031 Deleted) | |
| Status Latency | Tỉ lệ đổi trạng thái hiện ≤ 3 giây trong 14 ngày | SRS-FR-039 |

## Trạng thái cần vẽ (bước 7)

Empty (chưa có folder · folder chưa có phiên), Loading danh sách phiên, Error (phiên không đọc được,
Folder not found, Claude Code could not be started, Status unavailable, Session could not be deleted),
Dense (4+ ô, nhiều phiên Live ở nhiều folder cùng lúc tô màu), hộp xác nhận xoá (phiên thường · phiên
đang mở), ô phóng to có badge / không badge, cửa sổ hẹp.

## Đã chốt cho CR-001 (2026-10-17)

- Bố cục: wireframe A · Tô cả dòng (`design.html#cr001`, ô phóng to: `#cr001-maximized-dark`). Delete nằm cạnh Resume trên dòng đang chọn.
- Màu: bản 1 · Soft fill trên nền P4 Dark attention (`design.html#cr001-v1-soft-fill`). Dòng phiên và dòng folder tô nền `--*-bg` (bậc 3), badge chip có ô vuông, dòng phụ "giờ · lý do" màu `--*-foreground`. Không thêm token.
- Ô phóng to: badge "N need you" trên header ô, màu Error nếu có phiên Error, còn lại màu Needs Approval.
- Trạng thái: `design.html#cr001-states`.

## Phạm vi CR-002 (2026-10-17)

- Cột trái: hai section Folders và Active Sessions, mỗi section một tint dịu. SRS-NFR-009: nền section so với nền cột trái ≤ 1.25:1, chữ trên nền đó ≥ 4.5:1, cả light và dark.
- Session History Panel: mở khi chọn folder, đóng bằng × hoặc bấm lại folder; các ô hẹp lại / rộng ra.
- Trạng thái cần vẽ thêm: Active Sessions rỗng, khung lịch sử đóng / mở, khung lịch sử rỗng / đang tải / phiên không đọc được, Dense (6+ phiên đang mở ở 3 folder), cửa sổ hẹp có khung lịch sử mở, ô phóng to che cả ba vùng.

## Đã chốt cho CR-002 (2026-10-17)

- Bố cục: wireframe C (`design.html#cr002`). Cột trái: Folders trên, Active Sessions dưới; dòng Active một dòng (ô vuông trạng thái · tiêu đề · chip tên folder), dòng phụ "giờ · lý do" chỉ khi Needs Approval / Error. Session History Panel là thẻ bo góc 280px có khoảng hở, header: tên folder · New Session · ✕.
- Màu: bản 1 · Tint phẳng, dark (`design.html#cr002-v1-flat`). Section Folders nền `--section-folders` (sky-3), Active Sessions nền `--section-active` (sand-3), phủ hết bề ngang, ngăn bằng viền 1px `--border`. Chip folder: viền `--border`, chữ `--muted-foreground`. Folder đang chọn: nền `--accent`; đang chọn mà có Status Highlight thì giữ nền trạng thái + `ring-1 ring-ring` (như folder đang chọn trong `design.html#cr001-v1-soft-fill`). Trạng thái giữ soft fill của CR-001.
- Token mới: `--section-folders`, `--section-active` (tokens.css, tailwind.preset.js `section.folders` / `section.active`).
- Trạng thái: `design.html#cr002-states`.
