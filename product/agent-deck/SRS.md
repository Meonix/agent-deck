---
req-doc: srs
slug: agent-deck
scope: product
status: Baselined v1.0 (2026-10-15)
source: product/agent-deck/BRD.md
---
# SRS — agent-deck

<!-- Per ISO/IEC/IEEE 29148. Say what the system does, not how.
     Explanations in Vietnamese; EARS requirement sentences in English, one SHALL. -->

## 1. Giới thiệu

### Mục đích

Đặc tả hành vi của agent-deck, ứng dụng desktop cá nhân để làm việc với nhiều phiên Claude Code
cùng lúc, phục vụ BO-01 (không sót phiên chờ duyệt hoặc lỗi) và BO-02 (mở lại phiên cũ ≤ 3 thao tác)
của BRD v1.0.

### Phạm vi

Trong phạm vi: BR-01 đến BR-07 của BRD. Ngoài phạm vi: như BRD mục 5. Cụ thể, phiên Claude Code mở
ngoài agent-deck vẫn hiện trong lịch sử phiên nhưng không có trạng thái và không lên bảng trạng thái.

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
| A-07 | Ứng dụng không gửi dữ liệu phiên ra khỏi máy | PO |
| A-08 | Bản đầu được kiểm trên Claude Code 2.1.300, bản đang cài trên máy PO ngày 2026-10-15 | PO |
| A-09 | BO-02 kiểm bằng kịch bản demo: mở app → chọn folder → chọn phiên → Resume, đếm thao tác trên 5 phiên khác nhau (Q-01) | PO |

### Thuật ngữ

| Từ | Nghĩa |
| --- | --- |
| Workspace | Folder làm việc mà người dùng đã thêm vào danh sách |
| Workspace List | Danh sách folder làm việc |
| `Missing` | Workspace mà folder của nó không còn trên máy |
| Session | Một phiên làm việc của Claude Code, gắn với folder nơi nó được bắt đầu |
| Session History | Danh sách phiên đã có trên máy của một workspace |
| `Live` | Phiên đang mở trong một ô của agent-deck |
| Pane | Một ô trong cửa sổ, chạy đúng một phiên |
| Status Board | Bảng trạng thái, ba cột |
| `Running` | Đang chạy |
| `Needs Approval` | Cần duyệt |
| `Idle` | Rảnh, chờ yêu cầu mới |
| `Error` | Lỗi |
| `Ended` | Đã kết thúc |
| Thao tác | Một lần bấm chuột hoặc một phím tắt |

## 2. Yêu cầu chức năng

## 2.1 Quản lý folder làm việc

- Luồng chính: 1. Người dùng chọn "Add Folder" và chọn một folder. 2. Folder hiện trong Workspace List. 3. Người dùng chọn folder đó; lịch sử phiên của nó hiện ra (2.2).
- Luồng chính (bỏ folder): 1. Người dùng chọn "Remove" trên một workspace. 2. Workspace biến khỏi danh sách; lịch sử phiên trên máy giữ nguyên.
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
When the user removes a workspace, the system shall delete that workspace from the Workspace List without deleting any Claude Code session history of its folder.
- Giải thích: bỏ khỏi danh sách chỉ là bỏ khỏi app; dữ liệu Claude Code không bị đụng tới.
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

- Luồng chính: 1. Người dùng chọn một workspace. 2. Hệ thống liệt kê các phiên bắt đầu trong đúng folder đó theo RULE-02, mỗi phiên có tiêu đề (RULE-01) và thời điểm hoạt động gần nhất.
- Luồng thay thế: A1 folder chưa có phiên nào → hiện "No sessions yet" → SRS-FR-010
- Luồng thay thế: A2 phiên bắt đầu ở folder con → không thuộc workspace cha theo RULE-02 → SRS-FR-007
- Luồng ngoại lệ: E1 có phiên không đọc được → báo số phiên không đọc được → SRS-FR-011

### SRS-FR-007 — List sessions of a workspace
When the user selects a workspace, the system shall list every Claude Code session that belongs to that workspace per RULE-02.
- Giải thích: mỗi lần chọn folder thì danh sách được đọc lại, nên phiên mới tạo ngoài app cũng hiện ra.
- Ví dụ: chọn `agent-deck` có 3 phiên → danh sách 3 dòng.
- Ví dụ âm: phiên bắt đầu ở `/Users/mionix/Project/agent-deck/ui` → không có trong danh sách của `agent-deck`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-008 — Show session title and last activity
The system shall show the title per RULE-01 and the last activity time of each session in the session list.
- Ví dụ: phiên có tiêu đề Claude Code đặt là "Scaffold Tauri app", hoạt động lần cuối 2 phút trước → dòng "Scaffold Tauri app · 2 min ago".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-009 — Order session list
The system shall order the session list by last activity time, newest first.
- Giải thích: theo A-03, phiên vừa làm nằm trên cùng để mở lại ít thao tác nhất.
- Ví dụ: phiên A hoạt động hôm qua, phiên B 2 phút trước → B nằm trên A.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-010 — Empty session list
If the selected workspace has no session, then the system shall show the message "No sessions yet" in the session list.
- Ví dụ âm: folder mới tinh chưa chạy Claude Code lần nào → hiện "No sessions yet".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-011 — Report unreadable sessions
If one or more sessions of the selected workspace cannot be read, then the system shall show the notice "<N> sessions could not be read" in the session list.
- Giải thích: theo rủi ro trong BRD, Claude Code đổi cách lưu phiên thì phải báo rõ, không im lặng hiện thiếu.
- Ví dụ âm: 10 phiên, 2 phiên hỏng → hiện 8 phiên và dòng "2 sessions could not be read".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-012 — Mark live sessions
While a session is open in a pane, the system shall mark that session as `Live` in the session list.
- Ví dụ: phiên "Scaffold Tauri app" đang mở trong một ô → dòng của nó có nhãn `Live`.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-02

## 2.3 Mở lại phiên cũ

- Luồng chính: 1. Người dùng chọn một workspace. 2. Người dùng chọn một phiên trong danh sách. 3. Người dùng chọn "Resume". 4. Một ô mới mở, tiếp tục đúng phiên đó với hội thoại cũ, con trỏ nhập liệu ở ô đó.
- Luồng thay thế: A1 phiên đã đang mở trong một ô → chuyển tới ô đó → SRS-FR-015
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối → SRS-FR-016
- Luồng ngoại lệ: E2 không khởi động được Claude Code → báo trong ô → SRS-FR-017

### SRS-FR-013 — Resume a session
When the user resumes a session from the session list, the system shall open a new pane that continues that session in its workspace folder.
- Giải thích: hội thoại cũ còn nguyên, người dùng gõ tiếp được ngay.
- Ví dụ: resume "Scaffold Tauri app" → ô mới hiện lại hội thoại trước, gõ "tiếp tục" được Claude Code trả lời trong ngữ cảnh cũ.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-03

### SRS-FR-014 — Focus the new pane
When a pane opens, the system shall move keyboard focus to that pane.
- Giải thích: để mở lại phiên tốn đúng 3 thao tác theo BO-02, không phải bấm thêm vào ô.
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

- Luồng chính: 1. Người dùng chọn một workspace. 2. Người dùng chọn "New Session". 3. Một ô mới mở, chạy phiên Claude Code mới trong folder đó, con trỏ ở ô đó (SRS-FR-014).
- Luồng thay thế: A1 phiên mới xuất hiện ngay trong danh sách phiên của workspace → SRS-FR-019
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối → SRS-FR-020
- Luồng ngoại lệ: E2 không khởi động được Claude Code → báo trong ô (như SRS-FR-017)

### SRS-FR-018 — Start a new session
When the user starts a new session in the selected workspace, the system shall open a new pane that runs a new Claude Code session in that workspace folder.
- Ví dụ: chọn `agent-deck`, bấm "New Session" → ô mới, Claude Code chạy trong `/Users/mionix/Project/personal/agent-deck`.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-04

### SRS-FR-019 — Add the new session to the session list
When a new session starts in a pane, the system shall add that session to the session list of its workspace.
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

- Luồng chính: 1. Người dùng mở thêm phiên (2.3, 2.4); mỗi phiên mở ra bằng cách chia đôi ô đang focus. 2. Người dùng kéo vách ngăn để đổi kích thước. 3. Người dùng gõ và dùng chuột trong từng ô như trong terminal thường. 4. Người dùng đóng ô khi xong.
- Luồng thay thế: A1 người dùng chọn chia xuống dưới thay vì sang phải → SRS-FR-022
- Luồng thay thế: A2 phiên trong ô tự thoát → ô báo "Session ended" → SRS-FR-028
- Luồng ngoại lệ: E1 đóng ô khi phiên đang `Running` hoặc `Needs Approval` → hỏi xác nhận → SRS-FR-027

### SRS-FR-021 — Split right by default
When a new pane opens, the system shall split the focused pane and place the new pane to its right.
- Giải thích: ô đầu tiên chiếm cả vùng làm việc; các ô sau chia từ ô đang focus.
- Ví dụ: đang có 1 ô, resume thêm một phiên → 2 ô cạnh nhau, ô mới bên phải.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-022 — Split down on request
Where the user chooses `Split Down` when opening a pane, the system shall place the new pane below the focused pane.
- Ví dụ: chọn `Split Down` khi bấm "New Session" → ô mới nằm dưới ô đang focus.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

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
- Giải thích: "thao tác đầy đủ như terminal thường" trong BR-05; mốc so là Terminal trên macOS, Windows Terminal trên Windows.
- Ví dụ: cùng một phiên Claude Code, ô của agent-deck và Terminal.app hiện cùng màu, cùng menu chọn, cuộn và bôi đen copy được như nhau.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-026 — Vietnamese input
The system shall accept Vietnamese text typed through an operating system input method in every pane.
- Ví dụ: gõ "sửa lỗi đăng nhập" bằng bộ gõ Telex của macOS → ô nhận đúng chuỗi có dấu, không lặp hay mất ký tự.
- Ví dụ âm: chuỗi "đăng nhập" hiện thành "ddang nhaap" → không đạt.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-027 — Confirm closing a busy pane
If the user closes a pane whose session is `Running` or `Needs Approval`, then the system shall ask for confirmation before closing that pane.
- Giải thích: theo A-05, tránh lỡ tay cắt ngang việc đang làm.
- Ví dụ âm: ô đang `Running`, bấm đóng → hiện hộp "Session is still running. Close anyway?"; chọn Cancel → ô vẫn chạy.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-028 — Show session ended
When the session in a pane exits, the system shall show the message "Session ended" in that pane.
- Ví dụ: gõ `/exit` trong ô → ô hiện "Session ended", vẫn xem lại được nội dung cũ.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-029 — Close pane ends its session
When the user closes a pane, the system shall end the Claude Code session running in that pane.
- Giải thích: không để phiên chạy ngầm không ai thấy.
- Ví dụ: đóng ô có phiên `Idle` → ô biến mất, phiên kết thúc, dòng của nó trong danh sách phiên mất nhãn `Live`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-05

### SRS-FR-030 — Pane header
The system shall show the workspace name and the session title in the header of each pane.
- Ví dụ: ô của phiên "Scaffold Tauri app" trong `agent-deck` → tiêu đề ô "agent-deck · Scaffold Tauri app".
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-05

## 2.6 Bảng trạng thái

- Luồng chính: 1. Một phiên trong ô đổi trạng thái theo RULE-03 đến RULE-07. 2. Status Board cập nhật trong ≤ 3 giây. 3. Phiên `Running`, `Needs Approval`, `Error` hiện thẻ ở cột tương ứng; `Idle` và `Ended` không có thẻ.
- Luồng thay thế: A1 phiên mở ngoài agent-deck → không có trạng thái, không lên bảng (BRD mục 5).
- Luồng thay thế: A2 một lệnh hay công cụ Claude Code chạy bị lỗi nhưng lượt vẫn tiếp → không tính `Error` theo RULE-06 → SRS-FR-032
- Luồng thay thế: A3 phiên `Error` nhận yêu cầu mới → `Running`; đóng ô → thẻ biến mất, theo RULE-08 → SRS-FR-032
- Luồng ngoại lệ: E1 không theo dõi được trạng thái của một phiên trong ô → báo trên tiêu đề ô → SRS-FR-036
- Luồng ngoại lệ: E2 tín hiệu trạng thái không hợp với trạng thái hiện tại → giữ nguyên → SRS-FR-035

### SRS-FR-031 — Status Board columns
The system shall show a Status Board with the three columns `Running`, `Needs Approval` and `Error`.
- Ví dụ: mở app, chưa có ô nào → bảng có ba cột rỗng.
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-032 — Place session cards
While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system shall show a card for that session in the column of that state.
- Giải thích: trạng thái xác định theo RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08 và bảng ở mục 5.
- Ví dụ: ô 1 `Running`, ô 2 `Needs Approval`, ô 3 `Idle` → cột `Running` có 1 thẻ, cột `Needs Approval` có 1 thẻ, ô 3 không có thẻ.
- Ví dụ âm: phiên `Ended` → không có thẻ ở cột nào.
- Ví dụ âm: Claude Code chạy `npm test` bị fail rồi tự sửa tiếp → phiên vẫn `Running`, không có thẻ ở cột `Error` (RULE-06).
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-033 — Card content
The system shall show on each card the workspace name, the session title, the time the session entered its current state, and the reason of that state.
- Giải thích: lý do là thao tác đang chờ duyệt (ví dụ "Edit src/main.rs") hoặc loại lỗi (RULE-06).
- Ví dụ: thẻ "agent-deck · Scaffold Tauri app · 14:02 · Edit src/main.rs" trong cột `Needs Approval`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-034 — Status update latency
When a session open in a pane changes state, the system shall update the Status Board within 3 seconds.
- Giải thích: ngưỡng lấy thẳng từ BO-01.
- Ví dụ: Claude Code hiện hộp xin phép sửa file lúc 14:02:00 → thẻ hiện ở cột `Needs Approval` trước 14:02:03.
- Ví dụ âm: thẻ hiện lúc 14:02:05 → không đạt.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-035 — Ignore inapplicable status signals
If a status signal does not apply to the current state of a session per the table in section 5, then the system shall keep the session in its current state.
- Ví dụ âm: phiên `Ended` nhận tín hiệu "turn finished" → vẫn `Ended`, không hiện thẻ.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-036 — Report unavailable status
If the system cannot track the state of a session open in a pane, then the system shall show `Status unavailable` in the header of that pane.
- Giải thích: thà báo không biết còn hơn để người dùng tưởng phiên đang rảnh (BO-01).
- Ví dụ âm: Claude Code bản cũ không gửi được tín hiệu trạng thái → tiêu đề ô có nhãn `Status unavailable`, ô không lên bảng.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

## 2.7 Chuyển tới ô từ bảng trạng thái

- Luồng chính: 1. Người dùng bấm một thẻ trên Status Board. 2. Ô của phiên đó được focus, sẵn sàng nhận phím.

### SRS-FR-037 — Jump to pane from card
When the user clicks a card on the Status Board, the system shall move keyboard focus to the pane of that session.
- Ví dụ: bấm thẻ "agent-deck · Scaffold Tauri app" ở cột `Needs Approval` → ô đó được focus, bấm phím `1` là chọn "Yes" trong hộp xin phép.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-07

## 2.8 Đo độ trễ trạng thái

- Luồng chính: 1. Mỗi lần một phiên trong ô đổi trạng thái, hệ thống ghi lúc Claude Code báo đổi và lúc thẻ hiện trên bảng. 2. Người dùng mở "Status Latency". 3. Báo cáo hiện tỉ lệ lần đổi trạng thái hiện trên bảng ≤ 3 giây trong 14 ngày gần nhất.
- Luồng thay thế: A1 chưa có lần đổi trạng thái nào → báo cáo hiện "No data yet" → SRS-FR-039

### SRS-FR-038 — Record status change timing
When a session open in a pane changes state, the system shall record the time Claude Code reported the change and the time the Status Board showed it.
- Giải thích: dữ liệu để đo BO-01 (Q-01).
- Ví dụ: Claude Code báo xin phép lúc 14:02:00.200, thẻ hiện lúc 14:02:00.450 → ghi một dòng độ trễ 250 ms.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-039 — Status latency report
When the user opens the Status Latency report, the system shall show the percentage of state changes in the last 14 days that appeared on the Status Board within 3 seconds.
- Ví dụ: 14 ngày có 400 lần đổi trạng thái, 398 lần ≤ 3 giây → báo cáo hiện "99.5% (398/400) within 3 s".
- Ví dụ âm: chưa có lần đổi trạng thái nào → hiện "No data yet", không hiện 0%.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

## 3. Dữ liệu

### Workspace
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Đường dẫn folder | Folder làm việc | Có | Không trùng trong Workspace List (SRS-FR-003) |
| Tên hiển thị | Tên hiện trong danh sách | Có | Bằng tên folder cuối của đường dẫn |
| Thứ tự | Vị trí trong danh sách | Có | Theo thứ tự thêm vào |
| `Missing` | Folder còn trên máy hay không | Có | Tính lại mỗi lần mở app (SRS-FR-005) |

### Session (chỉ đọc, dữ liệu của Claude Code)
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
| Thời điểm vào trạng thái | Lúc phiên vào trạng thái hiện tại | Có | Hiện trên thẻ (SRS-FR-033) |
| Lý do | Thao tác chờ duyệt hoặc loại lỗi | Khi `Needs Approval` hoặc `Error` | Theo RULE-04, RULE-06 |

### Status Change Record
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Phiên | Phiên đổi trạng thái | Có | Chỉ phiên mở trong ô |
| Trạng thái mới | Trạng thái phiên chuyển sang | Có | Một trong năm trạng thái ở mục 5 |
| Lúc Claude Code báo | Thời điểm Claude Code báo đổi trạng thái | Có | |
| Lúc hiện trên bảng | Thời điểm Status Board hiện thay đổi | Có | Không sớm hơn lúc Claude Code báo |

Bản ghi chỉ cần giữ đủ 14 ngày gần nhất cho SRS-FR-039.

## 4. Business rule

| ID | Rule (câu khai báo) | Nguồn |
| --- | --- | --- |
| RULE-01 | Tiêu đề phiên là tiêu đề Claude Code đặt cho phiên; chưa có thì là yêu cầu gần nhất người dùng gõ trong phiên; cũng không có thì là "(untitled)". | BR-02 |
| RULE-02 | Một phiên thuộc workspace khi folder bắt đầu của phiên trùng đúng đường dẫn folder của workspace; phiên bắt đầu ở folder con không thuộc workspace cha. | BR-02 |
| RULE-03 | Phiên ở `Running` khi Claude Code đang xử lý một yêu cầu của người dùng. | BR-06 |
| RULE-04 | Phiên ở `Needs Approval` khi Claude Code đang dừng chờ người dùng cho phép một thao tác hoặc chọn một phương án (A-06). | BR-06 |
| RULE-05 | Phiên ở `Idle` khi Claude Code đã xong yêu cầu và đang chờ yêu cầu mới. | BR-06 |
| RULE-06 | Phiên ở `Error` khi lượt làm việc bị dừng vì lỗi dịch vụ (hết hạn mức, quá tải, lỗi máy chủ, lỗi đăng nhập) hoặc khi phiên thoát bất thường; một lệnh hay công cụ Claude Code chạy bị lỗi mà lượt làm việc vẫn tiếp tục thì không tính là lỗi. Loại lỗi là lý do hiện trên thẻ. | BR-06 |
| RULE-07 | Phiên ở `Ended` khi phiên đã thoát bình thường. | BR-06 |
| RULE-08 | Phiên rời `Error` khi người dùng gửi yêu cầu mới trong phiên đó (sang `Running`) hoặc khi người dùng đóng ô của phiên. | BR-06 |

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
| Claude Code (lịch sử phiên trên máy) | Danh sách phiên, tiêu đề, folder bắt đầu, thời điểm hoạt động | Mỗi lần người dùng chọn một workspace | Phiên không đọc được → SRS-FR-011 |
| Claude Code (phiên tương tác) | Chạy phiên mới hoặc tiếp tục phiên cũ trong một ô; nhận phím, trả nội dung hiển thị | Khi mở ô (SRS-FR-013, SRS-FR-018) | Không khởi động được → SRS-FR-017 |
| Claude Code (tín hiệu trạng thái) | Sự kiện đổi trạng thái của phiên trong ô | Liên tục khi ô còn mở | Không theo dõi được → SRS-FR-036 |

## 7. Màn hình

| Màn hình | Làm gì | SRS-FR |
| --- | --- | --- |
| Cửa sổ chính · Workspace List | Thêm, bỏ, chọn folder; nhãn `Missing` | SRS-FR-001, SRS-FR-002, SRS-FR-003, SRS-FR-004, SRS-FR-005, SRS-FR-006 |
| Cửa sổ chính · Session List | Xem phiên của folder, Resume, New Session | SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-013, SRS-FR-016, SRS-FR-018, SRS-FR-019, SRS-FR-020 |
| Cửa sổ chính · Pane Grid | Làm việc với các phiên, chia ô, đóng ô | SRS-FR-014, SRS-FR-015, SRS-FR-017, SRS-FR-021, SRS-FR-022, SRS-FR-023, SRS-FR-024, SRS-FR-025, SRS-FR-026, SRS-FR-027, SRS-FR-028, SRS-FR-029, SRS-FR-030, SRS-FR-036 |
| Cửa sổ chính · Status Board | Xem trạng thái, bấm thẻ để tới ô | SRS-FR-031, SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-035, SRS-FR-037, SRS-FR-038 |
| Status Latency | Xem tỉ lệ đổi trạng thái hiện ≤ 3 giây | SRS-FR-039 |

## 8. Báo cáo

| Báo cáo | Chỉ số | Lọc | Tần suất | Ai xem | FR | BO |
| --- | --- | --- | --- | --- | --- | --- |
| Status Latency | Số lần đổi trạng thái hiện trên bảng ≤ 3 giây / tổng số lần đổi trạng thái | 14 ngày gần nhất | Khi người dùng mở | PO | SRS-FR-038, SRS-FR-039 | BO-01 |

BO-02 (≤ 3 thao tác) không có báo cáo trong app: kiểm bằng kịch bản demo theo A-09.

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
When the user selects a workspace with up to 200 sessions, the system shall show its session list within 3 seconds.
- Ví dụ: folder có 200 phiên → danh sách hiện đủ trước 3 giây kể từ lúc bấm chọn.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-NFR-004 — Supported platforms
The system shall run as an installed desktop application on macOS 14 or later and on Windows 11.
- Giải thích: macOS là nơi dùng hằng ngày; Windows 11 phải build và chạy được đủ các FR (BRD mục 8).
- Ví dụ: cùng bộ kịch bản demo chạy đạt trên macOS 26 và trên Windows 11.
- Ví dụ âm: Windows 10 không thuộc phạm vi kiểm.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-005 — Read-only session history
The system shall not modify any Claude Code session history on the machine.
- Ví dụ âm: bỏ workspace, resume, đóng ô → không file lịch sử nào của Claude Code bị app sửa hay xoá (chỉ Claude Code tự ghi).
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-006 — No machine-wide Claude Code configuration change
The system shall not change the user's machine-wide Claude Code settings.
- Ví dụ âm: sau khi dùng app, cấu hình Claude Code chung của máy giống hệt trước khi cài app.
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-007 — Data stays on the machine
The system shall not send session content or session history to any network destination.
- Giải thích: theo A-07. Claude Code tự gọi máy chủ của nó thì không tính.
- Ví dụ âm: theo dõi kết nối mạng của app trong một phiên làm việc 30 phút → không có kết nối nào do app mở ra.
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BRD mục 8 (ràng buộc)

### SRS-NFR-008 — Interface language
The system shall display its own labels and messages in English.
- Giải thích: chỉ nhãn và thông báo của app; nội dung người dùng gõ trong ô vẫn là tiếng Việt được (SRS-FR-026).
- Ví dụ: nút "Resume", thông báo "Folder not found".
- Kiểm chứng: Inspection
- Ưu tiên: Must
- Nguồn: BR-06

## 10. Ràng buộc thiết kế

- Ứng dụng desktop cài trên máy, không phải trang web (BRD mục 8).
- Một người dùng, không có tài khoản hay đăng nhập riêng của app.
- Claude Code là agent duy nhất ở bản này.

## 11. Kiểm chứng

| SRS-ID | Cách | Tiêu chí đậu |
| --- | --- | --- |
| SRS-FR-001 đến SRS-FR-039 | Theo dòng Kiểm chứng của từng FR | Mọi Ví dụ và Ví dụ âm của FR cho đúng kết quả ghi trong FR |
| SRS-FR-034 | Test | 20 lần đổi trạng thái liên tiếp, mọi lần thẻ hiện ≤ 3 giây |
| SRS-NFR-001 đến SRS-NFR-008 | Theo dòng Kiểm chứng của từng NFR | Đạt đúng con số trong câu SHALL |

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
| SRS-FR-022 | BR-05 | | Demo | Baselined |
| SRS-FR-023 | BR-05 | | Demo | Baselined |
| SRS-FR-024 | BR-05 | | Demo | Baselined |
| SRS-FR-025 | BR-05 | | Demo | Baselined |
| SRS-FR-026 | BR-05 | | Demo | Baselined |
| SRS-FR-027 | BR-05 | | Test | Baselined |
| SRS-FR-028 | BR-05 | | Test | Baselined |
| SRS-FR-029 | BR-05 | | Test | Baselined |
| SRS-FR-030 | BR-05 | | Demo | Baselined |
| SRS-FR-031 | BR-06 | | Inspection | Baselined |
| SRS-FR-032 | BR-06 | | Test | Baselined |
| SRS-FR-033 | BR-06 | | Test | Baselined |
| SRS-FR-034 | BR-06 | | Test | Baselined |
| SRS-FR-035 | BR-06 | | Test | Baselined |
| SRS-FR-036 | BR-06 | | Test | Baselined |
| SRS-FR-037 | BR-07 | | Demo | Baselined |
| SRS-FR-038 | BR-06 | | Test | Baselined |
| SRS-FR-039 | BR-06 | | Test | Baselined |
| SRS-NFR-001 | BR-05 | | Test | Baselined |
| SRS-NFR-002 | BR-05 | | Test | Baselined |
| SRS-NFR-003 | BR-02 | | Test | Baselined |
| SRS-NFR-004 | BRD mục 8 (ràng buộc) | | Demo | Baselined |
| SRS-NFR-005 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-006 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-007 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-008 | BR-06 | | Inspection | Baselined |

## 13. Câu hỏi mở

| ID | Câu hỏi | Người trả lời | Trạng thái | Chặn gate |
| --- | --- | --- | --- | --- |
| Q-01 | Đo BO-01 (≤ 3 giây) và BO-02 (≤ 3 thao tác) bằng cách nào? | PO | Đã trả lời 2026-10-15: BO-01 báo cáo Status Latency trong app; BO-02 kịch bản demo (A-09) | Có |
| Q-02 | Tình huống nào tính là `Error`, và lỗi được xoá khỏi bảng lúc nào? | PO | Đã trả lời 2026-10-15: chỉ lỗi làm dừng lượt hoặc phiên (RULE-06); hết lỗi khi gửi yêu cầu mới hoặc đóng ô (RULE-08) | Có |
| Q-03 | Số ô chạy cùng lúc, độ trễ gõ phím, thời gian tải danh sách phiên tối thiểu là bao nhiêu? | PO | Đã trả lời 2026-10-15: ≥ 4 ô; ≤ 100 ms p95; 200 phiên ≤ 3 giây | Có |
| Q-04 | Bản đầu phải chạy trên phiên bản macOS và Windows nào? | PO | Đã trả lời 2026-10-15: macOS 14 trở lên, Windows 11 | Có |
| Q-05 | Giao diện app dùng tiếng Anh hay tiếng Việt? | PO | Đã trả lời 2026-10-15: tiếng Anh | Có |

## 14. Duyệt

| Version | Ngày | Người duyệt | Ghi chú |
| --- | --- | --- | --- |
| v1.0 | 2026-10-15 | PO | Baseline; theo BRD v1.0 |
