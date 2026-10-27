# References — agent-deck

Chụp bằng Playwright ngày 2026-10-16, viewport 1440×900. Ảnh trong `refs/`.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 1 | Linear | https://linear.app | `refs/linear-home.png` | Sidebar tối nhóm mục có tiêu đề nhỏ ("Workspace", "Favorites"); panel chính bo góc nổi trên nền đen |
| 2 | Raycast | https://www.raycast.com | `refs/raycast-home.png` | Thanh header dạng viên thuốc bo tròn, viền mảnh 1px, nút chính nền sáng trên nền tối |
| 3 | Raycast AI | https://www.raycast.com/core-features/ai | `refs/raycast-ai-crop.png` | Danh sách trái nhóm theo mốc thời gian ("Recent", "Last week") — hợp cho Session List; dòng hai tầng tiêu đề + phụ đề mờ |
| 4 | Superset | https://superset.sh | `refs/superset-app.png` | Sidebar workspace có chấm trạng thái màu trước tên; toast "finished · worked for 7s" nổi góc dưới vùng terminal |
| 5 | cmux | https://www.cmux.dev | `refs/cmux-app.png` | Mục sidebar tô xanh khi agent cần người; header nhỏ trên mỗi ô split kèm nút chia/đóng |
| 6 | Nimbalyst | https://nimbalyst.com | `refs/nimbalyst-home.png` | Bố cục 3 vùng (cây file · nội dung · chat); nút accent indigo đặc; chip trạng thái dạng dropdown |
| 7 | Conductor | https://www.conductor.build | `refs/conductor-home.png` | Sidebar sáng: "Pinned" / "My workspaces", thời gian tương đối canh phải ("22h", "10h"); chip xanh "Ready to merge" |
| 8 | Warp | https://www.warp.dev | `refs/warp-home.png` | Chú giải trạng thái bằng ô vuông nhỏ (queued · working · waiting · shipped) — gọn cho cột Status Board |
| 9 | Collect UI · Dashboard | https://collectui.com/challenges/dashboard | `refs/collectui-dashboard.png` | Thẻ số liệu lớn trên nền tối (thumbnail thứ 3) — gợi ý cho màn Status Latency |

Ảnh phụ: `refs/superset-home.png`, `refs/cmux-home.png` (phần hero, không dùng làm reference riêng).
Đã thử nhưng bỏ: https://linear.app/docs/board-layout — trang chỉ có chữ, không thấy giao diện board.

## CR-001 (2026-10-17) — cột trái báo trạng thái, phóng to ô, xoá phiên

Chụp bằng Playwright ngày 2026-10-17, viewport 1440×900. Dùng lại #3, #4, #5, #7 ở trên; thêm ba mục dưới.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 10 | Linear Inbox | https://linear.app/docs/inbox | `refs/linear-inbox.png` | Tab "Priority 4 / Other 12" có badge đếm cạnh nhãn; dòng hai tầng (tiêu đề + lý do mờ), biểu tượng trạng thái và giờ canh phải — mẫu cho dòng phiên có dòng phụ "giờ · lý do" |
| 11 | Zed | https://zed.dev | `refs/zed-home.png` | Danh sách thread agent bên trái: dòng chọn tô nền xám, chấm màu trước tiêu đề, dòng phụ "branch · 4m"; header panel có nút ⤢ phóng to cạnh + và ⋯ |
| 12 | iTerm2 Split Panes | https://iterm2.com/features.html | `refs/iterm2-features.png` | Header ô split mỏng một dòng, nút ✕ trái và ≡ phải — giữ header ô gọn khi thêm nút phóng to |

Đã thử nhưng bỏ: https://ghostty.org (chỉ có ảnh ASCII, không thấy giao diện ô), https://slack.com/features (sidebar chỉ có mục chọn tô nền, không có badge đếm).

## CR-002 (2026-10-17) — Active Sessions, Session History Panel, tint hai section

Chụp bằng Playwright ngày 2026-10-17, viewport 1440×900, chờ 5–6 giây cho trang tải. Dùng lại #1, #3, #6, #7, #11 ở trên; thêm ba mục dưới.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 13 | Cursor | https://cursor.com | `refs/cursor-home.png` | Cột trái chia section theo trạng thái "IN PROGRESS 1" / "READY FOR REVIEW 4" (nhãn nhỏ in hoa + số đếm); cột giữa riêng cho nội dung đang chọn rồi mới tới vùng làm việc — mẫu cho Active Sessions + Session History Panel |
| 14 | GitHub Desktop | https://desktop.github.com | `refs/github-desktop.png` | Cột danh sách hẹp có header "Changes 3 / History" nằm giữa toolbar và vùng diff; nền cột hơi khác nền vùng chính, ngăn bằng viền 1px |
| 15 | Superhuman Go | https://superhuman.com | `refs/superhuman-home.png` | Panel phụ cạnh nội dung, nền tint rất nhạt, tách bằng viền mảnh, có nút đóng/thu ở header — mẫu cho khung lịch sử đóng được |

Đã thử nhưng bỏ: https://linear.app/docs/sidebar (404), https://code.visualstudio.com/docs/copilot/chat/chat-sessions (chỉ có chữ), https://chatgpt.com/codex (trang trắng, cần đăng nhập), https://linear.app/agents (không thấy sidebar).

## CR-003 (2026-10-17) — nút Shell và Pane Shell trong ô

Chụp bằng Playwright ngày 2026-10-17, viewport 1440×900; hai ảnh VS Code cắt từ ảnh full-page của trang docs. Dùng lại #5, #11, #12 ở trên; thêm ba mục dưới.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 16 | VS Code · Terminal Basics | https://code.visualstudio.com/docs/terminal/basics | `refs/cr003-vscode-terminal-panel.png` | Panel terminal dưới có dải header mỏng: nhãn "TERMINAL" trái, tên shell + nút (+, chia, xoá, ^ phóng, × ẩn) phải; bật/tắt bằng một nút, đóng panel không giết shell |
| 17 | VS Code · Managing terminals | https://code.visualstudio.com/docs/terminal/basics#_managing-terminals | `refs/cr003-vscode-terminal-tabs.png` | Tên shell kèm biểu tượng nhỏ canh phải header; tài liệu ghi icon cạnh tên terminal đổi khi trạng thái đổi (chuông, dấu check) — mẫu cho chấm báo trên nút Shell |
| 18 | Tabby | https://tabby.sh | `refs/cr003-tabby.png` | Hai shell chia cạnh nhau trong một cửa sổ, vách ngăn chỉ là một đường mảnh 1px, không thanh kéo to — vách kéo giữa Claude Code và Pane Shell nên mảnh như vậy |

Đã thử nhưng bỏ: https://zed.dev/docs/terminal và https://www.jetbrains.com/help/idea/terminal-emulator.html (chỉ có chữ, không có ảnh panel), https://www.waveterm.dev và https://www.warp.dev/terminal (phần đầu trang chỉ là hero, không thấy giao diện).

## Visual Overhaul · Signal Deck (2026-10-27)

Không chụp được trang — Playwright bị chặn quyền chạy, headless Brave treo; đọc bằng WebFetch, không xem được hình. Cột ảnh để trống.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 19 | cmux | https://github.com/manaflow-ai/cmux | | Pane cần người có vòng sáng, tab sidebar sáng lên kèm badge chưa đọc — mẫu cho quầng vàng ô Needs Approval |
| 20 | Ghostty config | https://ghostty.org/docs/config/reference | | `unfocused-split-opacity` (0.15–1) + `unfocused-split-fill` làm mờ ô không focus; `split-divider-color` vạch mảnh; `palette` 0–15 cho ANSI |
| 21 | GitHub Primer · Color | https://primer.style/product/primitives/color/ | | Trạng thái theo cặp emphasis (đặc) + muted (nền nhạt); viền muted có alpha — mẫu cho marker đặc + dòng tô nhạt |
| 22 | Linear redesign | https://linear.app/now/how-we-redesigned-the-linear-ui | | Giảm màu xanh ở chrome cho trung tính (lý do bỏ slate lấy gray); Inter cho UI |
| 23 | Vercel Geist · Colors | https://vercel.com/geist/colors | | Phân vai theo bậc: nền 100–300, viền 400–600, chữ 900–1000 — khớp quy ước bậc Radix |
| 24 | Lucide | https://lucide.dev/license | | Bộ icon thay ký tự unicode; ISC (icon gốc Feather: MIT) |
| 25 | JetBrains Mono | https://github.com/JetBrains/JetBrainsMono | | Font mono cho terminal, header ô, tiêu đề section; OFL-1.1, 8 weight |
| 26 | Inter | https://github.com/rsms/inter | | Font UI; OFL-1.1, có bản variable |
