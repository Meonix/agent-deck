---
req-doc: srs
slug: agent-deck
scope: product
status: Baselined v1.19 (2026-11-28)
source: product/agent-deck/BRD.md
---
# SRS — agent-deck

<!-- Per ISO/IEC/IEEE 29148. Say what the system does, not how.
     Explanations in Vietnamese; EARS requirement sentences in English, one SHALL. -->

## 1. Giới thiệu

### Mục đích

Đặc tả hành vi của agent-deck, ứng dụng desktop cá nhân để làm việc với nhiều phiên Claude Code
cùng lúc, phục vụ BO-01 (không sót phiên chờ duyệt hoặc lỗi), BO-02 (mở lại phiên cũ ≤ 3 thao tác)
và BO-05 (làm việc với phiên không cần gõ trong terminal) của BRD v7.0.

### Phạm vi

Trong phạm vi: BR-01 đến BR-08, BR-11 đến BR-16 của BRD. Ngoài phạm vi: như BRD mục 5. Cụ thể, phiên Claude Code mở
ngoài agent-deck vẫn hiện trong lịch sử phiên nhưng không có trạng thái và không có Status Highlight.

### Người dùng

Một người dùng duy nhất, cũng là PO. Người dùng quen terminal và Claude Code.

### Giả định

| ID | Giả định | Ai cần xác nhận |
| --- | --- | --- |
| A-01 | Máy đã cài sẵn Claude Code và đã đăng nhập (từ BRD) | PO |
| A-02 | Không cho bỏ một folder khỏi danh sách khi folder đó còn ô đang mở | PO |
| A-03 | Danh sách phiên xếp theo thời điểm hoạt động gần nhất, mới nhất ở trên | PO |
| A-04 | Mở một phiên đã đang mở trong một ô thì chuyển tới ô đó, không mở bản thứ hai | PO |
| A-05 | Đóng ô có phiên đang chạy hoặc đang chờ duyệt thì phải xác nhận trước | PO |
| A-06 | "Cần duyệt" gồm cả lúc Claude Code xin phép làm một thao tác và lúc nó hỏi người dùng chọn phương án | PO |
| A-07 | Ứng dụng không gửi dữ liệu phiên ra khỏi máy (CR-015 bỏ ngoại lệ tóm tắt của CR-012) | PO |
| A-08 | Bản đầu được kiểm trên Claude Code 2.1.300, bản đang cài trên máy PO ngày 2026-10-15 | PO |
| A-09 | BO-02 kiểm bằng kịch bản demo: mở app → bấm + trên dòng folder → bấm dòng phiên trong Session Chooser, đếm thao tác trên 5 phiên khác nhau (Q-01) | PO |
| A-10 | Deleted (CR-010) | PO |
| A-11 | Deleted (CR-010) | PO |
| A-12 | Deleted (CR-015) | PO |
| A-13 | Ô mở ở Chat | PO |
| A-14 | Mẫu nhận ra Input Ready lấy theo bản Claude Code đang cài lúc làm, kiểm lại mỗi khi lên phiên bản | PO |
| A-15 | Dọn file đính kèm chỉ xoá file cũ hơn 1 giờ mà không ô nào đang dùng | PO |

### Thuật ngữ

| Từ | Nghĩa |
| --- | --- |
| Workspace | Folder làm việc mà người dùng đã thêm vào danh sách |
| Workspace List | Danh sách folder làm việc |
| `Missing` | Workspace mà folder của nó không còn trên máy |
| Session | Một phiên làm việc của Claude Code, gắn với folder nơi nó được bắt đầu |
| Session History | Danh sách phiên đã có trên máy của một workspace |
| Session History Panel | Deleted (CR-016) |
| Active Sessions | Deleted (CR-016) |
| `Live` | Phiên đang mở trong một ô của agent-deck |
| Pane | Một ô trong cửa sổ, chạy đúng một phiên, kèm tối đa một Pane Shell |
| Pane Shell | Terminal chạy shell mặc định của hệ điều hành (không chạy Claude Code), xem ở chế độ Shell của ô; không có trạng thái |
| Status Highlight | Chấm và chữ trạng thái trên Session Row, nền tô cả dòng khi `Needs Approval` hoặc `Error`, số đếm trên dòng workspace, badge trên tiêu đề Maximized Pane |
| Maximized Pane | Ô đang phóng to ra cả cửa sổ |
| `Running` | Đang chạy |
| `Needs Approval` | Cần duyệt |
| `Idle` | Rảnh, chờ yêu cầu mới |
| `Error` | Lỗi |
| `Ended` | Đã kết thúc |
| Thao tác | Một lần bấm chuột hoặc một phím tắt |
| Text Size | Tỉ lệ cỡ của mọi chữ trong cửa sổ so với mặc định, từ 50% đến 200%, mặc định 100% |
| Zoom shortcut | macOS: Cmd + (hoặc Cmd =) để to, Cmd − để nhỏ, Cmd 0 về 100%; Windows: Ctrl thay cho Cmd |
| Session Selection | Các phiên đang được tick trong Session Chooser |
| Drop Zone | Một trong bốn vùng trái, phải, trên, dưới hiện trên một ô khi người dùng kéo tiêu đề một ô khác lên nó |
| Thoát bình thường | Phiên Claude Code kết thúc với mã thoát 0 (`/exit`, Ctrl+D); mọi kiểu kết thúc khác là thoát bất thường |
| Focus Outline | Vòng màu iris dày 2px bên ngoài viền của ô đang focus |
| Row Focus Mark | Dải iris 3px ở mép trái Session Row của ô có Focus Outline |
| Close Dialog | Hộp hiện khi người dùng bấm × trên tiêu đề ô, tiêu đề "Close "<title>"?", ba nút Cancel · Close · Close and move to Trash, cùng các dòng cảnh báo khi ô đang bận; chữ hiện theo Bảng nhãn |
| Sidebar | Cột trái: tiêu đề Agent Deck, Folder Tree, Thêm folder, nút Cài đặt ở chân |
| Stashed Sessions | Nhóm "Để dành (N)" cuối Folder Tree, liệt kê các phiên người dùng đã để dành |
| Stash Dialog | Hộp hiện khi người dùng bấm Stash trên ô đang bận, tiêu đề "Stash "<title>"?", hai nút Cancel · Stash, cùng các dòng cảnh báo như Close Dialog; chữ hiện theo Bảng nhãn |
| Sidebar Toggle | Nút ở giữa theo chiều dọc, sát mép phải Sidebar (Sidebar ẩn: sát mép trái cửa sổ), bấm để ẩn/hiện Sidebar |
| Sidebar shortcut | macOS: Cmd+B; Windows: Ctrl+B |
| Session Goal | Deleted (CR-015) |
| Target Box | Deleted (CR-015) |
| Progress Tracking | Deleted (CR-015) |
| Checkpoint | Deleted (CR-015) |
| Checkpoint List | Deleted (CR-015) |
| Progress Strip | Deleted (CR-015) |
| Tracking Prompt | Deleted (CR-015) |
| Tracking button | Deleted (CR-015) |
| Progress Record | Deleted (CR-015) |
| Status Summary | Deleted (CR-014) |
| Go-to button | Deleted (CR-014) |
| Folder Tree | Cây ở Sidebar: mỗi workspace một dòng, phiên đang mở trong ô của workspace lồng bên dưới |
| Session Row | Dòng phiên trong Folder Tree: chấm trạng thái (icon tròn 28px màu trạng thái), tiêu đề, chữ trạng thái |
| Other Folders | "Folder khác (N)", nhóm thu gọn chứa workspace không có phiên đang mở |
| Folder Menu | Menu ⋯ trên dòng workspace: Xem file, Bỏ folder, Chép đường dẫn |
| Session Chooser | Hộp mở từ nút + trên dòng workspace: nút Phiên mới và danh sách phiên cũ của workspace đó |
| View Switch | Nút chuyển Chat · Term · Shell · Plan trên tiêu đề ô |
| Chat | Chế độ của ô: hội thoại của phiên dạng tin nhắn |
| Term | Chế độ của ô: terminal của phiên Claude Code |
| Shell | Chế độ của ô: Pane Shell |
| Plan | Chế độ của ô: các bước, file đã đổi và kế hoạch của phiên |
| Composer | Ô nhập prompt dưới ô ở Chat và Plan |
| Input Ready | Phiên sẵn sàng nhận prompt từ Composer, theo RULE-12 |
| Approval Strip | Dải duyệt quyền trên Composer |
| Question Card | Thẻ trả lời câu hỏi chọn phương án |
| Activity Bar | Dải trên Composer: công cụ đang chạy, phần context đã dùng, số shell và subagent nền |
| Prompt File | Bản sao file đính kèm trong thư mục dữ liệu của app |
| Files View | Màn xem folder con và file của một workspace |
| Settings Page | Trang Cài đặt |
| Bảng nhãn | Bảng ở mục 7, chữ tiếng Việt của từng nhãn gốc |

## 2. Yêu cầu chức năng

## 2.1 Quản lý folder làm việc

- Luồng chính: 1. Người dùng chọn "Add Folder" và chọn một folder. 2. Folder hiện trong Workspace List. 3. Người dùng bấm + trên dòng folder; Session Chooser mở (2.2).
- Luồng chính (bỏ folder): 1. Người dùng chọn Bỏ folder trong Folder Menu của một workspace. 2. Workspace biến khỏi danh sách; lịch sử phiên trên máy giữ nguyên.
- Luồng thay thế: A1 người dùng huỷ hộp chọn folder → danh sách giữ nguyên.
- Luồng ngoại lệ: E1 folder đã có trong danh sách → chọn mục cũ, không thêm trùng → SRS-FR-003
- Luồng ngoại lệ: E2 folder không còn trên máy → đánh dấu `Missing` → SRS-FR-005
- Luồng ngoại lệ: E3 bỏ folder còn ô đang mở → từ chối → SRS-FR-006

### SRS-FR-001 — Add workspace
When the user selects a folder in the folder picker, the system shall add that folder to the Workspace List.
- Giải thích: thêm folder làm việc mới vào danh sách.
- Ví dụ: chọn `/Users/mionix/Project/mokairo` → danh sách có thêm mục `mokairo`.
- Ví dụ âm: mở hộp chọn rồi bấm Cancel → danh sách không đổi.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-01

### SRS-FR-002 — Persist workspace list
The system shall keep the Workspace List across application restarts.
- Giải thích: thoát app rồi mở lại vẫn thấy đủ các folder đã thêm.
- Ví dụ: danh sách có `mokairo`, `agent-deck`; thoát app, mở lại → vẫn có hai mục đó, cùng thứ tự.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-01

### SRS-FR-003 — Reject duplicate workspace
If the user adds a folder that is already in the Workspace List, then the system shall select the existing entry without adding a second entry.
- Giải thích: không có hai mục trùng một folder.
- Ví dụ âm: danh sách đã có `/Users/mionix/Project/mokairo`, thêm lại folder đó → vẫn một mục, mục đó được chọn.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-01

### SRS-FR-004 — Remove workspace
When the user chooses Bỏ folder in the Folder Menu of a workspace, the system shall delete that workspace from the Workspace List without deleting any Claude Code session history of its folder.
- Giải thích: bỏ khỏi danh sách chỉ là bỏ khỏi app; dữ liệu Claude Code không bị đụng tới. Sửa ở CR-016: trước là "When the user removes a workspace".
- Ví dụ: bỏ `mokairo` có 12 phiên → `mokairo` biến khỏi danh sách; thêm lại `mokairo` → vẫn thấy 12 phiên.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-01

### SRS-FR-005 — Mark missing workspace
If the folder of a workspace no longer exists, then the system shall mark that workspace as `Missing` in the Workspace List.
- Giải thích: folder đã bị xoá hoặc đổi tên ngoài app.
- Ví dụ âm: đổi tên folder `mokairo` thành `mokairo-old`, mở app → mục `mokairo` hiện nhãn `Missing`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-01

### SRS-FR-006 — Reject removing a workspace with open panes
If the user removes a workspace that has an open pane, then the system shall reject the removal and show the message "Close the open sessions of this folder first".
- Giải thích: theo A-02, tránh để ô mồ côi không thuộc folder nào.
- Ví dụ âm: `mokairo` có 2 ô đang mở, chọn Remove → `mokairo` vẫn còn, hiện thông báo trên.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-01

## 2.2 Lịch sử phiên

- Luồng chính: 1. Người dùng bấm + trên dòng workspace. 2. Session Chooser mở, liệt kê các phiên bắt đầu trong đúng folder đó theo RULE-02, mỗi phiên có tiêu đề (RULE-01) và thời điểm hoạt động gần nhất.
- Luồng thay thế: A1 folder chưa có phiên nào → hiện "No sessions yet" → SRS-FR-010
- Luồng thay thế: A2 phiên bắt đầu ở folder con → không thuộc workspace cha theo RULE-02 → SRS-FR-007
- Luồng thay thế: A3 người dùng bấm Đóng, bấm ra ngoài hoặc Esc → hộp đóng → SRS-FR-054
- Luồng ngoại lệ: E1 có phiên không đọc được → báo số phiên không đọc được → SRS-FR-011

### SRS-FR-007 — List sessions of a workspace
When the user chooses + on a workspace row, the system shall open the Session Chooser listing every Claude Code session that belongs to that workspace per RULE-02.
- Giải thích: mỗi lần mở hộp thì danh sách được đọc lại, nên phiên mới tạo ngoài app cũng hiện ra. Sửa ở CR-016: trước là "When the user selects a workspace, … open the Session History Panel".
- Ví dụ: bấm + trên dòng `agent-deck` có 3 phiên → Session Chooser mở giữa màn hình, có nút Phiên mới và 3 dòng phiên cũ; các ô không đổi khổ.
- Ví dụ âm: phiên bắt đầu ở `/Users/mionix/Project/agent-deck/ui` → không có trong danh sách của `agent-deck`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-008 — Show session title and last activity
The system shall show the title per RULE-01 and the last activity time of each session in the Session Chooser.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: phiên có tiêu đề Claude Code đặt là "Scaffold Tauri app", hoạt động lần cuối 2 phút trước → dòng "Scaffold Tauri app · 2 min ago".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-009 — Order session history
The system shall order the Session Chooser by last activity time, newest first.
- Giải thích: theo A-03, phiên vừa làm nằm trên cùng để mở lại ít thao tác nhất. Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: phiên A hoạt động hôm qua, phiên B 2 phút trước → B nằm trên A.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-010 — Empty session history
If the workspace of the Session Chooser has no session, then the system shall show the message "No sessions yet" in the Session Chooser.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ âm: folder mới tinh chưa chạy Claude Code lần nào → hiện "No sessions yet".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-011 — Report unreadable sessions
If one or more sessions of the workspace of the Session Chooser cannot be read, then the system shall show the notice "<N> sessions could not be read" in the Session Chooser.
- Giải thích: theo rủi ro trong BRD, Claude Code đổi cách lưu phiên thì phải báo rõ, không im lặng hiện thiếu. Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ âm: 10 phiên, 2 phiên hỏng → hiện 8 phiên và dòng "2 sessions could not be read".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-012 — Mark live sessions
While a session is open in a pane, the system shall mark that session as `Live` in the Session Chooser.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: phiên "Scaffold Tauri app" đang mở trong một ô → dòng của nó có nhãn `Live`.
- Ví dụ âm: phiên đó đang `Needs Approval` → dòng `Live` trong Session Chooser không có Status Highlight (trạng thái hiện trên Session Row ở Folder Tree, SRS-FR-032).
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-02

### SRS-FR-054 — Close the Session Chooser
When the user chooses Close on the Session Chooser, clicks outside it or presses Esc, the system shall close the Session Chooser.
- Giải thích: mở phiên (SRS-FR-013, SRS-FR-018) cũng đóng hộp. Sửa ở CR-016: trước là đóng Session History Panel bằng Close hoặc bấm lại folder đang chọn.
- Ví dụ: Session Chooser của `agent-deck` đang mở, bấm Đóng → hộp đóng, không ô nào mở.
- Ví dụ: hộp đang mở, bấm ra ngoài hộp hoặc bấm Esc → hộp đóng.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-02

## 2.3 Mở lại phiên cũ

- Luồng chính: 1. Người dùng bấm + trên dòng workspace; Session Chooser mở. 2. Người dùng bấm một dòng phiên trong Session Chooser. 3. Hộp đóng, một ô mới mở, tiếp tục đúng phiên đó với hội thoại cũ, con trỏ nhập liệu ở ô đó.
- Luồng thay thế: A1 phiên đã đang mở trong một ô → chuyển tới ô đó → SRS-FR-015
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối → SRS-FR-016
- Luồng ngoại lệ: E2 không khởi động được Claude Code → báo trong ô → SRS-FR-017

### SRS-FR-013 — Resume a session
When the user chooses a session row in the Session Chooser, the system shall close the Session Chooser and open a new pane that continues that session in its workspace folder.
- Giải thích: hội thoại cũ còn nguyên, người dùng gõ tiếp được ngay. Sửa ở CR-016: trước là "When the user resumes a session from the Session History Panel"; không còn nút Resume riêng, bấm dòng là mở.
- Ví dụ: bấm dòng "Scaffold Tauri app" trong Session Chooser → hộp đóng, ô mới hiện lại hội thoại trước, gõ "tiếp tục" được Claude Code trả lời trong ngữ cảnh cũ.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-03

### SRS-FR-014 — Focus the new pane
When a pane opens, the system shall move keyboard focus to that pane.
- Giải thích: để mở lại phiên tốn đúng 3 thao tác theo BO-02, không phải bấm thêm vào ô. Ô mở ở Chat (SRS-FR-147) thì con trỏ ở Composer (CR-016).
- Ví dụ: resume một phiên → gõ phím ngay, chữ hiện trong ô mới.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-03

### SRS-FR-015 — Focus an already open session
If the user resumes a session that is already open in a pane, then the system shall focus the existing pane without opening a second pane.
- Giải thích: theo A-04, tránh hai ô cùng ghi vào một phiên.
- Ví dụ âm: "Scaffold Tauri app" đang mở ở ô 2, resume lần nữa → ô 2 được focus, số ô không đổi.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-03

### SRS-FR-016 — Reject resuming in a missing workspace
If the user resumes a session of a `Missing` workspace, then the system shall reject the request and show the message "Folder not found".
- Ví dụ âm: `mokairo` đang `Missing`, resume một phiên của nó → không mở ô, hiện "Folder not found".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-03

### SRS-FR-017 — Report Claude Code start failure
If Claude Code cannot be started for a pane, then the system shall show the message "Claude Code could not be started" in that pane.
- Giải thích: trái với A-01 (máy chưa cài, hoặc không tìm thấy Claude Code).
- Ví dụ âm: gỡ Claude Code khỏi máy, resume một phiên → ô mở ra với dòng "Claude Code could not be started".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-03

## 2.4 Bắt đầu phiên mới

- Luồng chính: 1. Người dùng bấm + trên dòng workspace; Session Chooser mở. 2. Người dùng chọn Phiên mới. 3. Hộp đóng, một ô mới mở, chạy phiên Claude Code mới trong folder đó, con trỏ ở ô đó (SRS-FR-014).
- Luồng thay thế: A1 phiên mới xuất hiện ngay trong Session Chooser của workspace và thành Session Row trong Folder Tree → SRS-FR-019, SRS-FR-051
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối → SRS-FR-020
- Luồng ngoại lệ: E2 không khởi động được Claude Code → báo trong ô (như SRS-FR-017)

### SRS-FR-018 — Start a new session
When the user chooses Phiên mới in the Session Chooser, the system shall close the Session Chooser and open a new pane that runs a new Claude Code session in that workspace folder.
- Giải thích: Sửa ở CR-016: trước là "When the user starts a new session in the selected workspace".
- Ví dụ: bấm + trên dòng `agent-deck`, chọn Phiên mới → hộp đóng, ô mới, Claude Code chạy trong `/Users/mionix/Project/personal/agent-deck`.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-04

### SRS-FR-019 — Add the new session to the session history
When a new session starts in a pane, the system shall add that session to the Session Chooser of its workspace.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: bắt đầu phiên mới trong `agent-deck` → danh sách phiên của `agent-deck` có thêm một dòng `Live` ở trên cùng.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-04

### SRS-FR-020 — Reject a new session in a missing workspace
If the user starts a new session in a `Missing` workspace, then the system shall reject the request and show the message "Folder not found".
- Ví dụ âm: `mokairo` đang `Missing`, bấm "New Session" → không mở ô, hiện "Folder not found".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-04

## 2.5 Nhiều ô trong một cửa sổ

- Luồng chính: 1. Người dùng mở thêm phiên (2.3, 2.4); mỗi phiên mở ra bằng cách chia đôi ô đang focus. 2. Người dùng kéo vách ngăn để đổi kích thước. 3. Người dùng gõ và dùng chuột trong từng ô như trong terminal thường. 4. Người dùng bấm × trên ô khi xong, chọn trong Close Dialog → SRS-FR-100.
- Luồng thay thế: A1 người dùng kéo tiêu đề ô thả lên Drop Zone của ô khác → SRS-FR-080, SRS-FR-081, SRS-FR-082
- Luồng thay thế: A2 phiên trong ô thoát bình thường → ô đóng → SRS-FR-083; thoát bất thường → ô báo "Session ended" → SRS-FR-028
- Luồng ngoại lệ: E1 đóng ô khi phiên đang `Running` hoặc `Needs Approval` → Close Dialog thêm cảnh báo → SRS-FR-027
- Luồng thay thế: A5 người dùng chọn Close and move to Trash → SRS-FR-101; không chuyển được vào Thùng rác → SRS-FR-102
- Luồng thay thế: A3 người dùng phóng to một ô ra cả cửa sổ rồi thu về → SRS-FR-041, SRS-FR-042
- Luồng thay thế: A4 đang phóng to mà mở ô mới → thu về trước → SRS-FR-046
- Luồng thay thế: A5 người dùng nhấp đúp tiêu đề ô để phóng to, nhấp đúp lần nữa để thu về → SRS-FR-066, SRS-FR-067
- Luồng thay thế: A6 người dùng bấm vào một ô hoặc bấm Session Row của phiên trong Folder Tree → ô đó có Focus Outline → SRS-FR-087

### SRS-FR-021 — Split right by default
When a new pane opens, the system shall split the focused pane and place the new pane to its right.
- Giải thích: ô đầu tiên chiếm cả vùng làm việc; các ô sau chia từ ô đang focus.
- Ví dụ: đang có 1 ô, resume thêm một phiên → 2 ô cạnh nhau, ô mới bên phải.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-022 — Split down on request — Deleted (CR-005)
Không còn nút `Split Down`; đặt ô xuống dưới ô khác bằng kéo thả (SRS-FR-080, SRS-FR-081).

### SRS-FR-023 — Resize panes
When the user drags the divider between two panes, the system shall resize both panes to follow the divider.
- Ví dụ: kéo vách giữa hai ô sang phải 200 px → ô trái rộng thêm, ô phải hẹp lại tương ứng.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-024 — Reflow on resize
When a pane changes size, the system shall fit the session's terminal content to the new pane size.
- Giải thích: giao diện Claude Code trong ô vẽ lại đúng khổ, không vỡ dòng hay bị cắt.
- Ví dụ: thu hẹp ô còn một nửa → khung nhập của Claude Code vẽ lại vừa ô.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-025 — Behave like a standard terminal
The system shall render colours, cursor movement, scrolling, text selection, copy, paste and mouse input in each pane the same way the operating system's default terminal does for the same Claude Code session.
- Giải thích: "thao tác đầy đủ như terminal thường" trong BR-05; mốc so là Terminal trên macOS, Windows Terminal trên Windows. Áp trong chế độ Term (CR-016).
- Ví dụ: cùng một phiên Claude Code, ô của agent-deck và Terminal.app hiện cùng màu, cùng menu chọn, cuộn và bôi đen copy được như nhau.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-026 — Vietnamese input
The system shall accept Vietnamese text typed through an operating system input method in every pane.
- Giải thích: áp trong chế độ Term và cả cho Composer (CR-016).
- Ví dụ: gõ "sửa lỗi đăng nhập" bằng bộ gõ Telex của macOS → ô nhận đúng chuỗi có dấu, không lặp hay mất ký tự.
- Ví dụ âm: chuỗi "đăng nhập" hiện thành "ddang nhaap" → không đạt.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-027 — Confirm closing a busy pane
If the user chooses × on a pane whose session is `Running` or `Needs Approval`, then the system shall show the warning "Session is still running." in the Close Dialog.
- Giải thích: theo A-05, tránh lỡ tay cắt ngang việc đang làm. Sửa ở CR-009: trước là hộp riêng "Session is still running. Close anyway?".
- Ví dụ âm: ô đang `Running`, bấm × → Close Dialog có dòng "Session is still running."; chọn Cancel → ô vẫn chạy.
- Ví dụ âm: ô `Idle` → Close Dialog không có dòng này.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-028 — Show session ended
When the session in a pane exits abnormally, the system shall show the message "Session ended" in that pane.
- Ví dụ: Claude Code trong ô bị kill → ô hiện "Session ended", vẫn xem lại được nội dung cũ.
- Ví dụ âm: gõ `/exit` → ô đóng (SRS-FR-083), không hiện "Session ended".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-029 — Close pane ends its session
When the user closes a pane, the system shall end the Claude Code session running in that pane.
- Giải thích: không để phiên chạy ngầm không ai thấy.
- Ví dụ: bấm × trên ô có phiên `Idle`, chọn Close → ô biến mất, phiên kết thúc, dòng của nó trong danh sách phiên mất nhãn `Live`.
- Ví dụ âm: chọn Close → phiên vẫn còn trong Session Chooser.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-100 — Close Dialog on pane close
When the user chooses × on a pane header, the system shall show the Close Dialog for that pane before closing it.
- Giải thích: hiện ở mọi trạng thái; Cancel → không đổi gì; Close → đóng ô như SRS-FR-029, phiên còn trong lịch sử; ô chưa có lịch sử phiên trên đĩa (mở phiên mới mà chưa gõ gì) → Close Dialog không có nút Close and move to Trash.
- Ví dụ: ô "Fix login bug" `Idle`, bấm × → hộp "Close "Fix login bug"?" với ba nút Cancel · Close · Close and move to Trash.
- Ví dụ: chọn Cancel → ô vẫn mở.
- Ví dụ âm: gõ `/exit` → ô đóng ngay, không có Close Dialog (SRS-FR-083), phiên vẫn còn trong lịch sử.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-101 — Close and move to Trash
When the user chooses Close and move to Trash in the Close Dialog, the system shall close that pane and then move that session's history to the operating system's trash.
- Giải thích: kết thúc phiên và Pane Shell như SRS-FR-029, SRS-FR-062 trước khi chuyển; phiên biến khỏi Session Chooser như SRS-FR-047; không hỏi thêm hộp "Move … to Trash?" (SRS-FR-048 chỉ áp cho Delete trên Session Chooser).
- Ví dụ: ô "Fix login bug" `Idle`, bấm × → Close and move to Trash → ô biến mất, dòng "Fix login bug" biến khỏi Session Chooser, file phiên nằm trong Thùng rác.
- Ví dụ: ô `Running`, bấm × → hộp có dòng "Session is still running."; Close and move to Trash → phiên kết thúc, ô đóng, phiên vào Thùng rác.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-102 — Report delete failure after close
If the history of a session closed with Close and move to Trash cannot be moved to the trash, then the system shall keep that session in the Session Chooser and show the message "Session could not be deleted".
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ âm: file phiên bị khoá quyền ghi → ô vẫn đóng, phiên còn trong Session Chooser, hiện "Session could not be deleted".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-030 — Pane header
The system shall show the workspace name, the session title and the View Switch in the header of each pane.
- Giải thích: Sửa ở CR-016: thêm View Switch.
- Ví dụ: ô của phiên "Scaffold Tauri app" trong `agent-deck` → tiêu đề ô "agent-deck · Scaffold Tauri app" kèm View Switch Chat · Term · Shell · Plan.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-041 — Maximize pane
When the user chooses Maximize on a pane, the system shall show that pane over the whole application window below the title bar, covering the Sidebar and the other panes.
- Giải thích: các ô khác vẫn chạy, không kết thúc phiên nào. Sửa ở CR-016: trước là "covering the Workspace List, Active Sessions, the Session History Panel and the other panes".
- Ví dụ: 3 ô, phóng to ô 2 → chỉ thấy ô 2; ô 1 và ô 3 vẫn `Running`.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-042 — Restore pane
When the user chooses Restore on the Maximized Pane, the system shall show the previous layout with the same pane sizes.
- Ví dụ: hai ô chia 30/70, phóng to rồi Restore → vẫn 30/70.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-043 — Reflow on maximize
When a pane is maximized or restored, the system shall fit the session's terminal content to the new pane size.
- Giải thích: như SRS-FR-024, áp cho lúc phóng to và thu về.
- Ví dụ: phóng to ô đang chiếm nửa cửa sổ → khung nhập của Claude Code vẽ lại rộng hết cửa sổ.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-046 — Restore before a new pane
If a new pane opens while a pane is maximized, then the system shall restore the layout before placing the new pane.
- Ví dụ: đang phóng to ô 1, bấm New Session → bố cục cũ hiện lại, ô mới nằm bên phải ô 1.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-066 — Maximize on header double-click
When the user double-clicks the header of a pane that is not maximized, the system shall maximize that pane as in SRS-FR-041.
- Ví dụ: 3 ô, nhấp đúp tiêu đề ô 2 → chỉ thấy ô 2, giống bấm Maximize.
- Ví dụ âm: nhấp đúp lên một từ trong vùng terminal → từ đó được bôi đen, ô không phóng to (SRS-FR-025).
- Ví dụ âm: nhấp đúp lên một nút trên tiêu đề ô (View Switch, Để dành, Phóng to, đóng) → chỉ làm việc của nút đó, ô không phóng to.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-067 — Restore on header double-click
When the user double-clicks the header of the Maximized Pane, the system shall restore the previous layout as in SRS-FR-042.
- Ví dụ: hai ô 30/70, nhấp đúp tiêu đề ô 1 → phóng to; nhấp đúp lần nữa → lại 30/70.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-080 — Show drop zones
While the user drags the header of a pane over another pane, the system shall show the Drop Zones of that other pane.
- Ví dụ: 2 ô, kéo tiêu đề ô 1 lên ô 2 → ô 2 hiện 4 vùng trái/phải/trên/dưới, vùng dưới con trỏ sáng lên.
- Ví dụ âm: chỉ có 1 ô → kéo tiêu đề không hiện vùng thả nào.
- Ví dụ âm: kéo từ một nút trên tiêu đề (View Switch, Để dành, Phóng to, đóng) → không bắt đầu kéo.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-081 — Move a pane by drop
When the user drops a pane on a Drop Zone of another pane, the system shall move the dropped pane to that side of the other pane, splitting the other pane in half.
- Giải thích: chỗ cũ của ô được kéo trả cho các ô còn lại; phiên và Pane Shell vẫn chạy, nội dung giữ nguyên, terminal fit lại theo SRS-FR-024.
- Ví dụ: ô 1 | ô 2 cạnh nhau, thả ô 1 vào vùng dưới của ô 2 → ô 2 trên, ô 1 dưới, mỗi ô cao nửa vùng ô, ô 1 vẫn `Running`.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-082 — Cancel a drag
If the user releases a dragged pane outside any Drop Zone or presses Esc while dragging, then the system shall keep the layout unchanged.
- Ví dụ âm: kéo ô 1 rồi thả lên chính ô 1 → bố cục không đổi.
- Ví dụ âm: đang kéo, bấm Esc → vùng thả biến mất, bố cục không đổi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-083 — Close pane on normal exit
When the session in a pane exits normally, the system shall close that pane and give its space to the remaining panes.
- Giải thích: không hỏi xác nhận (SRS-FR-027, SRS-FR-063 chỉ áp khi người dùng đóng ô); Pane Shell của ô kết thúc theo; Session Row của phiên rời Folder Tree; ô đang phóng to thì bố cục còn lại hiện lại.
- Ví dụ: 3 ô ngang, gõ `/exit` ở ô 2 → ô 2 biến mất, ô 1 và ô 3 chia nhau chỗ trống.
- Ví dụ: ô duy nhất, gõ `/exit` → vùng ô trống như lúc chưa mở phiên nào.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-087 — Focused pane outline
While a pane has keyboard focus, the system shall show the Focus Outline around that pane.
- Giải thích: chỉ một ô có Focus Outline tại một thời điểm; viền màu trạng thái (`Running`, `Needs Approval`, `Error`) vẫn hiện bên trong, không bị thay; áp cả cho ô đang phóng to.
- Ví dụ: 3 ô, bấm vào ô 2 → ô 2 có Focus Outline, ô 1 và ô 3 không.
- Ví dụ: ô 2 đang `Needs Approval` và được focus → ô 2 vừa có viền vàng 2px vừa có Focus Outline iris bên ngoài.
- Ví dụ: bấm Session Row của một phiên trong Folder Tree → Focus Outline chuyển sang ô của phiên đó.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-099 — Focused session row mark
While a pane has the Focus Outline, the system shall show the Row Focus Mark on the row of that pane's session in the Folder Tree.
- Giải thích: chỉ một dòng có Row Focus Mark tại một thời điểm; hiện ở mọi trạng thái kể cả `Idle` và `Ended`; Status Highlight của dòng vẫn hiện, không bị thay. Sửa ở CR-016: trước là "in Active Sessions".
- Ví dụ: 2 ô đều `Idle`, bấm vào ô 2 → Session Row của phiên ô 2 có dải iris ở mép trái, dòng ô 1 không.
- Ví dụ: ô 1 đang `Needs Approval` và được focus → Session Row ô 1 vừa tô nền vàng nhạt vừa có dải iris.
- Ví dụ: bấm Session Row ô 1 trong Folder Tree → Row Focus Mark chuyển sang dòng ô 1.
- Ví dụ âm: chưa ô nào được focus → không dòng nào có Row Focus Mark.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

## 2.6 Trạng thái phiên

- Luồng chính: 1. Một phiên trong ô đổi trạng thái theo RULE-03 đến RULE-07. 2. Status Highlight cập nhật trong ≤ 3 giây. 3. Session Row trong Folder Tree hiện chấm và chữ trạng thái; `Needs Approval`, `Error` tô nền cả dòng; dòng folder hiện số đếm theo màu gấp nhất.
- Luồng thay thế: A1 phiên mở ngoài agent-deck → không có trạng thái, không có Status Highlight (BRD mục 5).
- Luồng thay thế: A2 một lệnh hay công cụ Claude Code chạy bị lỗi nhưng lượt vẫn tiếp → không tính `Error` theo RULE-06 → SRS-FR-032
- Luồng thay thế: A3 phiên `Error` nhận yêu cầu mới → `Running`; đóng ô → hết tô, theo RULE-08 → SRS-FR-032
- Luồng thay thế: A4 folder đang thu gọn (SRS-FR-142) → dòng folder vẫn hiện số phiên gấp theo màu gấp nhất → SRS-FR-040
- Luồng thay thế: A5 đang có Maximized Pane → badge trên tiêu đề ô đó → SRS-FR-044
- Luồng ngoại lệ: E1 không theo dõi được trạng thái của một phiên trong ô → báo trên tiêu đề ô → SRS-FR-036
- Luồng ngoại lệ: E2 tín hiệu trạng thái không hợp với trạng thái hiện tại → giữ nguyên → SRS-FR-035

### SRS-FR-031 — Status Board columns — Deleted (CR-001)
Không còn bảng ba cột; trạng thái hiện bằng Status Highlight ở cột trái (SRS-FR-032, SRS-FR-040).

### SRS-FR-032 — Highlight session rows
While a session is open in a pane, the system shall show on its Session Row the status dot and status word of its state and, when the state is `Needs Approval` or `Error`, tint the whole row with that state's colour.
- Giải thích: trạng thái xác định theo RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08 và bảng ở mục 5. Sửa ở CR-016: trước chỉ `Running`, `Needs Approval`, `Error` có Status Highlight (màu nền + badge) trên dòng trong Active Sessions.
- Ví dụ: `Running` chấm xanh dương "Đang chạy"; `Needs Approval` chấm vàng có vòng + nền vàng nhạt "Cần duyệt"; `Idle` chấm xanh lá "Xong lượt"; `Error` chấm đỏ + nền đỏ nhạt "Lỗi"; `Ended` chấm rỗng "Đã kết thúc".
- Ví dụ âm: phiên `Running` → chấm xanh dương, nền dòng không tô.
- Ví dụ âm: Claude Code chạy `npm test` bị fail rồi tự sửa tiếp → dòng vẫn "Đang chạy", không tô nền đỏ (RULE-06).
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-033 — Status detail line
While a Session Row shows the Status Highlight of `Needs Approval` or `Error`, the system shall show below the session title the time the session entered that state and the reason of that state.
- Giải thích: lý do là thao tác đang chờ duyệt (ví dụ "Edit src/main.rs") hoặc loại lỗi (RULE-06). Sửa ở CR-016: "session row" thành "Session Row".
- Ví dụ: Session Row "Scaffold Tauri app" chữ "Cần duyệt", dòng phụ "14:02 · Edit src/main.rs".
- Ví dụ âm: dòng `Running` → không có dòng phụ.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-034 — Status update latency
When a session open in a pane changes state, the system shall update every Status Highlight of that session within 3 seconds.
- Giải thích: ngưỡng lấy thẳng từ BO-01; gồm dòng phiên, dòng folder và badge của Maximized Pane.
- Ví dụ: Claude Code hiện hộp xin phép sửa file lúc 14:02:00 → dòng phiên tô Needs Approval trước 14:02:03.
- Ví dụ âm: dòng đổi màu lúc 14:02:05 → không đạt.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-035 — Ignore inapplicable status signals
If a status signal does not apply to the current state of a session per the table in section 5, then the system shall keep the session in its current state.
- Ví dụ âm: phiên `Ended` nhận tín hiệu "turn finished" → vẫn `Ended`, dòng không tô.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-036 — Report unavailable status
If the system cannot track the state of a session open in a pane, then the system shall show `Status unavailable` in the header of that pane.
- Giải thích: thà báo không biết còn hơn để người dùng tưởng phiên đang rảnh (BO-01).
- Ví dụ âm: Claude Code bản cũ không gửi được tín hiệu trạng thái → tiêu đề ô có nhãn `Status unavailable`, dòng phiên không tô.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-040 — Workspace status
The system shall show on each workspace row the number of its sessions in `Needs Approval` or `Error`, in the colour of the most urgent of them, or else the number of its open sessions in grey.
- Giải thích: thứ tự gấp `Error` > `Needs Approval`; để thấy phiên cần mình cả khi folder đang thu gọn. Sửa ở CR-016: trước là Status Highlight của trạng thái gấp nhất và số phiên ở trạng thái đó, chỉ khi có phiên `Running`, `Needs Approval` hoặc `Error`.
- Ví dụ: `mokairo` có 1 phiên `Error`, 1 phiên `Needs Approval`, 2 phiên `Running` → dòng `mokairo` số "2" màu đỏ.
- Ví dụ: `agent-deck` có 2 phiên đang mở đều `Idle` → dòng `agent-deck` số "2" màu xám.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-051 — List open sessions in the Folder Tree
The system shall list every session open in a pane as a Session Row under the row of its workspace in the Folder Tree.
- Giải thích: Sửa ở CR-016: trước là danh sách phẳng trong Active Sessions, mỗi dòng có tên workspace.
- Ví dụ: `agent-deck` có 1 ô, `mokairo` có 1 ô → dưới dòng `agent-deck` có Session Row "Scaffold Tauri app", dưới dòng `mokairo` có Session Row "Fix login bug".
- Ví dụ âm: phiên cũ không mở trong ô → không có Session Row.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-06

### SRS-FR-052 — Order the Folder Tree
The system shall order the Folder Tree with workspaces that have a session in `Needs Approval` or `Error` first, then the other workspaces with an open session in Workspace List order, and order the Session Rows of a workspace by state urgency `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, then by the time the session entered that state, earliest first.
- Giải thích: phiên cần mình nằm trên cùng (BO-01); cùng luật gấp với SRS-FR-045. Sửa ở CR-016: trước là xếp danh sách phẳng Active Sessions theo trạng thái.
- Ví dụ: Workspace List theo thứ tự `agent-deck`, `mokairo`; `agent-deck` chỉ có ô 1 `Running` từ 14:00; `mokairo` có ô 2 `Error` từ 14:05 và ô 3 `Needs Approval` từ 14:03 → `mokairo` lên đầu, dưới nó ô 2 rồi ô 3; sau đó `agent-deck` với ô 1.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-06

### SRS-FR-053 — Empty active sessions — Deleted (CR-016)
Không còn section Active Sessions; workspace không có phiên mở vào Other Folders (SRS-FR-141).

### SRS-FR-044 — Maximized pane status badge
While a pane is maximized and at least one other session open in a pane is `Needs Approval` or `Error`, the system shall show in the header of the Maximized Pane a badge with the number of those sessions.
- Giải thích: cột trái bị che khi phóng to (SRS-FR-041), badge giữ BO-01. Badge màu Error nếu có ít nhất một phiên `Error`, còn lại màu Needs Approval.
- Ví dụ: phóng to ô 1, ô 3 sang `Needs Approval` lúc 14:02:00 → tiêu đề ô 1 có badge "1" trước 14:02:03.
- Ví dụ âm: các ô khác chỉ `Running` → không có badge.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

## 2.7 Chuyển tới ô từ dấu báo trạng thái

- Luồng chính: 1. Người dùng bấm một Session Row trong Folder Tree. 2. Ô của phiên đó được focus, sẵn sàng nhận phím.
- Luồng thay thế: A1 đang có Maximized Pane, người dùng bấm badge trên tiêu đề → thu về, focus ô gấp nhất → SRS-FR-045

### SRS-FR-037 — Jump to pane from the Folder Tree
When the user clicks a Session Row in the Folder Tree, the system shall move keyboard focus to the pane of that session.
- Giải thích: Sửa ở CR-016: trước là "a row in Active Sessions".
- Ví dụ: bấm Session Row "Scaffold Tauri app" đang "Cần duyệt" → ô đó được focus, duyệt bằng Approval Strip hoặc bấm phím `1` trong Term là chọn "Yes" trong hộp xin phép.
- Ví dụ: bấm dòng `Idle` không tô nền → vẫn tới ô đó.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-07

### SRS-FR-045 — Jump from the maximized badge
When the user clicks the status badge of the Maximized Pane, the system shall restore the layout and move keyboard focus to the pane of the most urgent other session.
- Giải thích: gấp nhất là `Error` trước `Needs Approval`; cùng trạng thái thì phiên vào trạng thái sớm nhất.
- Ví dụ: phóng to ô 1, ô 2 `Needs Approval` từ 14:00, ô 3 `Error` từ 14:05 → bấm badge → bố cục cũ, ô 3 được focus.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-07

## 2.8 Đo độ trễ trạng thái — Deleted (CR-015)
App không ghi độ trễ trạng thái; BO-01 do PO tự kiểm khi dùng, SRS-FR-034 vẫn kiểm bằng Test.

### SRS-FR-038 — Record status change timing — Deleted (CR-015)
App không ghi độ trễ trạng thái; BO-01 do PO tự kiểm khi dùng, SRS-FR-034 vẫn kiểm bằng Test.

### SRS-FR-039 — Status latency report — Deleted (CR-014)
Không còn nút và báo cáo Status Latency trong app; PO tính tỉ lệ từ bản ghi của SRS-FR-038.

## 2.9 Xoá phiên

- Luồng chính: 1. Người dùng chọn Delete trên một dòng của Session Chooser. 2. Hệ thống hỏi xác nhận. 3. Người dùng đồng ý; phiên vào Thùng rác, biến khỏi danh sách.
- Luồng thay thế: A1 người dùng chọn Cancel → không đổi gì → SRS-FR-048
- Luồng thay thế: A2 phiên đang mở trong ô → kết thúc phiên, đóng ô rồi mới xoá → SRS-FR-049
- Luồng thay thế: A3 người dùng tick nhiều dòng (SRS-FR-073, SRS-FR-074, SRS-FR-075), chọn "Delete selected", xác nhận một lần → SRS-FR-077, SRS-FR-078; đóng Session Chooser thì bỏ chọn → SRS-FR-076
- Luồng thay thế: A4 người dùng bấm × trên ô và chọn Close and move to Trash → SRS-FR-101
- Luồng ngoại lệ: E2 xoá nhiều mà có phiên không chuyển được vào Thùng rác → giữ các phiên đó, báo số đã xoá → SRS-FR-079
- Luồng ngoại lệ: E1 không chuyển được vào Thùng rác → giữ phiên, báo lỗi → SRS-FR-050

### SRS-FR-047 — Delete a session
When the user confirms deleting a session, the system shall move that session's history to the operating system's trash and remove the session from the Session Chooser.
- Giải thích: khôi phục được bằng tay từ Thùng rác; ngoại lệ duy nhất của SRS-NFR-005. Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: xoá "Scaffold Tauri app" → dòng biến mất; khôi phục từ Trash rồi bấm + trên folder → thấy lại phiên.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-048 — Confirm deleting a session
When the user chooses Delete on a row of the Session Chooser, the system shall ask "Move "<title>" to Trash?" before deleting.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: Delete trên "Scaffold Tauri app" → hộp "Move "Scaffold Tauri app" to Trash?".
- Ví dụ âm: chọn Cancel → phiên vẫn còn, không file nào bị chuyển.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-049 — Delete an open session
If the user confirms deleting a session that is open in a pane, then the system shall end that session and close its pane before moving its history to the trash.
- Giải thích: câu xác nhận đổi thành "Close "<title>" and move it to Trash?".
- Ví dụ: phiên `Running` ở ô 2, Delete + đồng ý → ô 2 đóng, phiên kết thúc, rồi vào Thùng rác.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-050 — Report delete failure
If a session's history cannot be moved to the trash, then the system shall keep that session in the Session Chooser and show the message "Session could not be deleted".
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ âm: file phiên bị khoá quyền ghi → phiên vẫn còn, hiện "Session could not be deleted".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-073 — Select a session
When the user ticks the checkbox of a row in the Session Chooser, the system shall add that session to the Session Selection.
- Giải thích: bỏ tick thì phiên ra khỏi Session Selection; tick không mở phiên. Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: tick "Scaffold Tauri app" và "Fix login bug" → Session Selection có 2 phiên.
- Ví dụ âm: tick một dòng → không ô nào được mở.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-074 — Delete selected action
While the Session Selection is not empty, the system shall show the actions "Delete selected (<n>)" and "Select all" in the Session Chooser, where <n> is the number of selected sessions.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: tick 2 dòng → hiện "Delete selected (2)" và "Select all".
- Ví dụ âm: bỏ tick hết → hai nút ẩn.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-075 — Select all sessions
When the user chooses Select all, the system shall add every session listed in the Session Chooser to the Session Selection.
- Giải thích: Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ: folder có 5 phiên, đã tick 1, chọn Select all → "Delete selected (5)".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-076 — Clear the selection
When the Session Chooser closes, the system shall empty the Session Selection.
- Giải thích: Sửa ở CR-016: trước là "When the Session History Panel switches to another workspace or closes".
- Ví dụ: tick 2 phiên trong Session Chooser của `agent-deck`, bấm Đóng rồi bấm + trên `agent-deck` lần nữa → không dòng nào được tick.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-077 — Confirm deleting selected sessions
When the user chooses Delete selected, the system shall ask "Move <n> sessions to Trash?" before deleting.
- Giải thích: có <k> phiên đang mở trong ô thì câu là "Close <k> open sessions and move <n> sessions to Trash?".
- Ví dụ: chọn 3 phiên, 1 phiên đang mở → hộp "Close 1 open sessions and move 3 sessions to Trash?".
- Ví dụ âm: chọn Cancel → không phiên nào bị chuyển, Session Selection giữ nguyên.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-078 — Delete selected sessions
When the user confirms deleting the selected sessions, the system shall delete each selected session as in SRS-FR-047 and SRS-FR-049.
- Ví dụ: chọn 3 phiên, 1 phiên đang `Running` ở ô 2, xác nhận → ô 2 đóng, cả 3 vào Thùng rác, 3 dòng biến mất, Session Selection rỗng.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-079 — Report partial delete failure
If some selected sessions cannot be moved to the trash, then the system shall keep those sessions in the Session Chooser and in the Session Selection and show the message "<k> of <n> sessions deleted".
- Giải thích: khi xoá nhiều, thông báo này thay cho thông báo của SRS-FR-050. Sửa ở CR-016: Session Chooser thay Session History Panel.
- Ví dụ âm: chọn 3 phiên, 1 file bị khoá quyền ghi → 2 dòng biến mất, dòng còn lại vẫn được tick, hiện "2 of 3 sessions deleted".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

## 2.10 Terminal phụ trong ô

- Luồng chính: 1. Người dùng chọn Shell trên View Switch → SRS-FR-055. 2. Gõ lệnh. 3. Chuyển sang chế độ khác, lệnh vẫn chạy → SRS-FR-056, SRS-FR-058. 4. Chọn lại Shell → SRS-FR-057.
- Luồng thay thế: A2 người dùng gõ `exit` trong Pane Shell → SRS-FR-061
- Luồng thay thế: A3 phiên Claude Code trong ô thoát bất thường → SRS-FR-064; thoát bình thường → ô đóng cùng Pane Shell → SRS-FR-083
- Luồng ngoại lệ: E1 đóng ô khi Pane Shell đang chạy một lệnh → Close Dialog thêm cảnh báo → SRS-FR-063, SRS-FR-062
- Luồng ngoại lệ: E2 shell không khởi động được → SRS-FR-065

### SRS-FR-055 — Open the pane shell
When the user chooses Shell in the View Switch of a pane that has no Pane Shell, the system shall start a Pane Shell running the operating system's default shell in the workspace folder and show it over the whole pane body.
- Giải thích: shell mặc định là shell đăng nhập của người dùng trên macOS, PowerShell trên Windows. Sửa ở CR-016: trước là mở Pane Shell bên dưới phiên trong cùng ô, cao 30% ô.
- Ví dụ: ô "agent-deck · Scaffold Tauri app", chọn Shell trên View Switch → thân ô hiện dấu nhắc ở folder `agent-deck`, gõ `pwd` ra đường dẫn folder đó.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-056 — Hide the pane shell
When the user switches a pane from Shell to another view, the system shall hide the Pane Shell and keep its process running.
- Giải thích: Sửa ở CR-016: trước là "When the user chooses Shell on a pane whose Pane Shell is visible".
- Ví dụ: shell đang chạy `npm run dev`, chọn Chat → thân ô hiện Chat, server vẫn trả lời ở `localhost:1420`.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-057 — Show the pane shell again
When the user chooses Shell in the View Switch of a pane whose Pane Shell is hidden, the system shall show the Pane Shell with its previous output.
- Giải thích: Sửa ở CR-016: trước là "When the user chooses Shell on a pane …" và giữ cả chiều cao.
- Ví dụ: shell chạy `npm run dev`, chuyển sang Term, chọn lại Shell → thấy log `npm run dev` in ra trong lúc ẩn.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-058 — Hidden shell marker
While a pane's Pane Shell is hidden and running a command, the system shall show the name of that command on the Shell item of the View Switch.
- Giải thích: giữ ý của SRS-FR-029 "không để phiên chạy ngầm không ai thấy" cho shell ẩn. Sửa ở CR-016: trước là chấm trên nút Shell mỗi khi Pane Shell ẩn.
- Ví dụ: shell chạy `npm run dev` rồi chuyển sang Chat → mục Shell trên View Switch hiện `npm run dev`.
- Ví dụ âm: shell ẩn đang đứng ở dấu nhắc, hoặc ô chưa mở shell → mục Shell không có tên lệnh.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-059 — Resize the pane shell — Deleted (CR-016)
Pane Shell chiếm cả thân ô, không còn vách ngăn.

### SRS-FR-060 — Reflow the pane shell
When the Pane Shell changes size, the system shall fit the Pane Shell's content to its new size.
- Giải thích: gồm đổi khổ ô (SRS-FR-023), phóng to và thu về (SRS-FR-041, SRS-FR-042); phần phiên Claude Code vẫn theo SRS-FR-024.
- Ví dụ: phóng to ô đang hiện shell chạy `htop` → `htop` vẽ lại vừa khổ mới.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-061 — Shell exits
When the Pane Shell's process exits, the system shall close the Pane Shell.
- Ví dụ: gõ `exit` → ô về chế độ trước đó, mục Shell không còn tên lệnh; chọn Shell lại → shell mới, không còn nội dung cũ.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-062 — Close pane ends its shell
When the user closes a pane, the system shall end the Pane Shell process of that pane.
- Giải thích: đúng cả khi shell đang ẩn; cũng áp khi ô đóng vì xoá phiên (SRS-FR-049).
- Ví dụ: shell ẩn chạy `npm run dev`, đóng ô và xác nhận → `localhost:1420` ngừng trả lời.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-063 — Confirm closing a pane with a busy shell
If the user chooses × on a pane whose Pane Shell is running a command, then the system shall show the warning "A command is still running in the shell." in the Close Dialog.
- Giải thích: "đang chạy một lệnh" là shell không đứng ở dấu nhắc chờ lệnh. Ô vừa bận theo SRS-FR-027 vừa có shell bận → một Close Dialog có cả hai dòng. Sửa ở CR-009: trước là hộp riêng "A command is still running in the shell. Close anyway?".
- Ví dụ: phiên `Idle`, shell ẩn chạy `npm run dev`, bấm × → Close Dialog có dòng "A command is still running in the shell."; chọn Cancel → ô và shell vẫn chạy.
- Ví dụ âm: shell đứng ở dấu nhắc → Close Dialog không có dòng này.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-064 — Shell outlives the session
While the session in a pane has exited abnormally, the system shall keep that pane's Pane Shell running.
- Ví dụ: Claude Code bị kill → Term hiện "Session ended" (SRS-FR-028), Shell vẫn chạy `npm run dev`.
- Ví dụ âm: gõ `/exit` → ô đóng, shell kết thúc theo (SRS-FR-083).
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-065 — Report shell start failure
If the Pane Shell cannot start, then the system shall show the message "Shell could not start" in that pane and keep the session running.
- Ví dụ âm: shell mặc định không chạy được → ô hiện "Shell could not start", phiên Claude Code vẫn `Running`, mục Shell không có tên lệnh.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

## 2.11 Cỡ chữ

- Luồng chính: 1. Người dùng bấm Zoom shortcut để to hoặc nhỏ → SRS-FR-068, SRS-FR-069. 2. Mọi chữ trong cửa sổ đổi cỡ, terminal fit lại → SRS-FR-072. 3. Mở lại app vẫn giữ cỡ đó → SRS-FR-071.
- Luồng thay thế: A1 người dùng bấm Zoom shortcut về mặc định → SRS-FR-070
- Luồng ngoại lệ: E1 Text Size đã ở 200% hoặc 50% → giữ nguyên (Ví dụ âm của SRS-FR-068, SRS-FR-069)

### SRS-FR-068 — Increase text size
When the user presses the Zoom shortcut to enlarge, the system shall increase the Text Size by 10 percentage points, up to 200%.
- Giải thích: áp cho mọi chữ trong cửa sổ: Sidebar, Session Chooser, tiêu đề ô, Chat, Composer, terminal phiên, Pane Shell, hộp thoại. Phím tắt chạy cả khi focus đang ở ô; ô không nhận phím đó.
- Ví dụ: Text Size 100%, bấm Cmd + hai lần → 120%, chữ ở cột trái và chữ trong ô cùng to ra.
- Ví dụ âm: Text Size 200%, bấm Cmd + → vẫn 200%.
- Ví dụ âm: trên macOS, bấm Ctrl − trong ô → Claude Code nhận phím đó, Text Size không đổi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-069 — Decrease text size
When the user presses the Zoom shortcut to shrink, the system shall decrease the Text Size by 10 percentage points, down to 50%.
- Ví dụ: Text Size 100%, bấm Cmd − → 90%.
- Ví dụ âm: Text Size 50%, bấm Cmd − → vẫn 50%.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-070 — Reset text size
When the user presses the Zoom shortcut to reset, the system shall set the Text Size to 100%.
- Ví dụ: Text Size 150%, bấm Cmd 0 → 100%.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-071 — Persist text size
The system shall keep the Text Size between application launches.
- Ví dụ: đặt 130%, thoát app, mở lại → 130%.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-072 — Reflow on text size change
When the Text Size changes, the system shall fit the content of every session terminal and Pane Shell to its pane at the new Text Size.
- Giải thích: như SRS-FR-024; khổ ô không đổi nhưng số cột và số dòng đổi.
- Ví dụ: 2 ô, bấm Cmd + → khung nhập của Claude Code ở cả 2 ô vẽ lại vừa ô, không vỡ dòng.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

## 2.12 Mở lại các ô khi mở app

- Luồng chính: 1. Người dùng thoát app khi đang có ô → SRS-FR-084. 2. Người dùng mở lại app → các ô hiện lại đúng chỗ, phiên tiếp tục → SRS-FR-085.
- Luồng ngoại lệ: E1 có phiên không mở lại được → SRS-FR-086

### SRS-FR-084 — Remember open panes
The system shall keep the session of every open pane and the pane layout between application launches.
- Giải thích: ô đã "Session ended" và ô của phiên mới chưa gửi yêu cầu nào không được nhớ (phiên đó chưa có trên máy, không resume được); không nhớ trạng thái phóng to và Pane Shell.
- Ví dụ: 3 ô, ô 3 đang "Session ended", thoát app → nhớ ô 1, ô 2 cùng vị trí và tỉ lệ của chúng.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-085 — Reopen panes at launch
When the application starts, the system shall resume each remembered session in a pane at its remembered position and size.
- Giải thích: resume như SRS-FR-013; không phóng to, không mở Pane Shell.
- Ví dụ: thoát app khi có ô 1 | ô 2 chia 30/70, mở lại → 2 ô 30/70, cả hai phiên gõ tiếp được, 0 thao tác.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-086 — Report panes not reopened
If a remembered session cannot be resumed at launch, then the system shall leave out its pane, give its space to the other panes and show the message "<k> sessions could not be reopened".
- Ví dụ âm: 3 ô, folder của ô 2 đã `Missing` → ô 1 và ô 3 chia nhau chỗ, hiện "1 sessions could not be reopened".
- Ví dụ âm: phiên của ô 1 đã bị xoá vào Thùng rác ngoài app → ô 1 không mở, hiện "1 sessions could not be reopened".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

## 2.13 Ẩn/hiện cột trái

- Luồng chính: 1. Người dùng bấm Sidebar Toggle hoặc Sidebar shortcut → Sidebar ẩn, các ô nở ra → SRS-FR-088, SRS-FR-089. 2. Bấm lại → Sidebar hiện → SRS-FR-088, SRS-FR-089.
- Luồng thay thế: A1 mở lại app → Sidebar hiện → SRS-FR-090

### SRS-FR-088 — Toggle sidebar by button
When the user clicks the Sidebar Toggle, the system shall hide the Sidebar if it is shown and show it if it is hidden.
- Giải thích: Sidebar ẩn hẳn, không còn dải icon; vùng ô nở ra chiếm chỗ đó, terminal fit lại theo SRS-FR-024; phiên, ô, Pane Shell không đổi.
- Ví dụ: Sidebar đang hiện, bấm Sidebar Toggle → Sidebar ẩn, 2 ô cạnh nhau rộng thêm, nút nằm ở mép trái cửa sổ.
- Ví dụ: bấm lần nữa → Sidebar hiện lại như cũ, folder nào đang thu gọn vẫn thu gọn.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-089 — Toggle sidebar by shortcut
When the user presses the Sidebar shortcut, the system shall hide the Sidebar if it is shown and show it if it is hidden.
- Giải thích: chạy cả khi focus đang ở ô; ô không nhận phím đó; focus vẫn ở ô cũ.
- Ví dụ: đang gõ trong ô 1 trên macOS, bấm Cmd+B → Sidebar ẩn, gõ tiếp vẫn vào ô 1.
- Ví dụ âm: trên macOS, bấm Ctrl+B trong ô → Claude Code nhận phím đó, Sidebar không đổi.
- Ví dụ âm: bấm Ctrl+H trong ô → ô nhận ^H, Sidebar không đổi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-090 — Sidebar shown at launch
When the application starts, the system shall show the Sidebar.
- Ví dụ: ẩn Sidebar, thoát app, mở lại → Sidebar hiện.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

## 2.14 Hiện việc chính của phiên — Deleted (CR-015)
Không còn Session Goal và Target Box.

### SRS-FR-091 — Pin first prompt as session goal — Deleted (CR-015)
Không còn Session Goal và Target Box.

### SRS-FR-092 — Target Box — Deleted (CR-015)
Không còn Session Goal và Target Box.

### SRS-FR-093 — Edit session goal — Deleted (CR-015)
Không còn Session Goal và Target Box.

### SRS-FR-094 — Focus Reminder with each prompt — Deleted (CR-010)
App không gửi gì thêm cho Claude Code cùng prompt; người dùng tự đối chiếu việc chính trên Target Box (SRS-FR-092).

### SRS-FR-095 — Off-goal instruction — Deleted (CR-010)
App không ràng buộc Claude Code theo Session Goal.

### SRS-FR-096 — Keep session goal across launches — Deleted (CR-015)
Không còn Session Goal và Target Box.

### SRS-FR-097 — Goal of a resumed session without a stored goal — Deleted (CR-015)
Không còn Session Goal và Target Box.

### SRS-FR-098 — Prompt goes through without reminder — Deleted (CR-010)
Không còn Focus Reminder (SRS-FR-094); prompt luôn tới Claude Code nguyên vẹn.

## 2.15 Để dành phiên đang dở

- Luồng chính: 1. Người dùng bấm Stash trên tiêu đề ô → ô đóng, phiên vào Stashed Sessions → SRS-FR-103, SRS-FR-104, SRS-FR-106. 2. Người dùng bấm một dòng trong Stashed Sessions → phiên mở trong ô mới, dòng rời Stashed Sessions → SRS-FR-108, SRS-FR-109.
- Luồng thay thế: A1 ô đang bận → Stash Dialog → SRS-FR-105. A2 người dùng gỡ dòng bằng × → SRS-FR-110. A3 mở lại app → danh sách còn nguyên → SRS-FR-111
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối, dòng ở lại → SRS-FR-016, SRS-FR-108. E2 lịch sử phiên không còn → SRS-FR-112

### SRS-FR-103 — Stash button
The system shall show a Stash button in the header of every pane immediately to the left of the Maximize button.
- Giải thích: ô chưa có lịch sử phiên trên đĩa (phiên mới chưa gõ gì) → nút bị tắt, vì không có gì để mở lại; Maximized Pane cũng có nút, bên trái nút Restore.
- Ví dụ: tiêu đề ô "agent-deck · Fix login bug" → thứ tự nút … Stash · Maximize · ×.
- Ví dụ âm: ô New Session chưa gửi prompt → nút Stash mờ, bấm không có gì xảy ra.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-104 — Stash a pane
When the user chooses Stash on a pane that is not busy, the system shall close that pane and add its session to Stashed Sessions.
- Giải thích: "không bận" = phiên không `Running`/`Needs Approval` và Pane Shell không chạy lệnh; đóng như SRS-FR-029, SRS-FR-062 (kết thúc phiên và shell); không hiện Close Dialog; phiên vẫn còn trong Session Chooser; ô đã đóng không được nhớ theo SRS-FR-084.
- Ví dụ: ô "Fix login bug" `Idle`, bấm Stash → ô biến mất, nhóm "Để dành" có dòng "Fix login bug · mokairo".
- Ví dụ âm: bấm Stash → phiên không bị xoá, vẫn còn trong Session Chooser.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-105 — Confirm stashing a busy pane
If the user chooses Stash on a pane whose session is `Running` or `Needs Approval` or whose Pane Shell is running a command, then the system shall show the Stash Dialog for that pane before stashing it.
- Giải thích: dòng cảnh báo giống SRS-FR-027, SRS-FR-063; Cancel → không đổi gì; Stash → như SRS-FR-104.
- Ví dụ: ô `Running`, bấm Stash → hộp "Stash "Fix login bug"?" có dòng "Session is still running."; chọn Stash → phiên kết thúc, ô đóng, phiên vào Stashed Sessions.
- Ví dụ âm: chọn Cancel → ô vẫn chạy, Stashed Sessions không đổi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-106 — List stashed sessions
The system shall list every stashed session in the group "Để dành (<n>)" at the end of the Folder Tree, with its title and its workspace name, most recently stashed first.
- Giải thích: Sửa ở CR-016: trước là "list in Stashed Sessions every stashed session across all workspaces".
- Ví dụ: stash "Fix login bug" (mokairo) lúc 14:00 rồi "Scaffold Tauri app" (agent-deck) lúc 14:10 → cuối Folder Tree có nhóm "Để dành (2)", dòng đầu "Scaffold Tauri app · agent-deck", dòng hai "Fix login bug · mokairo".
- Ví dụ âm: phiên chưa từng stash → không có trong Stashed Sessions.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-107 — Empty stashed sessions
While no session is stashed, the system shall hide the "Để dành" group.
- Giải thích: Sửa ở CR-016: trước là hiện "No stashed sessions" trong Stashed Sessions.
- Ví dụ âm: mở app, chưa stash phiên nào → Folder Tree không có nhóm "Để dành".
- Ví dụ: gỡ dòng để dành cuối cùng bằng × → nhóm "Để dành" biến mất.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-108 — Reopen a stashed session
When the user chooses a row in Stashed Sessions, the system shall resume that session in a new pane.
- Giải thích: resume như SRS-FR-013, đặt ô như SRS-FR-046; workspace `Missing` → từ chối như SRS-FR-016, dòng ở lại; Claude Code không khởi động được → SRS-FR-017.
- Ví dụ: bấm "Fix login bug · mokairo" → ô mới tiếp tục hội thoại cũ, gõ được ngay (1 thao tác, BO-02).
- Ví dụ âm: `mokairo` `Missing` → không mở ô, hiện "Folder not found", dòng vẫn ở Stashed Sessions.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-109 — Unstash on open
When a stashed session opens in a pane, the system shall remove that session from Stashed Sessions.
- Giải thích: mở bằng bất kỳ đường nào (dòng trong Stashed Sessions, dòng phiên trong Session Chooser).
- Ví dụ: bấm dòng "Fix login bug" trong Session Chooser khi nó đang trong Stashed Sessions → ô mở, dòng biến khỏi Stashed Sessions.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-110 — Remove from stash
When the user chooses × on a row in Stashed Sessions, the system shall remove that session from Stashed Sessions without changing its history.
- Giải thích: × hiện khi rê chuột lên dòng; không hỏi xác nhận; không mở ô.
- Ví dụ: bấm × trên "Fix login bug" → dòng biến mất, phiên vẫn còn trong Session Chooser.
- Ví dụ âm: bấm × → không có ô nào mở.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-111 — Keep stash across launches
The system shall keep Stashed Sessions and their order between application launches.
- Ví dụ: stash 2 phiên, thoát app, mở lại → Stashed Sessions vẫn 2 dòng cùng thứ tự.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

### SRS-FR-112 — Drop stashed sessions without history
If the history of a stashed session no longer exists, then the system shall remove that session from Stashed Sessions.
- Giải thích: phiên bị xoá vào Thùng rác trong app (SRS-FR-047, SRS-FR-073) hay ngoài app.
- Ví dụ âm: xoá "Fix login bug" trong Session Chooser → dòng biến khỏi Stashed Sessions.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-03

## 2.16 Theo dõi tiến độ phiên — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-113 — Tracking Prompt — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-114 — Turn tracking on from the prompt — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-115 — Decline tracking — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-116 — Tracking button — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-117 — Track an ongoing session — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-118 — Progress Strip — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-119 — Checkpoint row — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-120 — Progress Strip height — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-121 — Scroll to the work in progress — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-122 — Collapse the Progress Strip — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-123 — Expand the Progress Strip — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-124 — Update after each turn — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-125 — Turn tracking off — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-126 — New Checkpoint only for new major work — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-127 — Done only on evidence — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-128 — Report update failure — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-129 — Keep progress across launches — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-130 — Resume a session without a Progress Record — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-FR-131 — Tracking after /clear — Deleted (CR-015)
Không còn Progress Tracking.

## 2.17 Tóm tắt trạng thái đầu cửa sổ — Deleted (CR-014)

Không còn vùng tóm tắt ở đầu cửa sổ; trạng thái phiên xem trên Workspace List, Active Sessions và badge của ô phóng to (SRS-FR-034, SRS-FR-044).

### SRS-FR-132 — Status Summary headline — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-133 — Status Summary counts — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-134 — All clear — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-135 — No session open — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-136 — Jump from the Status Summary — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-137 — Collapse while working in a pane — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-138 — Collapse in a narrow window — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-139 — Hide while maximized — Deleted (CR-014)
Không còn Status Summary.

### SRS-FR-140 — Status Summary update latency — Deleted (CR-014)
Không còn Status Summary.

## 2.18 Cây folder

- Luồng chính: 1. Sidebar hiện Folder Tree: mỗi workspace có phiên đang mở là một dòng, Session Row lồng bên dưới (SRS-FR-051, SRS-FR-052). 2. Workspace không có phiên mở nằm trong Other Folders → SRS-FR-141. 3. Người dùng bấm chevron để thu gọn hoặc mở một workspace → SRS-FR-142. 4. Người dùng bấm ⋯ trên dòng workspace → Folder Menu → SRS-FR-143, SRS-FR-144.
- Luồng thay thế: A1 người dùng bấm nút Cài đặt ở chân Sidebar → Settings Page (2.25) → SRS-FR-145

### SRS-FR-141 — Other Folders
While a workspace has no session open in a pane, the system shall list it in the group "Folder khác (<n>)" at the end of the Folder Tree, collapsed by default unless no workspace has a session open in a pane.
- Giải thích: <n> là số workspace trong nhóm; nhóm nằm trên nhóm "Để dành" (SRS-FR-106), nhóm đó luôn ở cuối cây. Sửa ở CR-017: khi cây không còn folder nào có phiên mở, nhóm mở sẵn để người dùng thấy folder mà chọn; người dùng thu gọn lại thì giữ thu gọn tới khi có phiên mở rồi đóng hết.
- Ví dụ: Workspace List có `agent-deck`, `mokairo`, `notes`; chỉ `agent-deck` có ô đang mở → cây có dòng `agent-deck` với Session Row bên dưới, rồi nhóm thu gọn "Folder khác (2)" chứa `mokairo`, `notes`.
- Ví dụ âm: mở một phiên của `mokairo` → `mokairo` rời nhóm, nhóm còn "Folder khác (1)".
- Ví dụ: mở app, chưa ô nào mở, Workspace List có 3 folder → nhóm "Folder khác (3)" mở sẵn, thấy cả 3 folder.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-01

### SRS-FR-142 — Collapse a workspace
When the user chooses the chevron of a workspace row, the system shall hide or show the Session Rows under it.
- Giải thích: thu gọn không đóng ô; số đếm trên dòng workspace (SRS-FR-040) vẫn hiện.
- Ví dụ: `agent-deck` có 2 Session Row, bấm chevron → 2 dòng ẩn, dòng `agent-deck` vẫn có số "2"; bấm lại → 2 dòng hiện lại.
- Ví dụ âm: thu gọn `agent-deck` → 2 ô của nó vẫn chạy, không ô nào đóng.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-06

### SRS-FR-143 — Folder Menu
When the user chooses ⋯ on a workspace row, the system shall show the Folder Menu with Xem file, Bỏ folder and Chép đường dẫn.
- Ví dụ: bấm ⋯ trên dòng `mokairo` → menu ba mục Xem file · Bỏ folder · Chép đường dẫn.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-01

### SRS-FR-144 — Copy workspace path
When the user chooses Chép đường dẫn in the Folder Menu, the system shall copy the absolute path of that workspace folder to the clipboard.
- Ví dụ: Chép đường dẫn trên `mokairo` rồi dán vào terminal → `/Users/mionix/Project/mokairo`.
- Kiểm chứng: Test
- Ưu tiên: Could
- Nguồn: BR-01

### SRS-FR-145 — Settings button
The system shall show a Settings button at the bottom of the Sidebar that opens the Settings Page.
- Ví dụ: bấm nút Cài đặt ở chân Sidebar → Settings Page mở, thấy chế độ quyền mặc định và phiên bản Claude Code.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-16

## 2.19 Chế độ của ô

- Luồng chính: 1. Ô mở ở Chat → SRS-FR-147. 2. Người dùng chọn Chat, Term, Shell hoặc Plan trên View Switch → SRS-FR-146. 3. Các chế độ không đang xem vẫn chạy → SRS-FR-148.

### SRS-FR-146 — View Switch
When the user chooses Chat, Term, Shell or Plan in the View Switch of a pane, the system shall show that view in the pane body.
- Giải thích: mỗi ô có chế độ riêng; Shell theo 2.10.
- Ví dụ: ô "agent-deck · Fix login bug" đang ở Chat, chọn Term → thân ô hiện terminal của phiên Claude Code.
- Ví dụ âm: đổi ô 1 sang Term → ô 2 vẫn ở Chat.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-147 — Default view
When a pane opens, the system shall show it in Chat.
- Giải thích: theo A-13; chế độ đang xem không giữ giữa các lần mở app (mục 3).
- Ví dụ: bấm + trên `agent-deck`, chọn Phiên mới → ô mới hiện Chat, con trỏ ở Composer.
- Ví dụ: thoát app khi ô 1 đang ở Term, mở lại → ô 1 hiện Chat.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-148 — Hidden views keep running
While a view of a pane is hidden, the system shall keep its session and Pane Shell running and keep their output.
- Ví dụ: Claude Code đang `Running` một lệnh dài, chuyển ô sang Shell → phiên vẫn chạy; chọn lại Term thấy đủ output in ra trong lúc ẩn.
- Ví dụ âm: chuyển sang Chat → phiên không bị dừng, vẫn `Running`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

## 2.20 Hội thoại

- Luồng chính: 1. Ô ở Chat hiện hội thoại của phiên → SRS-FR-149. 2. Phiên ghi thêm lượt mới → Chat cập nhật trong ≤ 1 giây → SRS-FR-150. 3. Khi phiên `Running`, Activity Bar hiện việc đang làm → SRS-FR-152.
- Luồng thay thế: A1 phiên sang hội thoại mới (ví dụ sau `/clear`) → SRS-FR-151
- Luồng ngoại lệ: E1 không đọc được hội thoại → SRS-FR-153

### SRS-FR-149 — Chat messages
While a pane shows Chat, the system shall show the conversation of its session as messages: user prompts, Claude Code replies, and each tool call with its result.
- Giải thích: chỉ đọc hội thoại của phiên, không ghi (SRS-NFR-005).
- Ví dụ: phiên "Fix login bug" có prompt "sửa lỗi đăng nhập", Claude Code đọc `src/login.ts` rồi trả lời → Chat hiện tin nhắn prompt, thẻ công cụ "Read src/login.ts" kèm kết quả, rồi đoạn trả lời.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-11

### SRS-FR-150 — Chat update latency
When the session writes a new conversation entry, the system shall show it in Chat within 1 second.
- Ví dụ: Claude Code ghi câu trả lời lúc 14:02:00 → Chat hiện câu đó trước 14:02:01.
- Ví dụ âm: câu hiện lúc 14:02:02 → không đạt.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-11

### SRS-FR-151 — Follow a cleared conversation
When the session of a pane moves to a new conversation, the system shall show the new conversation in Chat.
- Ví dụ: gõ `/clear` rồi gửi "viết test cho login" → Chat chỉ còn hội thoại mới, bắt đầu từ "viết test cho login".
- Ví dụ âm: sau `/clear`, Chat vẫn hiện hội thoại cũ → không đạt.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-11

### SRS-FR-152 — Activity Bar
While a session is `Running`, the system shall show in the Activity Bar the tool currently running, the share of context used and the number of background shells and subagents.
- Ví dụ: Claude Code đang chạy `npm test`, đã dùng 42% context, có 1 shell nền và 2 subagent → Activity Bar "Bash npm test · 42% context · 1 shell · 2 subagent".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-11

### SRS-FR-153 — Unreadable conversation
If the conversation of a session cannot be read, then the system shall show "Không đọc được hội thoại, xem ở Term" in Chat.
- Ví dụ âm: file hội thoại của phiên bị hỏng hoặc Claude Code đổi định dạng → Chat hiện "Không đọc được hội thoại, xem ở Term", Term vẫn dùng được.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-11

## 2.21 Ô nhập prompt

- Luồng chính: 1. Người dùng gõ prompt trong Composer, gõ "/" hoặc "@" để chọn gợi ý → SRS-FR-159, SRS-FR-160. 2. Người dùng gửi khi phiên Input Ready (RULE-12) → SRS-FR-154. 3. Phiên `Running`, người dùng bấm Stop nếu cần → SRS-FR-157.
- Luồng thay thế: A1 dán hoặc kéo thả file → SRS-FR-161. A2 bấm ↑ trong Composer trống → SRS-FR-158
- Luồng ngoại lệ: E1 phiên không Input Ready → Composer khoá → SRS-FR-155. E2 Claude Code đang hiện hộp thoại lúc gửi → giữ prompt → SRS-FR-156. E3 file lớn hơn 50 MB → SRS-FR-162

### SRS-FR-154 — Send a prompt
When the user sends a prompt from the Composer while the session is Input Ready, the system shall deliver that prompt to the session as if it were typed and submitted in Term.
- Giải thích: Input Ready theo RULE-12; Composer có ở Chat và Plan.
- Ví dụ: phiên `Idle`, gõ "chạy lại test" trong Composer rồi Enter → Term nhận đúng chuỗi đó như vừa gõ, phiên sang `Running`, Composer trống.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-12

### SRS-FR-155 — Lock the Composer
While the session of a pane is not Input Ready, the system shall disable sending from the Composer and show why.
- Giải thích: không chắc phiên đang chờ prompt thì khoá (RULE-12); người dùng vẫn gõ được ở Term.
- Ví dụ: đang chờ duyệt → "Claude Code đang chờ duyệt".
- Ví dụ: màn hình không khớp mẫu → "Không nhận ra màn hình Claude Code — gõ ở Term".
- Ví dụ âm: Composer đang khoá, bấm Enter → không có gì tới phiên, prompt còn trong Composer.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-12

### SRS-FR-156 — Never answer a dialog
If a Claude Code dialog is showing when a prompt is about to be delivered, then the system shall keep the prompt in the Composer and not deliver it.
- Giải thích: tránh chữ của prompt bị hiểu thành lựa chọn trong hộp xin phép hay hộp hỏi phương án.
- Ví dụ âm: bấm gửi "1 thêm test" đúng lúc Claude Code bật hộp xin phép → hộp vẫn chờ, không phím nào tới phiên, prompt còn nguyên trong Composer.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-12

### SRS-FR-157 — Stop a turn
While the session is `Running`, the system shall show a Stop button in the Composer that interrupts the current turn as Esc does in Term.
- Ví dụ: phiên đang chạy `npm test` lâu, bấm Stop → Claude Code dừng lượt như bấm Esc trong Term.
- Ví dụ âm: phiên `Idle` → Composer không có nút Stop.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-12

### SRS-FR-158 — Prompt history
When the user presses ↑ in an empty Composer, the system shall fill it with the previous prompt sent from that pane.
- Ví dụ: đã gửi "chạy lại test" từ ô 1, Composer trống, bấm ↑ → Composer có "chạy lại test".
- Ví dụ âm: prompt "chạy lại test" gửi từ ô 2 → bấm ↑ ở ô 1 không ra chuỗi đó.
- Kiểm chứng: Test
- Ưu tiên: Could
- Nguồn: BR-12

### SRS-FR-159 — Command suggestions
When the user types "/" at the start of the Composer, the system shall suggest the built-in commands, the user's and the workspace's commands and skills, and the commands of enabled plugins, filtered by the text typed after "/".
- Ví dụ: gõ "/com" → gợi ý `/compact` (lệnh sẵn có) và `/commit` (skill của người dùng).
- Ví dụ âm: gõ "sửa a/b" → "/" không ở đầu Composer, không có gợi ý.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-12

### SRS-FR-160 — File suggestions
When the user types "@" in the Composer, the system shall suggest up to 8 files and folders of the session's workspace folder, excluding hidden and git-ignored files, filtered by the text typed after "@".
- Giải thích: folder không có git → duyệt folder, chỉ bỏ file ẩn (mục 6).
- Ví dụ: trong `agent-deck`, gõ "@App" → gợi ý `src/App.tsx`, tối đa 8 dòng.
- Ví dụ âm: `node_modules` bị git bỏ qua, `.env` là file ẩn → không có trong gợi ý.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-12

### SRS-FR-161 — Attach files
When the user pastes or drops files into the Composer, the system shall store each file as a Prompt File and insert its absolute path into the prompt.
- Giải thích: Prompt File nằm trong thư mục dữ liệu của app, ngoài mọi repo (mục 3).
- Ví dụ: dán ảnh chụp màn hình vào Composer → ảnh lưu thành Prompt File, prompt có thêm đường dẫn tuyệt đối của file đó.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-12

### SRS-FR-162 — Attachment size limit
If an attached file is larger than 50 MB, then the system shall reject that file and show "File lớn hơn 50 MB".
- Ví dụ âm: kéo `demo.mov` 120 MB cùng `log.txt` 2 KB vào Composer → `demo.mov` không lưu, hiện "File lớn hơn 50 MB"; `log.txt` vẫn được đính kèm.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-12

## 2.22 Duyệt và trả lời bằng nút

- Luồng chính: 1. Phiên sang `Needs Approval` vì xin quyền → Approval Strip hiện công cụ, lệnh hoặc file và hai nút → SRS-FR-163. 2. Người dùng chọn Cho phép hoặc Từ chối → SRS-FR-164.
- Luồng thay thế: A1 Claude Code hỏi chọn phương án → Question Card → SRS-FR-166. A2 Claude Code xin rời plan mode → SRS-FR-167. A3 người dùng trả lời ở Term → SRS-FR-168
- Luồng ngoại lệ: E1 yêu cầu đã được trả lời hoặc đã đổi lúc người dùng bấm → SRS-FR-165

### SRS-FR-163 — Approval Strip
While a session is `Needs Approval` for a tool permission, the system shall show in the Approval Strip of its pane the tool name, its command or file, and the buttons Cho phép and Từ chối.
- Ví dụ: Claude Code xin chạy `npm install` → Approval Strip "Bash · npm install" với hai nút Cho phép, Từ chối.
- Ví dụ: Claude Code xin sửa `src/main.rs` → Approval Strip "Edit · src/main.rs".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-13

### SRS-FR-164 — Answer a permission
When the user chooses Cho phép or Từ chối in the Approval Strip, the system shall answer that permission request with that choice.
- Ví dụ: bấm Cho phép trên "Bash · npm install" → Claude Code chạy `npm install`, phiên sang `Running`, Approval Strip biến mất.
- Ví dụ âm: bấm Từ chối → Claude Code không chạy lệnh đó.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-13

### SRS-FR-165 — Stale answer
If the request shown has already been answered or replaced when the user chooses, then the system shall discard the choice and show "Yêu cầu đã thay đổi".
- Ví dụ âm: đã trả lời "Yes" ở Term, Approval Strip cũ chưa kịp biến mất, bấm Cho phép → không gửi gì, hiện "Yêu cầu đã thay đổi".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-13

### SRS-FR-166 — Question Card
While a session asks the user to choose among options, the system shall show a Question Card with the question, each option, a "Khác…" field and the button Gửi.
- Ví dụ: Claude Code hỏi "Dùng thư viện nào để kiểm dữ liệu?" với `zod`, `yup` → Question Card có câu hỏi, hai phương án, ô "Khác…" và nút Gửi; chọn `zod` rồi Gửi → Claude Code nhận `zod`.
- Ví dụ: gõ "valibot" vào ô "Khác…" rồi Gửi → Claude Code nhận "valibot".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-13

### SRS-FR-167 — Plan approval
While a session asks to leave plan mode, the system shall show its plan with the buttons Duyệt kế hoạch and Tiếp tục lên kế hoạch, the latter with a feedback field.
- Ví dụ: Claude Code xong kế hoạch 5 bước và xin rời plan mode → hiện kế hoạch với hai nút; gõ "thêm bước viết test" rồi chọn Tiếp tục lên kế hoạch → Claude Code nhận góp ý, vẫn ở plan mode.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-13

### SRS-FR-168 — Answer in Term still works
While a request is shown in the Approval Strip or a Question Card, the system shall let the user answer it in Term instead, and remove the strip or card once answered.
- Ví dụ: Approval Strip đang hiện, chọn Term và bấm `1` → yêu cầu được trả lời, Approval Strip biến mất.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-13

## 2.23 Kế hoạch

- Luồng chính: 1. Người dùng chọn Plan trên View Switch; mục Plan có "<done>/<total>" → SRS-FR-170. 2. Plan hiện các bước → SRS-FR-169, file đã đổi → SRS-FR-171, kế hoạch đã duyệt → SRS-FR-173. 3. Người dùng bấm một file để xem phần thay đổi → SRS-FR-172.

### SRS-FR-169 — Plan steps
While a pane shows Plan, the system shall show the steps of the session's task list, marking each done, in progress or pending.
- Ví dụ: danh sách việc 5 bước, xong 2, đang làm bước 3 → Plan hiện 2 bước đã xong, bước 3 đang làm, 2 bước chờ.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-14

### SRS-FR-170 — Step count on the View Switch
While a session has a task list, the system shall show "<done>/<total>" on the Plan item of the View Switch.
- Ví dụ: xong 2 trên 5 bước → mục Plan hiện "2/5".
- Ví dụ âm: phiên chưa có danh sách việc → mục Plan không có số.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-14

### SRS-FR-171 — Changed files
While a pane shows Plan, the system shall list the files that changed in the pane's workspace folder since the pane opened, each with its added and removed line counts.
- Giải thích: so bằng git với trạng thái folder lúc ô mở (phiên mới hoặc mở lại); gồm cả thay đổi không do phiên làm (sửa tay, ô khác cùng folder); file mới chưa track tính là thêm toàn bộ dòng; file git bỏ qua không tính (CR-022).
- Ví dụ: ô mở lúc 9:00; tới 9:30 `src/App.tsx` thêm 12 dòng bớt 3 dòng, có file mới `src/chat.ts` 40 dòng → Plan liệt kê "src/App.tsx +12 −3" và "src/chat.ts +40 −0".
- Ví dụ: người dùng tự sửa `README.md` trong editor khi ô đang mở → `README.md` cũng có trong danh sách.
- Ví dụ âm: file chỉ đọc, hoặc đã sửa từ trước khi ô mở và không đổi thêm → không có trong danh sách.
- Ví dụ âm: folder không dùng git → Plan không có danh sách file, hiện "Folder is not a git repository".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-14

### SRS-FR-172 — File diff
When the user chooses a changed file in Plan, the system shall show the changes made to that file since the pane opened.
- Ví dụ: bấm `src/App.tsx` → hiện 12 dòng thêm và 3 dòng bớt so với lúc ô mở.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-14

### SRS-FR-173 — Approved plan
While the session has an approved plan, the system shall show it in Plan.
- Ví dụ: người dùng chọn Duyệt kế hoạch (SRS-FR-167) → Plan hiện kế hoạch đó.
- Ví dụ âm: phiên chưa có kế hoạch được duyệt → Plan không có phần kế hoạch.
- Kiểm chứng: Demo
- Ưu tiên: Could
- Nguồn: BR-14

## 2.24 Xem file

- Luồng chính: 1. Người dùng chọn Xem file trong Folder Menu → SRS-FR-174. 2. Bấm một folder con để vào → SRS-FR-175. 3. Chép đường dẫn của folder hoặc file → SRS-FR-176.

### SRS-FR-174 — Files View
When the user chooses Xem file in the Folder Menu, the system shall open the Files View of that workspace listing its subfolders first, then its files, each subfolder with its number of files and folders.
- Giải thích: chỉ xem, không sửa (BR-15).
- Ví dụ: Xem file trên `agent-deck` → Files View liệt kê `design/`, `src/`, `src-tauri/` trước, rồi `package.json`, `README.md`; dòng `src/` ghi "12 file · 3 folder".
- Kiểm chứng: Test
- Ưu tiên: Could
- Nguồn: BR-15

### SRS-FR-175 — Open a subfolder
When the user chooses a subfolder in the Files View, the system shall show the content of that subfolder and its path from the workspace root.
- Ví dụ: bấm `src/` rồi `components/` → hiện nội dung `components`, đường dẫn "agent-deck / src / components".
- Kiểm chứng: Test
- Ưu tiên: Could
- Nguồn: BR-15

### SRS-FR-176 — Copy a path
When the user chooses Chép đường dẫn on the Files View or on a file, the system shall copy the absolute path of that folder or file to the clipboard.
- Ví dụ: Chép đường dẫn trên `src/App.tsx` → clipboard có `/Users/mionix/Project/personal/agent-deck/src/App.tsx`.
- Kiểm chứng: Test
- Ưu tiên: Could
- Nguồn: BR-15

## 2.25 Cài đặt

- Luồng chính: 1. Người dùng bấm nút Cài đặt ở chân Sidebar → Settings Page (SRS-FR-145). 2. Chọn chế độ quyền mặc định → SRS-FR-177. 3. Xem phiên bản Claude Code → SRS-FR-178. 4. Bấm Dọn file đính kèm → SRS-FR-179, SRS-FR-180.

### SRS-FR-177 — Default permission mode
When the user chooses default, auto or acceptEdits as the default permission mode, the system shall start every later new or resumed session with that mode and keep the choice across launches.
- Giải thích: mặc định là default (mục 3); chế độ chỉ truyền khi chạy phiên, không sửa cấu hình chung (SRS-NFR-006).
- Ví dụ: chọn acceptEdits, thoát app, mở lại, bấm Phiên mới trên `agent-deck` → phiên chạy ở chế độ acceptEdits.
- Ví dụ âm: ô đã mở trước khi đổi → giữ chế độ cũ.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-16

### SRS-FR-178 — Claude Code version
The system shall show the version of Claude Code in use on the Settings Page.
- Ví dụ: máy cài Claude Code 2.1.300 → Settings Page hiện "2.1.300".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-16

### SRS-FR-179 — Clear Prompt Files
When the user chooses Dọn file đính kèm, the system shall delete every Prompt File older than 1 hour that no open pane uses and show the size freed.
- Giải thích: theo A-15.
- Ví dụ: có 30 Prompt File, 25 file cũ hơn 1 giờ và không ô nào dùng → xoá 25 file, hiện dung lượng đã giải phóng, ví dụ 84 MB.
- Ví dụ âm: ảnh vừa dán vào Composer 10 phút trước → giữ lại.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-16

### SRS-FR-180 — Clear never touches other data
The system shall not delete anything other than Prompt Files when clearing.
- Ví dụ âm: Thùng rác, lịch sử phiên, `~/.claude` giữ nguyên.
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BR-16

## 3. Dữ liệu

### Workspace
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Đường dẫn folder | Folder làm việc | Có | Không trùng trong Workspace List (SRS-FR-003) |
| Tên hiển thị | Tên hiện trong danh sách | Có | Bằng tên folder cuối của đường dẫn |
| Thứ tự | Vị trí trong danh sách | Có | Theo thứ tự thêm vào |
| `Missing` | Folder còn trên máy hay không | Có | Tính lại mỗi lần mở app (SRS-FR-005) |

### Session (chỉ đọc, dữ liệu của Claude Code; trừ xoá vào Thùng rác theo SRS-FR-047)
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Mã phiên | Định danh phiên do Claude Code đặt | Có | Duy nhất |
| Folder bắt đầu | Folder nơi phiên được bắt đầu | Có | Quyết định workspace theo RULE-02 |
| Tiêu đề | Tên hiển thị của phiên | Có | Theo RULE-01 |
| Thời điểm hoạt động gần nhất | Lần cuối phiên có hoạt động | Có | Dùng để xếp danh sách (SRS-FR-009) |

### Pane
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Phiên | Phiên chạy trong ô | Có | Một phiên mở ở tối đa một ô (SRS-FR-015) |
| Trạng thái | Trạng thái hiện tại của phiên | Có | Một trong năm trạng thái ở mục 5 |
| Thời điểm vào trạng thái | Lúc phiên vào trạng thái hiện tại | Có | Hiện ở dòng phụ (SRS-FR-033) |
| Lý do | Thao tác chờ duyệt hoặc loại lỗi | Khi `Needs Approval` hoặc `Error` | Theo RULE-04, RULE-06 |
| Pane Shell | Có hay không, đang ẩn hay hiện | Không | Tối đa một mỗi ô (SRS-FR-055); không giữ lại giữa các lần mở app |
| Chế độ đang xem | Chat · Term · Shell · Plan | Có | Mở ô là Chat (SRS-FR-147); không giữ giữa các lần mở app |

### Status Change Record — Deleted (CR-015)
App không ghi độ trễ trạng thái.

### Progress Record — Deleted (CR-015)
Không còn Progress Tracking.

### App settings
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Text Size | Cỡ chữ của cả cửa sổ | Có | 50%–200%, bước 10%, mặc định 100%; giữ lại giữa các lần mở app (SRS-FR-071) |
| Open Panes | Phiên của từng ô và bố cục (vị trí, tỉ lệ) | Không | Giữ lại giữa các lần mở app (SRS-FR-084); không gồm phóng to, Pane Shell |
| Stashed Sessions | Mã phiên, workspace, thời điểm stash của từng phiên để dành | Không | Giữ lại giữa các lần mở app (SRS-FR-111); không ghi vào dữ liệu phiên của Claude Code (SRS-NFR-005) |
| Default permission mode | Chế độ quyền của phiên mới hoặc mở lại | Có | default · auto · acceptEdits, mặc định default; giữ lại giữa các lần mở app (SRS-FR-177) |

### Prompt File
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Tên | Tên file đính kèm | Có | |
| Đường dẫn | Chỗ lưu bản sao trong thư mục dữ liệu của app | Có | Ngoài mọi repo (SRS-FR-161) |
| Thời điểm lưu | Lúc file được dán hoặc kéo vào Composer | Có | Xoá theo SRS-FR-179 |

Trạng thái ẩn của Sidebar không được lưu: mở app thì Sidebar luôn hiện (SRS-FR-090).

Session Selection không được lưu: bỏ khi đóng Session Chooser (SRS-FR-076) và khi thoát app.

## 4. Business rule

| ID | Rule (câu khai báo) | Nguồn |
| --- | --- | --- |
| RULE-01 | Tiêu đề phiên là tiêu đề Claude Code đặt cho phiên; chưa có thì là yêu cầu gần nhất người dùng gõ trong phiên; cũng không có thì là "(untitled)". | BR-02 |
| RULE-02 | Một phiên thuộc workspace khi folder bắt đầu của phiên trùng đúng đường dẫn folder của workspace; phiên bắt đầu ở folder con không thuộc workspace cha. | BR-02 |
| RULE-03 | Phiên ở `Running` khi Claude Code đang xử lý một yêu cầu của người dùng. | BR-06 |
| RULE-04 | Phiên ở `Needs Approval` khi Claude Code đang dừng chờ người dùng cho phép một thao tác hoặc chọn một phương án (A-06). | BR-06 |
| RULE-05 | Phiên ở `Idle` khi Claude Code đã xong yêu cầu và đang chờ yêu cầu mới. | BR-06 |
| RULE-06 | Phiên ở `Error` khi lượt làm việc bị dừng vì lỗi dịch vụ (hết hạn mức, quá tải, lỗi máy chủ, lỗi đăng nhập) hoặc khi phiên thoát bất thường; một lệnh hay công cụ Claude Code chạy bị lỗi mà lượt làm việc vẫn tiếp tục thì không tính là lỗi. Loại lỗi là lý do hiện ở dòng phụ của dòng phiên (SRS-FR-033). | BR-06 |
| RULE-07 | Phiên ở `Ended` khi phiên đã thoát bình thường. | BR-06 |
| RULE-08 | Phiên rời `Error` khi người dùng gửi yêu cầu mới trong phiên đó (sang `Running`) hoặc khi người dùng đóng ô của phiên. | BR-06 |
| RULE-09 | Deleted (CR-010) | BR-09 |
| RULE-10 | Deleted (CR-015) | BR-10 |
| RULE-11 | Deleted (CR-015) | BR-10 |
| RULE-12 | Phiên Input Ready khi Claude Code đang hiện ô nhập của nó, không có hộp thoại nào, và màn hình khớp một mẫu đã biết; không chắc thì không Input Ready. | BR-12 |

## 5. Trạng thái

Sự kiện: `Prompt sent` người dùng gửi yêu cầu · `Approval requested` Claude Code xin phép hoặc hỏi phương án · `Approval answered` người dùng trả lời · `Turn finished` Claude Code xong yêu cầu · `Error occurred` theo RULE-06 · `Exited normally` phiên thoát bình thường · `Exited abnormally` phiên thoát bất thường.

| Trạng thái \ Sự kiện | Prompt sent | Approval requested | Approval answered | Turn finished | Error occurred | Exited normally | Exited abnormally |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Running` | `Running` | `Needs Approval` | giữ nguyên → SRS-FR-035 | `Idle` | `Error` | `Ended` | `Error` |
| `Needs Approval` | giữ nguyên → SRS-FR-035 | `Needs Approval` | `Running` | `Idle` | `Error` | `Ended` | `Error` |
| `Idle` | `Running` | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | `Error` | `Ended` | `Error` |
| `Error` | `Running` | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | `Error` | `Ended` | `Error` |
| `Ended` | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 | giữ nguyên → SRS-FR-035 |

## 6. Giao diện ngoài

| Hệ thống | Trao đổi gì | Khi nào | Bên kia lỗi thì |
| --- | --- | --- | --- |
| Claude Code (lịch sử phiên trên máy) | Danh sách phiên, tiêu đề, folder bắt đầu, thời điểm hoạt động | Mỗi lần người dùng mở Session Chooser | Phiên không đọc được → SRS-FR-011 |
| Thùng rác của hệ điều hành | Nhận lịch sử phiên người dùng xoá | Khi người dùng xác nhận xoá (SRS-FR-047) | Không chuyển được → SRS-FR-050 |
| Claude Code (phiên tương tác) | Chạy phiên mới hoặc tiếp tục phiên cũ trong một ô; nhận phím, trả nội dung hiển thị | Khi mở ô (SRS-FR-013, SRS-FR-018) | Không khởi động được → SRS-FR-017 |
| Claude Code (tín hiệu trạng thái) | Sự kiện đổi trạng thái của phiên trong ô | Liên tục khi ô còn mở | Không theo dõi được → SRS-FR-036 |
| Shell mặc định của hệ điều hành | Nhận phím, trả nội dung hiển thị | Khi mở Pane Shell (SRS-FR-055) | Không khởi động được → SRS-FR-065 |
| Claude Code (hội thoại của phiên, chỉ đọc) | Nội dung hội thoại | Liên tục khi ô mở | Không đọc được → SRS-FR-153 |
| Claude Code (yêu cầu quyền và câu hỏi) | Nhận lựa chọn của người dùng | Khi phiên `Needs Approval` | Yêu cầu đã đổi → SRS-FR-165 |
| git của workspace | Danh sách file không bị bỏ qua | Khi gõ "@" (SRS-FR-160) | Không có git → duyệt folder, bỏ file ẩn |
| git của workspace | Thay đổi của file so với lúc ô mở | Khi ô ở Plan (SRS-FR-171, SRS-FR-172) | Không có git → không có danh sách file |
| Clipboard của hệ điều hành | Đường dẫn | Khi Chép đường dẫn (SRS-FR-144, SRS-FR-176) | |

## 7. Màn hình

| Màn hình | Làm gì | SRS-FR |
| --- | --- | --- |
| Cửa sổ chính · Sidebar | Tiêu đề Agent Deck, Folder Tree (workspace, Session Row, Other Folders, nhóm Để dành), Folder Menu, Thêm folder, nút Cài đặt | SRS-FR-001 đến SRS-FR-006, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-035, SRS-FR-037, SRS-FR-040, SRS-FR-051, SRS-FR-052, SRS-FR-099, SRS-FR-106 đến SRS-FR-112, SRS-FR-141 đến SRS-FR-145, SRS-NFR-014 |
| Session Chooser | Phiên mới, phiên cũ của workspace, nhãn Đang mở, xoá một hoặc nhiều phiên | SRS-FR-007 đến SRS-FR-013, SRS-FR-016, SRS-FR-018, SRS-FR-019, SRS-FR-020, SRS-FR-047 đến SRS-FR-050, SRS-FR-054, SRS-FR-073 đến SRS-FR-079, SRS-NFR-003 |
| Cửa sổ chính · Pane Grid | Làm việc với các phiên, kéo thả ô, đóng ô qua Close Dialog (có thể chuyển phiên vào Thùng rác), ô tự đóng khi phiên thoát bình thường, mở lại các ô khi mở app, phóng to/thu về (nút hoặc nhấp đúp tiêu đề), badge của ô phóng to, View Switch, Chat, Composer, Approval Strip, Question Card, Activity Bar, Plan, Shell, Focus Outline của ô đang focus, nút Stash và Stash Dialog | SRS-FR-014, SRS-FR-015, SRS-FR-017, SRS-FR-021, SRS-FR-023, SRS-FR-024, SRS-FR-025, SRS-FR-026, SRS-FR-027, SRS-FR-028, SRS-FR-029, SRS-FR-030, SRS-FR-036, SRS-FR-041, SRS-FR-042, SRS-FR-043, SRS-FR-044, SRS-FR-045, SRS-FR-046, SRS-FR-055, SRS-FR-056, SRS-FR-057, SRS-FR-058, SRS-FR-060, SRS-FR-061, SRS-FR-062, SRS-FR-063, SRS-FR-064, SRS-FR-065, SRS-FR-066, SRS-FR-067, SRS-FR-072, SRS-FR-080, SRS-FR-081, SRS-FR-082, SRS-FR-083, SRS-FR-084, SRS-FR-085, SRS-FR-086, SRS-FR-087, SRS-FR-100, SRS-FR-101, SRS-FR-102, SRS-FR-103, SRS-FR-104, SRS-FR-105, SRS-FR-146 đến SRS-FR-173 |
| Files View | Folder con và file của một workspace, đường dẫn từ gốc, Chép đường dẫn | SRS-FR-174, SRS-FR-175, SRS-FR-176 |
| Settings Page | Chế độ quyền mặc định, phiên bản Claude Code, Dọn file đính kèm | SRS-FR-145, SRS-FR-177 đến SRS-FR-180 |
| Cửa sổ chính · toàn cửa sổ | Phóng to, thu nhỏ, về mặc định cỡ chữ của mọi chữ trong cửa sổ; ẩn/hiện Sidebar bằng Sidebar Toggle hoặc Sidebar shortcut | SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071, SRS-FR-088, SRS-FR-089, SRS-FR-090 |

### Bảng nhãn

| Nhãn gốc | Chữ hiện |
| --- | --- |
| Add Folder | Thêm folder |
| Remove | Bỏ folder |
| New Session | Phiên mới |
| Resume | Mở lại |
| Delete | Xoá |
| Stash | Để dành |
| Maximize | Phóng to |
| Restore | Thu về |
| Cancel | Huỷ |
| Close | Đóng |
| Close and move to Trash | Đóng và chuyển vào Thùng rác |
| `Missing` | Không còn |
| `Live` | Đang mở |
| `Running` | Đang chạy |
| `Needs Approval` | Cần duyệt |
| `Idle` | Xong lượt |
| `Error` | Lỗi |
| `Ended` | Đã kết thúc |
| `Status unavailable` | Không theo dõi được trạng thái |
| (untitled) | (chưa có tên) |
| "Close the open sessions of this folder first" | "Đóng các phiên đang mở của folder này trước" |
| "No sessions yet" | "Chưa có phiên nào" |
| "<N> sessions could not be read" | "<N> phiên không đọc được" |
| "Folder not found" | "Không tìm thấy folder" |
| "Folder is not a git repository" | "Folder không dùng git" |
| "Claude Code could not be started" | "Không khởi động được Claude Code" |
| "Session is still running." | "Phiên vẫn đang chạy." |
| "Session ended" | "Phiên đã kết thúc" |
| "Move "<title>" to Trash?" | "Chuyển "<title>" vào Thùng rác?" |
| "Close "<title>" and move it to Trash?" | "Đóng "<title>" và chuyển vào Thùng rác?" |
| "Session could not be deleted" | "Không xoá được phiên" |
| "A command is still running in the shell." | "Shell vẫn đang chạy một lệnh." |
| "Shell could not start" | "Không khởi động được shell" |
| "Delete selected (<n>)" | "Xoá đã chọn (<n>)" |
| "Select all" | "Chọn tất cả" |
| "Move <n> sessions to Trash?" | "Chuyển <n> phiên vào Thùng rác?" |
| "Close <k> open sessions and move <n> sessions to Trash?" | "Đóng <k> phiên đang mở và chuyển <n> phiên vào Thùng rác?" |
| "<k> of <n> sessions deleted" | "Đã xoá <k>/<n> phiên" |
| "<k> sessions could not be reopened" | "<k> phiên không mở lại được" |
| "Close "<title>"?" | "Đóng "<title>"?" |
| "Stash "<title>"?" | "Để dành "<title>"?" |

Chuỗi trong ngoặc kép ở FR là nhãn gốc; chữ hiện ra theo bảng này.

## 8. Báo cáo

| Báo cáo | Chỉ số | Lọc | Tần suất | Ai xem | FR | BO |
| --- | --- | --- | --- | --- | --- | --- |
| Status Latency | Deleted (CR-015) | | | | | BO-01 |

BO-01 không có báo cáo trong app và app không ghi độ trễ (CR-015): PO tự kiểm khi dùng; SRS-FR-034 kiểm bằng Test.

BO-02 (≤ 3 thao tác) không có báo cáo trong app: kiểm bằng kịch bản demo theo A-09.

BO-05 không có báo cáo trong app: PO kiểm 6 việc của BR-11 đến BR-16 trên macOS và Windows.

## 9. Yêu cầu phi chức năng

### SRS-NFR-001 — Concurrent panes
The system shall support at least 4 panes open at the same time while meeting SRS-NFR-002.
- Ví dụ: 4 ô, cả 4 phiên đang `Running` → gõ trong ô đang focus vẫn đạt SRS-NFR-002.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-NFR-002 — Input latency
The system shall echo a keystroke in the focused pane within 100 ms at the 95th percentile.
- Ví dụ âm: trong 200 lần gõ, quá 10 lần hiện chậm hơn 100 ms → không đạt.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-NFR-003 — Session list load time
When the user opens the Session Chooser of a workspace with up to 200 sessions, the system shall list its sessions within 3 seconds.
- Giải thích: Sửa ở CR-016: trước là "When the user selects a workspace …, show its Session History Panel".
- Ví dụ: folder có 200 phiên → danh sách trong Session Chooser hiện đủ trước 3 giây kể từ lúc bấm +.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-NFR-004 — Supported platforms
The system shall run as an installed desktop application on macOS 14 or later and on Windows 11.
- Giải thích: macOS là nơi dùng hằng ngày; Windows 11 phải build và chạy được đủ các FR (BRD mục 8).
- Ví dụ: cùng bộ kịch bản demo chạy đạt trên macOS 26 và trên Windows 11.
- Ví dụ: mọi FR của CR-016 kiểm trên cả macOS và Windows 11.
- Ví dụ âm: Windows 10 không thuộc phạm vi kiểm.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-005 — Read-only session history
The system shall not modify any Claude Code session history on the machine other than moving a session the user deletes to the operating system's trash.
- Giải thích: ngoại lệ duy nhất là SRS-FR-047 (BR-08, CR-001). Chat, Plan chỉ đọc hội thoại của phiên, không ghi (CR-016).
- Ví dụ âm: bỏ workspace, resume, đóng ô → không file lịch sử nào của Claude Code bị app sửa hay xoá (chỉ Claude Code tự ghi).
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-006 — No machine-wide Claude Code configuration change
The system shall not change the user's machine-wide Claude Code settings.
- Giải thích: hook và status line dùng cho Chat, Approval Strip, Activity Bar chỉ truyền khi chạy phiên, không ghi vào cấu hình chung (CR-016).
- Ví dụ âm: sau khi dùng app, cấu hình Claude Code chung của máy giống hệt trước khi cài app.
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-007 — Data stays on the machine
The system shall not send session content or session history to any network destination.
- Giải thích: theo A-07. Claude Code tự gọi máy chủ của nó thì không tính. Sửa ở CR-015: bỏ ngoại lệ tóm tắt tiến độ của CR-012.
- Ví dụ âm: theo dõi kết nối mạng của app trong một phiên làm việc 30 phút → không có kết nối nào do app mở ra.
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-008 — Interface language
The system shall display its own labels and messages in Vietnamese, as listed in the Bảng nhãn of section 7.
- Giải thích: chỉ nhãn và thông báo của app; nội dung người dùng gõ trong ô vẫn là tiếng Việt được (SRS-FR-026). Sửa ở CR-016, trước là tiếng Anh (Q-05).
- Ví dụ: nút "Mở lại", thông báo "Không tìm thấy folder".
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-NFR-009 — Sidebar section tints — Deleted (CR-016)
Sidebar không còn chia section có tint riêng.

### SRS-NFR-010 — Stashed Sessions tint — Deleted (CR-016)
Sidebar không còn chia section có tint riêng.

### SRS-NFR-011 — Pane session untouched — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-NFR-012 — No history from summaries — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-NFR-013 — Summary model and login — Deleted (CR-015)
Không còn Progress Tracking.

### SRS-NFR-014 — Status word contrast
The system shall show every status word and status-tinted row with a text contrast of at least 4.5:1 in both light and dark themes.
- Giải thích: thay ý về độ tương phản chữ của SRS-NFR-009, SRS-NFR-010 đã xoá.
- Ví dụ: chữ "Cần duyệt" trên nền vàng nhạt đạt 7:1 ở theme sáng và 6:1 ở theme tối → đạt.
- Ví dụ âm: chữ "Lỗi" trên nền đỏ nhạt chỉ 3.2:1 → không đạt.
- Kiểm chứng: Analysis
- Ưu tiên: Should
- Nguồn: BR-06

## 10. Ràng buộc thiết kế

- Ứng dụng desktop cài trên máy, không phải trang web (BRD mục 8).
- Một người dùng, không có tài khoản hay đăng nhập riêng của app.
- Claude Code là agent duy nhất ở bản này.

## 11. Kiểm chứng

| SRS-ID | Cách | Tiêu chí đậu |
| --- | --- | --- |
| SRS-FR-001 đến SRS-FR-180 (trừ SRS-FR-022, SRS-FR-031, SRS-FR-038, SRS-FR-039, SRS-FR-053, SRS-FR-059, SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098, SRS-FR-113, SRS-FR-114, SRS-FR-115, SRS-FR-116, SRS-FR-117, SRS-FR-118, SRS-FR-119, SRS-FR-120, SRS-FR-121, SRS-FR-122, SRS-FR-123, SRS-FR-124, SRS-FR-125, SRS-FR-126, SRS-FR-127, SRS-FR-128, SRS-FR-129, SRS-FR-130, SRS-FR-131, SRS-FR-132, SRS-FR-133, SRS-FR-134, SRS-FR-135, SRS-FR-136, SRS-FR-137, SRS-FR-138, SRS-FR-139, SRS-FR-140 đã xoá) | Theo dòng Kiểm chứng của từng FR | Mọi Ví dụ và Ví dụ âm của FR cho đúng kết quả ghi trong FR |
| SRS-FR-034 | Test | 20 lần đổi trạng thái liên tiếp, mọi lần Status Highlight hiện ≤ 3 giây |
| SRS-FR-150 | Test | 20 lần ghi hội thoại liên tiếp, mọi lần hiện trong Chat ≤ 1 giây |
| SRS-NFR-001 đến SRS-NFR-014 (trừ SRS-NFR-009, SRS-NFR-010, SRS-NFR-011, SRS-NFR-012, SRS-NFR-013 đã xoá) | Theo dòng Kiểm chứng của từng NFR | Đạt đúng con số trong câu SHALL |

## 12. Bảng truy vết

<!-- Dựng lại bằng grep ID từ các khối requirement; cột OpenSpec do /dev-feature điền. -->
| SRS-ID | BR | OpenSpec change / requirement | Kiểm chứng | Trạng thái |
| --- | --- | --- | --- | --- |
| SRS-FR-001 | BR-01 | | Test | Baselined |
| SRS-FR-002 | BR-01 | | Test | Baselined |
| SRS-FR-003 | BR-01 | | Test | Baselined |
| SRS-FR-004 | BR-01 | | Test | Baselined |
| SRS-FR-005 | BR-01 | | Test | Baselined |
| SRS-FR-006 | BR-01 | | Test | Baselined |
| SRS-FR-007 | BR-02 | | Test | Baselined |
| SRS-FR-008 | BR-02 | | Test | Baselined |
| SRS-FR-009 | BR-02 | | Test | Baselined |
| SRS-FR-010 | BR-02 | | Test | Baselined |
| SRS-FR-011 | BR-02 | | Test | Baselined |
| SRS-FR-012 | BR-02 | | Demo | Baselined |
| SRS-FR-013 | BR-03 | | Demo | Baselined |
| SRS-FR-014 | BR-03 | | Test | Baselined |
| SRS-FR-015 | BR-03 | | Test | Baselined |
| SRS-FR-016 | BR-03 | | Test | Baselined |
| SRS-FR-017 | BR-03 | | Test | Baselined |
| SRS-FR-018 | BR-04 | | Demo | Baselined |
| SRS-FR-019 | BR-04 | | Test | Baselined |
| SRS-FR-020 | BR-04 | | Test | Baselined |
| SRS-FR-021 | BR-05 | | Demo | Baselined |
| SRS-FR-022 | BR-05 | | Demo | Deleted (CR-005) |
| SRS-FR-023 | BR-05 | | Demo | Baselined |
| SRS-FR-024 | BR-05 | | Demo | Baselined |
| SRS-FR-025 | BR-05 | | Demo | Baselined |
| SRS-FR-026 | BR-05 | | Demo | Baselined |
| SRS-FR-027 | BR-05 | | Test | Baselined |
| SRS-FR-028 | BR-05 | | Test | Baselined |
| SRS-FR-029 | BR-05 | | Test | Baselined |
| SRS-FR-030 | BR-05 | | Demo | Baselined |
| SRS-FR-031 | BR-06 | | Inspection | Deleted (CR-001) |
| SRS-FR-032 | BR-06 | | Test | Baselined |
| SRS-FR-033 | BR-06 | | Test | Baselined |
| SRS-FR-034 | BR-06 | | Test | Baselined |
| SRS-FR-035 | BR-06 | | Test | Baselined |
| SRS-FR-036 | BR-06 | | Test | Baselined |
| SRS-FR-037 | BR-07 | | Demo | Baselined |
| SRS-FR-038 | BR-06 | | Test | Deleted (CR-015) |
| SRS-FR-039 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-040 | BR-06 | | Test | Baselined |
| SRS-FR-041 | BR-05 | | Demo | Baselined |
| SRS-FR-042 | BR-05 | | Demo | Baselined |
| SRS-FR-043 | BR-05 | | Demo | Baselined |
| SRS-FR-044 | BR-06 | | Test | Baselined |
| SRS-FR-045 | BR-07 | | Demo | Baselined |
| SRS-FR-046 | BR-05 | | Test | Baselined |
| SRS-FR-047 | BR-08 | | Test | Baselined |
| SRS-FR-048 | BR-08 | | Test | Baselined |
| SRS-FR-049 | BR-08 | | Test | Baselined |
| SRS-FR-050 | BR-08 | | Test | Baselined |
| SRS-FR-051 | BR-06 | | Test | Baselined |
| SRS-FR-052 | BR-06 | | Test | Baselined |
| SRS-FR-053 | BR-06 | | Test | Deleted (CR-016) |
| SRS-FR-054 | BR-02 | | Test | Baselined |
| SRS-FR-055 | BR-05 | | Demo | Baselined |
| SRS-FR-056 | BR-05 | | Test | Baselined |
| SRS-FR-057 | BR-05 | | Demo | Baselined |
| SRS-FR-058 | BR-05 | | Test | Baselined |
| SRS-FR-059 | BR-05 | | Demo | Deleted (CR-016) |
| SRS-FR-060 | BR-05 | | Demo | Baselined |
| SRS-FR-061 | BR-05 | | Test | Baselined |
| SRS-FR-062 | BR-05 | | Test | Baselined |
| SRS-FR-063 | BR-05 | | Test | Baselined |
| SRS-FR-064 | BR-05 | | Test | Baselined |
| SRS-FR-065 | BR-05 | | Test | Baselined |
| SRS-FR-066 | BR-05 | | Test | Baselined |
| SRS-FR-067 | BR-05 | | Test | Baselined |
| SRS-FR-068 | BR-05 | | Test | Baselined |
| SRS-FR-069 | BR-05 | | Test | Baselined |
| SRS-FR-070 | BR-05 | | Test | Baselined |
| SRS-FR-071 | BR-05 | | Test | Baselined |
| SRS-FR-072 | BR-05 | | Demo | Baselined |
| SRS-FR-073 | BR-08 | | Test | Baselined |
| SRS-FR-074 | BR-08 | | Test | Baselined |
| SRS-FR-075 | BR-08 | | Test | Baselined |
| SRS-FR-076 | BR-08 | | Test | Baselined |
| SRS-FR-077 | BR-08 | | Test | Baselined |
| SRS-FR-078 | BR-08 | | Test | Baselined |
| SRS-FR-079 | BR-08 | | Test | Baselined |
| SRS-FR-080 | BR-05 | | Test | Baselined |
| SRS-FR-081 | BR-05 | | Test | Baselined |
| SRS-FR-082 | BR-05 | | Test | Baselined |
| SRS-FR-083 | BR-05 | | Test | Baselined |
| SRS-FR-084 | BR-03 | | Test | Baselined |
| SRS-FR-085 | BR-03 | | Demo | Baselined |
| SRS-FR-086 | BR-03 | | Test | Baselined |
| SRS-FR-087 | BR-05 | | Test | Baselined |
| SRS-FR-088 | BR-05 | | Test | Baselined |
| SRS-FR-089 | BR-05 | | Test | Baselined |
| SRS-FR-090 | BR-05 | | Test | Baselined |
| SRS-FR-091 | BR-09 | | Test | Deleted (CR-015) |
| SRS-FR-092 | BR-09 | | Demo | Deleted (CR-015) |
| SRS-FR-093 | BR-09 | | Test | Deleted (CR-015) |
| SRS-FR-094 | BR-09 | | Test | Deleted (CR-010) |
| SRS-FR-095 | BR-09 | | Inspection | Deleted (CR-010) |
| SRS-FR-096 | BR-09 | | Test | Deleted (CR-015) |
| SRS-FR-097 | BR-09 | | Test | Deleted (CR-015) |
| SRS-FR-098 | BR-09 | | Test | Deleted (CR-010) |
| SRS-FR-099 | BR-05 | | Test | Baselined |
| SRS-FR-100 | BR-05 | | Test | Baselined |
| SRS-FR-101 | BR-08 | | Test | Baselined |
| SRS-FR-102 | BR-08 | | Test | Baselined |
| SRS-FR-103 | BR-03 | | Demo | Baselined |
| SRS-FR-104 | BR-03 | | Test | Baselined |
| SRS-FR-105 | BR-03 | | Test | Baselined |
| SRS-FR-106 | BR-03 | | Test | Baselined |
| SRS-FR-107 | BR-03 | | Test | Baselined |
| SRS-FR-108 | BR-03 | | Test | Baselined |
| SRS-FR-109 | BR-03 | | Test | Baselined |
| SRS-FR-110 | BR-03 | | Test | Baselined |
| SRS-FR-111 | BR-03 | | Test | Baselined |
| SRS-FR-112 | BR-03 | | Test | Baselined |
| SRS-FR-113 | BR-10 | | Demo | Deleted (CR-015) |
| SRS-FR-114 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-115 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-116 | BR-10 | | Demo | Deleted (CR-015) |
| SRS-FR-117 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-118 | BR-10 | | Demo | Deleted (CR-015) |
| SRS-FR-119 | BR-10 | | Demo | Deleted (CR-015) |
| SRS-FR-120 | BR-10 | | Demo | Deleted (CR-015) |
| SRS-FR-121 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-122 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-123 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-124 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-125 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-126 | BR-10 | | Analysis | Deleted (CR-015) |
| SRS-FR-127 | BR-10 | | Analysis | Deleted (CR-015) |
| SRS-FR-128 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-129 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-130 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-131 | BR-10 | | Test | Deleted (CR-015) |
| SRS-FR-132 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-133 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-134 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-135 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-136 | BR-07 | | Demo | Deleted (CR-014) |
| SRS-FR-137 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-138 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-139 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-140 | BR-06 | | Test | Deleted (CR-014) |
| SRS-FR-141 | BR-01 | | Test | Baselined |
| SRS-FR-142 | BR-06 | | Test | Baselined |
| SRS-FR-143 | BR-01 | | Test | Baselined |
| SRS-FR-144 | BR-01 | | Test | Baselined |
| SRS-FR-145 | BR-16 | | Demo | Baselined |
| SRS-FR-146 | BR-05 | | Test | Baselined |
| SRS-FR-147 | BR-05 | | Test | Baselined |
| SRS-FR-148 | BR-05 | | Test | Baselined |
| SRS-FR-149 | BR-11 | | Demo | Baselined |
| SRS-FR-150 | BR-11 | | Test | Baselined |
| SRS-FR-151 | BR-11 | | Test | Baselined |
| SRS-FR-152 | BR-11 | | Test | Baselined |
| SRS-FR-153 | BR-11 | | Test | Baselined |
| SRS-FR-154 | BR-12 | | Test | Baselined |
| SRS-FR-155 | BR-12 | | Test | Baselined |
| SRS-FR-156 | BR-12 | | Test | Baselined |
| SRS-FR-157 | BR-12 | | Test | Baselined |
| SRS-FR-158 | BR-12 | | Test | Baselined |
| SRS-FR-159 | BR-12 | | Test | Baselined |
| SRS-FR-160 | BR-12 | | Test | Baselined |
| SRS-FR-161 | BR-12 | | Test | Baselined |
| SRS-FR-162 | BR-12 | | Test | Baselined |
| SRS-FR-163 | BR-13 | | Test | Baselined |
| SRS-FR-164 | BR-13 | | Test | Baselined |
| SRS-FR-165 | BR-13 | | Test | Baselined |
| SRS-FR-166 | BR-13 | | Test | Baselined |
| SRS-FR-167 | BR-13 | | Test | Baselined |
| SRS-FR-168 | BR-13 | | Test | Baselined |
| SRS-FR-169 | BR-14 | | Test | Baselined |
| SRS-FR-170 | BR-14 | | Test | Baselined |
| SRS-FR-171 | BR-14 | | Test | Baselined |
| SRS-FR-172 | BR-14 | | Demo | Baselined |
| SRS-FR-173 | BR-14 | | Demo | Baselined |
| SRS-FR-174 | BR-15 | | Test | Baselined |
| SRS-FR-175 | BR-15 | | Test | Baselined |
| SRS-FR-176 | BR-15 | | Test | Baselined |
| SRS-FR-177 | BR-16 | | Test | Baselined |
| SRS-FR-178 | BR-16 | | Test | Baselined |
| SRS-FR-179 | BR-16 | | Test | Baselined |
| SRS-FR-180 | BR-16 | | Inspection | Baselined |
| SRS-NFR-001 | BR-05 | | Test | Baselined |
| SRS-NFR-002 | BR-05 | | Test | Baselined |
| SRS-NFR-003 | BR-02 | | Test | Baselined |
| SRS-NFR-004 | BRD mục 8 (ràng buộc) | | Demo | Baselined |
| SRS-NFR-005 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-006 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-007 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-008 | BR-06 | | Inspection | Baselined |
| SRS-NFR-009 | BR-06 | | Analysis | Deleted (CR-016) |
| SRS-NFR-010 | BR-03 | | Analysis | Deleted (CR-016) |
| SRS-NFR-011 | BR-10 | | Inspection | Deleted (CR-015) |
| SRS-NFR-012 | BR-10 | | Test | Deleted (CR-015) |
| SRS-NFR-013 | BRD mục 8 (ràng buộc) | | Inspection | Deleted (CR-015) |
| SRS-NFR-014 | BR-06 | | Analysis | Baselined |

## 13. Câu hỏi mở

| ID | Câu hỏi | Người trả lời | Trạng thái | Chặn gate |
| --- | --- | --- | --- | --- |
| Q-01 | Đo BO-01 (≤ 3 giây) và BO-02 (≤ 3 thao tác) bằng cách nào? | PO | Đã trả lời 2026-10-15: BO-01 báo cáo Status Latency trong app, từ CR-014 đọc file bản ghi độ trễ, từ CR-015 PO tự kiểm khi dùng (app không ghi độ trễ); BO-02 kịch bản demo (A-09) | Có |
| Q-02 | Tình huống nào tính là `Error`, và lỗi được xoá khỏi bảng lúc nào? | PO | Đã trả lời 2026-10-15: chỉ lỗi làm dừng lượt hoặc phiên (RULE-06); hết lỗi khi gửi yêu cầu mới hoặc đóng ô (RULE-08) | Có |
| Q-03 | Số ô chạy cùng lúc, độ trễ gõ phím, thời gian tải danh sách phiên tối thiểu là bao nhiêu? | PO | Đã trả lời 2026-10-15: ≥ 4 ô; ≤ 100 ms p95; 200 phiên ≤ 3 giây | Có |
| Q-04 | Bản đầu phải chạy trên phiên bản macOS và Windows nào? | PO | Đã trả lời 2026-10-15: macOS 14 trở lên, Windows 11 | Có |
| Q-05 | Giao diện app dùng tiếng Anh hay tiếng Việt? | PO | Đã trả lời 2026-10-15: tiếng Anh; đổi 2026-11-24 (CR-016): tiếng Việt | Có |

## 14. Duyệt

| Version | Ngày | Người duyệt | Ghi chú |
| --- | --- | --- | --- |
| v1.0 | 2026-10-15 | PO | Baseline; theo BRD v1.0 |
| v1.1 | 2026-10-17 | PO | CR-001: Status Highlight thay Status Board (SRS-FR-031 xoá); phóng to ô; xoá phiên vào Thùng rác; theo BRD v2.0 |
| v1.2 | 2026-10-17 | PO | CR-002: Active Sessions ở cột trái, lịch sử phiên sang Session History Panel; thêm SRS-FR-051 đến SRS-FR-054, SRS-NFR-009; theo BRD v2.1 |
| v1.3 | 2026-10-17 | PO | CR-003: Pane Shell dưới phiên trong cùng ô, ẩn đi mà vẫn chạy; thêm SRS-FR-055 đến SRS-FR-065; theo BRD v2.2 |
| v1.4 | 2026-10-18 | PO | CR-004: nhấp đúp tiêu đề ô để phóng to/thu về; Text Size cả cửa sổ bằng Zoom shortcut; xoá nhiều phiên cùng lúc; thêm SRS-FR-066 đến SRS-FR-079; theo BRD v2.3 |
| v1.5 | 2026-10-19 | PO | CR-005: kéo thả ô thay `Split Down` (SRS-FR-022 xoá); ô tự đóng khi phiên thoát bình thường; mở lại các ô khi mở app; sửa SRS-FR-028, SRS-FR-046, SRS-FR-064; thêm SRS-FR-080 đến SRS-FR-086; theo BRD v2.4 |
| v1.6 | 2026-10-20 | PO | CR-006: Focus Outline cho ô đang focus; ẩn/hiện Sidebar bằng nút và Cmd+B / Ctrl+B, mở app luôn hiện; thêm SRS-FR-087 đến SRS-FR-090; theo BRD v2.5 |
| v1.7 | 2026-10-21 | PO | CR-007: Session Goal ghim trên Goal Line, sửa được, giữ giữa các lần mở app; Focus Reminder gửi cùng mỗi prompt, Claude Code nhắc khi lạc đề theo RULE-09; thêm SRS-FR-091 đến SRS-FR-098, A-10, A-11; theo BRD v3.0 |
| v1.8 | 2026-10-21 | PO | CR-008: Row Focus Mark trên dòng Active Sessions của ô đang focus, ở mọi trạng thái, không thay Status Highlight; thêm SRS-FR-099, Row Focus Mark; theo BRD v3.0 |
| v1.9 | 2026-10-21 | PO | CR-009: bấm × trên ô luôn hiện Close Dialog (Cancel · Close · Close and move to Trash), cảnh báo bận nằm trong hộp thay hai hộp riêng; `/exit` giữ nguyên; sửa SRS-FR-027, SRS-FR-029, SRS-FR-063; thêm SRS-FR-100 đến SRS-FR-102, Close Dialog; theo BRD v3.1 |
| v1.10 | 2026-10-22 | PO | CR-010: bỏ Focus Reminder và luật lạc đề (xoá SRS-FR-094, SRS-FR-095, SRS-FR-098, RULE-09, A-10, A-11); Goal Line thành Target Box chữ đỏ, sửa trực tiếp, tối đa 3 dòng rồi cuộn; sửa SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-096, SRS-FR-097; theo BRD v4.0 |
| v1.11 | 2026-10-22 | PO | CR-011: Stashed Sessions trong Sidebar, nút Stash trên tiêu đề ô bên trái Maximize, Stash Dialog khi ô bận, mở lại thì rời stash, × để gỡ, giữ giữa các lần mở app; thêm SRS-FR-103 đến SRS-FR-112, SRS-NFR-010, Stashed Sessions, Stash Dialog; theo BRD v4.1 |
| v1.12 | 2026-10-25 | PO | CR-012: Progress Tracking bật theo phiên (Tracking Prompt, Tracking button), Progress Strip dưới Target Box chỉ đọc, Checkpoint List cập nhật sau mỗi lượt ≤ 30 giây bằng Claude Haiku qua login Claude Code, giữ giữa các lần mở app; sửa SRS-NFR-007, A-07; thêm SRS-FR-113 đến SRS-FR-131, SRS-NFR-011 đến SRS-NFR-013, RULE-10, RULE-11, A-12 và thuật ngữ; theo BRD v5.0 |
| v1.13 | 2026-11-20 | PO | CR-013: Status Summary ở đầu cửa sổ (headline "N need you" / "All clear" / "Agent Deck · No sessions running", số đếm theo trạng thái, Go-to button, thu gọn khi focus ở ô hoặc cửa sổ < 1100 px, ẩn khi phóng to); thêm SRS-FR-132 đến SRS-FR-140; theo BRD v5.1 |
| v1.14 | 2026-11-22 | PO | CR-014: bỏ Status Summary và báo cáo Status Latency trong app (xoá SRS-FR-039, SRS-FR-132 đến SRS-FR-140); vẫn ghi độ trễ (SRS-FR-038); theo BRD v5.2 |
| v1.15 | 2026-11-23 | PO | CR-015: bỏ Target Box và Session Goal, Progress Tracking, ghi độ trễ trạng thái (xoá SRS-FR-038, SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-096, SRS-FR-097, SRS-FR-113 đến SRS-FR-131, SRS-NFR-011 đến SRS-NFR-013, RULE-10, RULE-11, A-12); SRS-NFR-007, A-07 về lại không có ngoại lệ; theo BRD v6.0 |
| v1.16 | 2026-11-24 | PO | CR-016: giao diện theo agent-deck-remote; Folder Tree thay Workspace List, Active Sessions; Session Chooser thay Session History Panel; View Switch Chat · Term · Shell · Plan, Pane Shell thành chế độ Shell; nhãn tiếng Việt; thêm SRS-FR-141 đến SRS-FR-180, SRS-NFR-014, RULE-12, A-13, A-14, A-15; xoá SRS-FR-053, SRS-FR-059, SRS-NFR-009, SRS-NFR-010; theo BRD v7.0 |
| v1.17 | 2026-11-25 | PO | CR-017: SRS-FR-141 nhóm Folder khác mở sẵn khi không folder nào có phiên mở; theo BRD v7.0 |
| v1.18 | 2026-11-27 | PO | CR-021: chấm trạng thái của Session Row thành icon tròn 28px (One UI, CR-020) |
| v1.19 | 2026-11-28 | PO | CR-022: Plan lấy file đã đổi bằng git, tính từ lúc ô mở (SRS-FR-171, SRS-FR-172) |
