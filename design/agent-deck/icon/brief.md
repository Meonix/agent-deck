# Design brief — icon app agent-deck

Nguồn: `../brief.md`, `product/agent-deck/BRD.md` (Approved v2.1). Icon hiện tại là logo mặc định của Tauri (`src-tauri/icons/icon.png`).

## Nền tảng

App desktop Tauri 2 — macOS 14+ trước (Dock, Launchpad, Cmd+Tab), Windows 11 sau (taskbar, `.ico`).
Nguồn vẽ: một SVG 1024×1024, xuất ra bộ `src-tauri/icons/` bằng `tauri icon`.

## Người dùng

Một người dùng, cũng là PO. Lập trình viên quen terminal, chạy song song nhiều phiên Claude Code.

## Icon phải kể

1. **Ý chính: dấu nhắc terminal** (`>_` hoặc `❯`) — nhận ra ngay "app terminal".
2. **Phụ ý: nhiều khung xếp** — dấu nhắc nằm trên khung trước, phía sau ló 1–2 khung khác: nhiều phiên, chơi chữ "deck".
3. Không trùng Terminal / iTerm / Warp / Ghostty — phần "khung xếp" là chỗ tạo khác biệt.

## Ràng buộc

- Đọc được ở 16px (taskbar Windows, danh sách Finder) và 32px (Cmd+Tab nhỏ); ở 16px phần khung sau được phép nhoè, dấu nhắc phải còn.
- macOS: khung squircle theo lưới icon macOS (824×824 trong canvas 1024, bo ~185px).
- Màu lấy từ `../tokens.css` (slate + iris, trạng thái green/amber/red) — không thêm màu thương hiệu mới.

## Cần trình bày để chốt

Một file HTML: 2–3 bố cục xám (bước 5) → 3–4 bản màu trên bố cục đã chọn (bước 6) → "trạng thái" của icon: 16/32/64/128/512px, nền Dock sáng/tối, cạnh icon các app terminal khác (bước 7).

## Đã chốt — Approved (2026-10-17)

- Ý chính: dấu nhắc `>_`; phụ ý: hai khung xếp ló góc trên-phải (bố cục A · Xếp chéo, `wireframe.html`).
- Màu: bản 2 · Nền iris — nền iris-9, khung sau iris-8 / iris-dark-11, khung trước slate-dark-1, `>` slate-dark-12, `_` amber-9. Không thêm token.
- File nguồn: `agent-deck-icon.svg` (≥ 48px) và `agent-deck-icon-small.svg` (16–32px: một khung sau, nét dày, không đổ bóng).
- Trang chốt: `index.html` (cỡ, Dock sáng/tối + badge, Cmd+Tab, Finder, taskbar Windows, đơn sắc giả lập, cạnh app terminal khác).
- Chưa làm: xuất bộ `src-tauri/icons/` — việc của dev (`tauri icon`), không sửa ở bước thiết kế.
