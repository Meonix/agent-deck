# Design brief — agent-deck

Nguồn: `product/agent-deck/BRD.md` (Approved v2.0), `product/agent-deck/SRS.md` (Baselined v1.1) mục 7. CR-001 (2026-10-17) bỏ Status Board, thêm phóng to ô và xoá phiên.

## Nền tảng

App desktop (Tauri 2), giao diện web React/TS, chạy macOS 14+ và Windows 11. Nhãn tiếng Anh (SRS-NFR-008).

## Người dùng

Một người dùng, cũng là PO. Lập trình viên quen terminal, chạy song song nhiều phiên Claude Code.

## Giá trị cốt lõi

1. Không sót phiên chờ duyệt hoặc lỗi — Status Highlight (màu nền + badge) trên dòng phiên, dòng folder, và badge của ô phóng to phải nhìn thấy ngay (BO-01).
2. Mở lại phiên cũ ≤ 3 thao tác: chọn folder → chọn phiên → Resume (BO-02).
3. Ô terminal chiếm phần lớn màn hình, dùng như terminal thường, phóng to được ra cả cửa sổ (BR-05). Bỏ cột Status Board là để trả chỗ cho ô.

## Cảm giác

Hiện đại kiểu Linear / Raycast: thoáng, bo góc, thẻ nổi, chữ vừa. Đánh đổi đã biết: tốn chỗ hơn
cho terminal so với kiểu VS Code / Zed — bố cục phải bù bằng cách cho vùng ô chiếm tối đa.

## Màn hình (SRS mục 7)

| Màn hình | Vùng | SRS-FR |
| --- | --- | --- |
| Cửa sổ chính | Workspace List — thêm, bỏ, chọn folder; nhãn `Missing`; dòng folder tô theo trạng thái gấp nhất + badge đếm | SRS-FR-001 … SRS-FR-006, SRS-FR-040 |
| Cửa sổ chính | Session List — phiên của folder, `Live`, Resume, New Session; dòng phiên tô + badge trạng thái, dòng phụ "giờ · lý do" khi Needs Approval / Error, bấm dòng để tới ô; nút Delete từng dòng, hộp xác nhận | SRS-FR-007 … SRS-FR-020, SRS-FR-032, SRS-FR-033, SRS-FR-037, SRS-FR-047 … SRS-FR-050 |
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

- Bố cục: wireframe A · Tô cả dòng (`stories/WireframeCr001.stories.js` › A, A · Ô phóng to). Delete nằm cạnh Resume trên dòng đang chọn.
- Màu: bản 1 · Soft fill trên nền P4 Dark attention (`stories/ProposalCr001.stories.js` › V1SoftFill). Dòng phiên và dòng folder tô nền `--*-bg` (bậc 3), badge chip có ô vuông, dòng phụ "giờ · lý do" màu `--*-foreground`. Không thêm token.
- Ô phóng to: badge "N need you" trên header ô, màu Error nếu có phiên Error, còn lại màu Needs Approval.
- Trạng thái: `stories/StatesCr001.stories.js`. Hàm vẽ dùng chung: `stories/renderCr001.js`.
