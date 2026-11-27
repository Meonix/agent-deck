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

## Sidebar Refresh (2026-11-02) — phối màu và bố cục cột trái

Chụp bằng Playwright ngày 2026-11-02, viewport 1440×900, cắt sát cột trái của ảnh app trên trang. Ảnh trong `refs/sidebar/`.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 19 | Linear | https://linear.app | `refs/sidebar/linear-sidebar.png` | Tiêu đề nhóm nhỏ, mờ, có ▾ ("Workspace", "Favorites"); hành động header chỉ là icon (tìm, soạn) ở góc phải; mục đang chọn nền xám nhạt bo góc, không viền |
| 20 | Conductor | https://www.conductor.build | `refs/sidebar/conductor-sidebar.png` | Mục đang mở có vạch màu 2px ở mép trái thay vì tô cả dòng; thời gian canh phải mờ; tiêu đề nhóm "Pinned" / "My workspaces" nhỏ, xám |
| 21 | Paradev (superset.sh) | https://superset.sh | `refs/sidebar/superset-sidebar.png` | Nhóm in hoa nhỏ có số đếm canh phải và ▸ thu gọn; dòng đang chọn nền ấm + vạch cam mép trái; chấm trạng thái màu trước tên |
| 22 | cmux | https://www.cmux.dev | `refs/sidebar/cmux-sidebar.png` | Badge số tròn màu nhấn trước tên khi agent chờ người; nút + và chuông ở thanh trên cùng dạng icon; nền cột một màu, phân dòng bằng khoảng trắng |
| 23 | T3 Code | https://t3.codes | `refs/sidebar/t3-sidebar.png` | Một nền cột liền, các nhóm "Working 1 ›" / "Settled 43 ›" tách bằng chữ + số, không khối màu; dòng hai tầng: project nhỏ + giờ phải, tiêu đề đậm, nhánh mờ; nhóm đang chạy nổi bằng thẻ nền nhẹ |
| 24 | Cursor | https://cursor.com | `refs/sidebar/cursor-agents-list.png` | Header cột chỉ có một icon + ở góc phải; dòng đang chọn là pill nền xám bo lớn; chấm đỏ nhỏ trên avatar báo cần chú ý |

Đã thử nhưng bỏ: https://arc.net (trang chia tay, không thấy sidebar), https://culturedcode.com/things/ (chỉ có icon app), https://zed.dev/agentic, https://www.warp.dev/agents, https://www.raycast.com/notes (phần đầu trang không có cột trái), https://openai.com/codex/ (trang trắng).

## Sidebar Refresh vòng 2 · bảng màu (2026-11-02)

Duyệt bằng agent-browser (`ab`, Brave) ngày 2026-11-02. Hex đọc từ trang/raw file, không chép tay. Ảnh trong `refs/sidebar/palettes/`.

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 25 | Rosé Pine palette | https://rosepinetheme.com/palette/ | `refs/sidebar/palettes/rose-pine-palette.png` | Gold #f6c177, Love #eb6f92, Rose #ebbcba trên nền base #191724 — màu ấm dịu trên nền gần đen; bỏ vì Love/Rose quá gần đỏ Error |
| 26 | Kanagawa | https://github.com/rebelot/kanagawa.nvim (lua/kanagawa/colors.lua) | — (đọc file) | boatYellow2 #C0A36E, sakuraPink #D27E99, oldWhite #C8C093; nền "winter*" là nền màu tối dùng cho diff — đúng kiểu tint section |
| 27 | Gruvbox | https://github.com/ellisonleao/gruvbox.nvim (lua/gruvbox.lua) | — (đọc file) | neutral_yellow #d79921, neutral_orange #d65d0e, dark4 #7c6f64 — đất son / cam cháy / nâu đá |
| 28 | Color Hunt · Dark Warm | https://colorhunt.co/palettes/dark-warm | `refs/sidebar/palettes/colorhunt-dark-warm.png` | Bộ "cà phê" #D5CEA3 · #A56F63 · #DCA06D và nhiều bộ đỏ–hồng–nâu trên nền tối |

| 29 | Palette "Сталь" (Holst), ảnh user gửi trong chat 2026-11-02 | — (ảnh trong chat, reference-only) | — | 7 bậc thép: #10161C · #1F2C38 · #33475A · #4E6A83 · #8199AE · #B7C6D3 · #E7EDF2. User chốt dùng bộ này cho tint section (thay sky / indigo / teal) |

## One UI (2026-11-20) — thử giao diện One UI đầy đủ

Chụp bằng Playwright ngày 2026-11-20, viewport 1440×900, full-page, chờ 4 giây. Ảnh trong `refs/oneui/`. Nguồn: bộ hướng dẫn One UI chính thức của Samsung (developer.samsung.com/one-ui).

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 16 | One UI · Basic layout | https://developer.samsung.com/one-ui/layout/basic.html | `refs/oneui/layout-basic.png` | Chia màn: viewing area ở trên (tiêu đề to canh giữa, lề rộng, không có nút) và interaction area ở dưới; danh sách gom thành khối bo góc lớn, subheader nhỏ giữa các khối |
| 17 | One UI · App bar | https://developer.samsung.com/one-ui/comp/app-bar.html | `refs/oneui/comp-app-bar.png` | App bar mở rộng thu về dạng gọn khi cuộn; "dynamic title" thay tên app bằng một câu thông tin (số tin chưa đọc, giờ báo thức) — đúng cho "2 need you"; tối đa 3 nút hành động bên phải |
| 18 | One UI · Lists | https://developer.samsung.com/one-ui/comp/list.html | `refs/oneui/comp-list.png` | Dòng hai tầng (main text + subtext/value text màu nhấn), ngăn mảnh trong khối, icon tròn màu trước tên; subheader nhỏ xám gom nhóm — mẫu cho Folders / Active / Stashed |
| 19 | One UI · Dialog | https://developer.samsung.com/one-ui/comp/dialog.html | `refs/oneui/comp-dialog.png` | Hộp xác nhận bo góc lớn, nút chữ màu nhấn chia đôi bằng vạch dọc, không viền nút; menu ngữ cảnh dạng thẻ nổi không tiêu đề — mẫu cho Close/Stash/Delete Dialog |
| 20 | One UI · Visual depth | https://developer.samsung.com/one-ui/structure/visual-depth.html | `refs/oneui/structure-visual-depth.png` | Ba lớp chiều sâu: blur + dim nền khi mở lớp không liên quan, chỉ bóng mềm khi lớp liên quan; dim một bậc, không chồng nhiều bậc — áp cho ô phóng to và hộp thoại |
| 21 | One UI · Large screen layout | https://developer.samsung.com/one-ui/largescreen-and-foldable/large_screen_layout.html | `refs/oneui/largescreen-and-foldable-large-screen-layout.png` | Màn lớn: menu luôn hiện cạnh nội dung (list–detail), pop-up nhỏ thay vì đổi cả màn, lưới thẻ bo góc nhiều cột — mẫu cho cột trái + Session History Panel + lưới ô |
| 22 | One UI · Color system | https://developer.samsung.com/one-ui/color/system.html | `refs/oneui/color-system.png` | Màu đặc, bão hoà vừa trong dải cho phép; nền đơn sắc dịu (mono tone) cho cả light/dark, màu chỉ dành cho điểm nhấn và icon |
| 23 | One UI Docs (trang web của Samsung) | https://developer.samsung.com/one-ui/index.html | `refs/oneui/dev-docs.png` | Ba thẻ trắng bo góc lớn (~24px) nổi trên nền xám nhạt, khoảng hở 20px, mục đang chọn nền xanh nhạt bo tròn — bản One UI cho màn rộng, gần agent-deck nhất |

Đã thử nhưng bỏ: https://design.samsung.com/global/contents/one-ui/ (chỉ có hero chữ), https://www.samsung.com/us/one-ui/ và https://www.samsung.com/us/apps/dex/ (bị hộp cookie che, không thấy giao diện), https://www.samsung.com/global/galaxy/one-ui/ (trang lỗi "not available").

## CR-016 · theo agent-deck-remote (2026-11-24)

Reference chính: các thiết kế đã chốt của agent-deck-remote (đã mở, file trên máy): `agent-deck-remote/design/web-foundation`, `cot-trai`, `workspace`, `mo-lai-phien`, `tien-do`, `xem-file`. Ảnh chụp bên dưới ở `refs/cr016/`, chụp bằng Playwright 1440×900 ngày 2026-11-24, reference-only.

nguồn · link · lấy gì
cmux · https://cmux.com · tab dọc có chữ trạng thái, "notification rings" khi agent cần mình, chia ô ngang/dọc trong một tab
Conductor · https://www.conductor.build · danh sách workspace có thời gian bên phải, hàng tab phiên gạch chân trên vùng chat, tool call gộp "▸ 5 tool calls", cột file đổi có +/−
Superset (Paradev) · https://superset.sh · mục Pinned trong cột trái có chấm trạng thái nhỏ ở cuối dòng
Happy · https://happy.engineering · cây task lồng dưới nhóm có +/− dòng code, ô nhập bo tròn có nút + đính kèm và nút gửi tròn ở chân
Warp · https://www.warp.dev/agents · chia hai ô agent cạnh nhau, mỗi ô có tiêu đề riêng và nút thao tác ở góc phải
Nimbalyst · https://www.nimbalyst.com · cột file dạng cây, khung chat có tên người gửi + giờ, "Finished in 2ms" dưới lượt trả lời
VS Code · https://code.visualstudio.com/docs/copilot/chat/chat-sessions · danh sách phiên để mở lại, nhóm theo workspace (chỉ có chữ, không có ảnh giao diện)

Đã mở mà không dùng: Linear (https://linear.app/features — trang chỉ có lưới icon, không có giao diện), Zed (https://zed.dev/agentic — ảnh editor quá mờ để lấy ý).

## CR-020 · One UI trên bố cục CR-016 (2026-11-27)

Dùng lại bộ One UI chụp 2026-11-20 (`refs/oneui/`, Playwright 1440×900 full-page). Ngày 2026-11-27 mở lại cả 8 link: đều trả 200; xem lại ảnh dev-docs, comp-dialog, comp-list, large-screen-layout. "Lấy gì" viết lại cho bố cục hiện tại (cây folder, ô có View Switch, Composer).

| # | Nguồn | Link | Ảnh | Lấy gì |
| --- | --- | --- | --- | --- |
| 1 | One UI Docs | https://developer.samsung.com/one-ui/index.html | `refs/oneui/dev-docs.png` | Ba thẻ trắng bo ~24px nổi trên nền xám nhạt, hở ~20px; mục đang chọn nền xanh nhạt bo tròn — khung chính: thẻ Sidebar + thẻ từng ô trên canvas |
| 2 | One UI · Lists | https://developer.samsung.com/one-ui/comp/list.html | `refs/oneui/comp-list.png` | Dòng hai tầng, icon tròn màu trước tên, vạch mảnh trong khối, subheader nhỏ xám giữa các khối bo — Folder Tree: mỗi folder một khối, phiên là dòng con có icon tròn trạng thái; "Folder khác", "Để dành" là subheader |
| 3 | One UI · Dialog | https://developer.samsung.com/one-ui/comp/dialog.html | `refs/oneui/comp-dialog.png` | Hộp bo lớn, tiêu đề đậm, nút chữ màu nhấn chia vạch dọc, không viền nút; menu ngữ cảnh là thẻ nổi không tiêu đề — Close/Stash/Delete Dialog, Session Chooser, Folder Menu. Samsung đặt hộp xác nhận ở đáy màn điện thoại; agent-deck đặt giữa (CR-020) như hộp thông tin của họ |
| 4 | One UI · Visual depth | https://developer.samsung.com/one-ui/structure/visual-depth.html | `refs/oneui/structure-visual-depth.png` | Blur + dim một bậc khi mở lớp không liên quan, bóng mềm cho lớp liên quan — scrim hộp thoại; bóng cho menu "/" "@", Folder Menu, Toast |
| 5 | One UI · Large screen layout | https://developer.samsung.com/one-ui/largescreen-and-foldable/large_screen_layout.html | `refs/oneui/largescreen-and-foldable-large-screen-layout.png` | Menu luôn hiện cạnh nội dung, lưới thẻ nhiều cột, pop-up nhỏ thay vì đổi cả màn — Sidebar cạnh Pane Grid, Session Chooser là pop-up |
| 6 | One UI · App bar | https://developer.samsung.com/one-ui/comp/app-bar.html | `refs/oneui/comp-app-bar.png` | Thanh gọn, tối đa 3 nút hành động bên phải — tiêu đề ô: tên phiên trái, View Switch dạng viên, Để dành · Phóng to · × phải |
| 7 | One UI · Basic layout | https://developer.samsung.com/one-ui/layout/basic.html | `refs/oneui/layout-basic.png` | Interaction area ở dưới, trong tầm tay — Composer và Approval Strip là khối bo lớn ở đáy ô |
| 8 | One UI · Color system | https://developer.samsung.com/one-ui/color/system.html | `refs/oneui/color-system.png` | Nền đơn sắc dịu, màu chỉ cho điểm nhấn và icon — giữ màu tokens.css, màu trạng thái chỉ ở icon tròn, chấm và dòng tô |
