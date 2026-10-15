# Design brief — agent-deck

Nguồn: `product/agent-deck/BRD.md` (Approved v1.0), `product/agent-deck/SRS.md` (Baselined v1.0) mục 7.

## Nền tảng

App desktop (Tauri 2), giao diện web React/TS, chạy macOS 14+ và Windows 11. Nhãn tiếng Anh (SRS-NFR-008).

## Người dùng

Một người dùng, cũng là PO. Lập trình viên quen terminal, chạy song song nhiều phiên Claude Code.

## Giá trị cốt lõi

1. Không sót phiên chờ duyệt hoặc lỗi — thẻ trên Status Board phải nhìn thấy ngay (BO-01).
2. Mở lại phiên cũ ≤ 3 thao tác: chọn folder → chọn phiên → Resume (BO-02).
3. Ô terminal chiếm phần lớn màn hình, dùng như terminal thường (BR-05).

## Cảm giác

Hiện đại kiểu Linear / Raycast: thoáng, bo góc, thẻ nổi, chữ vừa. Đánh đổi đã biết: tốn chỗ hơn
cho terminal so với kiểu VS Code / Zed — bố cục phải bù bằng cách cho vùng ô chiếm tối đa.

## Màn hình (SRS mục 7)

| Màn hình | Vùng | SRS-FR |
| --- | --- | --- |
| Cửa sổ chính | Workspace List — thêm, bỏ, chọn folder; nhãn `Missing` | SRS-FR-001 … SRS-FR-006 |
| Cửa sổ chính | Session List — phiên của folder, `Live`, Resume, New Session | SRS-FR-007 … SRS-FR-020 |
| Cửa sổ chính | Pane Grid — các ô terminal, header ô, chia phải/xuống, đóng ô | SRS-FR-014 … SRS-FR-030, SRS-FR-036 |
| Cửa sổ chính | Status Board — 3 cột Running / Needs Approval / Error, thẻ bấm được | SRS-FR-031 … SRS-FR-038 |
| Status Latency | Tỉ lệ đổi trạng thái hiện ≤ 3 giây trong 14 ngày | SRS-FR-039 |

## Trạng thái cần vẽ (bước 7)

Empty (chưa có folder · folder chưa có phiên), Loading danh sách phiên, Error (phiên không đọc được,
Folder not found, Claude Code could not be started, Status unavailable), Dense (4+ ô, nhiều thẻ),
cửa sổ hẹp.
