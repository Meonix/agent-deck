---
req-doc: srs
slug: agent-deck
scope: product
status: Baselined v1.8 (2026-10-21)
source: product/agent-deck/BRD.md
---
# SRS — agent-deck

<!-- Per ISO/IEC/IEEE 29148. Say what the system does, not how.
     Explanations in Vietnamese; EARS requirement sentences in English, one SHALL. -->

## 1. Giới thiệu

### Mục đích

Đặc tả hành vi của agent-deck, ứng dụng desktop cá nhân để làm việc với nhiều phiên Claude Code
cùng lúc, phục vụ BO-01 (không sót phiên chờ duyệt hoặc lỗi) và BO-02 (mở lại phiên cũ ≤ 3 thao tác)
của BRD v2.5.

### Phạm vi

Trong phạm vi: BR-01 đến BR-08 của BRD. Ngoài phạm vi: như BRD mục 5. Cụ thể, phiên Claude Code mở
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
| A-07 | Ứng dụng không gửi dữ liệu phiên ra khỏi máy | PO |
| A-08 | Bản đầu được kiểm trên Claude Code 2.1.300, bản đang cài trên máy PO ngày 2026-10-15 | PO |
| A-09 | BO-02 kiểm bằng kịch bản demo: mở app → chọn folder → chọn phiên → Resume, đếm thao tác trên 5 phiên khác nhau (Q-01) | PO |
| A-10 | Focus Reminder gửi qua Claude Code cùng prompt không tính là app gửi dữ liệu phiên ra khỏi máy (A-07, SRS-NFR-007) | PO |
| A-11 | BO-03 kiểm bằng bộ 10 prompt lạc đề + 10 prompt trong phạm vi gửi vào các phiên có Session Goal khác nhau, đếm số lượt Claude Code nhắc | PO |

### Thuật ngữ

| Từ | Nghĩa |
| --- | --- |
| Workspace | Folder làm việc mà người dùng đã thêm vào danh sách |
| Workspace List | Danh sách folder làm việc |
| `Missing` | Workspace mà folder của nó không còn trên máy |
| Session | Một phiên làm việc của Claude Code, gắn với folder nơi nó được bắt đầu |
| Session History | Danh sách phiên đã có trên máy của một workspace |
| Session History Panel | Cột nằm giữa cột trái và các ô, hiện Session History của workspace đang chọn |
| Active Sessions | Section ở cột trái, liệt kê mọi phiên đang mở trong ô của mọi workspace |
| `Live` | Phiên đang mở trong một ô của agent-deck |
| Pane | Một ô trong cửa sổ, chạy đúng một phiên, kèm tối đa một Pane Shell |
| Pane Shell | Terminal chạy shell mặc định của hệ điều hành (không chạy Claude Code), nằm dưới phiên trong cùng ô; không có trạng thái, không có trong Active Sessions |
| Status Highlight | Màu nền + badge trạng thái trên dòng của Active Sessions, dòng folder, và badge trên tiêu đề Maximized Pane |
| Maximized Pane | Ô đang phóng to ra cả cửa sổ |
| `Running` | Đang chạy |
| `Needs Approval` | Cần duyệt |
| `Idle` | Rảnh, chờ yêu cầu mới |
| `Error` | Lỗi |
| `Ended` | Đã kết thúc |
| Thao tác | Một lần bấm chuột hoặc một phím tắt |
| Text Size | Tỉ lệ cỡ của mọi chữ trong cửa sổ so với mặc định, từ 50% đến 200%, mặc định 100% |
| Zoom shortcut | macOS: Cmd + (hoặc Cmd =) để to, Cmd − để nhỏ, Cmd 0 về 100%; Windows: Ctrl thay cho Cmd |
| Session Selection | Các phiên đang được tick trong Session History Panel |
| Drop Zone | Một trong bốn vùng trái, phải, trên, dưới hiện trên một ô khi người dùng kéo tiêu đề một ô khác lên nó |
| Thoát bình thường | Phiên Claude Code kết thúc với mã thoát 0 (`/exit`, Ctrl+D); mọi kiểu kết thúc khác là thoát bất thường |
| Focus Outline | Vòng màu iris dày 2px bên ngoài viền của ô đang focus |
| Row Focus Mark | Vòng màu iris dày 2px quanh dòng của phiên trong Active Sessions khi ô của phiên đó có Focus Outline |
| Sidebar | Cột trái chứa Workspace List và Active Sessions |
| Sidebar Toggle | Nút ở giữa theo chiều dọc, sát mép phải Sidebar (Sidebar ẩn: sát mép trái cửa sổ), bấm để ẩn/hiện Sidebar |
| Sidebar shortcut | macOS: Cmd+B; Windows: Ctrl+B |
| Session Goal | Việc chính của một phiên: prompt đầu tiên người dùng gửi trong phiên, hoặc câu người dùng sửa lại |
| Goal Line | Dòng ngay dưới tiêu đề ô, hiện Session Goal rút gọn một dòng ≤ 80 ký tự, có nút Edit Goal (bút chì) ở bên phải |
| Focus Reminder | Ngữ cảnh app gửi cho Claude Code cùng mỗi prompt: Session Goal (≤ 500 ký tự), RULE-09 và cách xử lý prompt lạc đề |
| Off-goal prompt | Prompt không thuộc Session Goal theo RULE-09 |

## 2. Yêu cầu chức năng

## 2.1 Quản lý folder làm việc

- Luồng chính: 1. Người dùng chọn "Add Folder" và chọn một folder. 2. Folder hiện trong Workspace List. 3. Người dùng chọn folder đó; Session History Panel mở ra với lịch sử phiên của nó (2.2).
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

- Luồng chính: 1. Người dùng chọn một workspace. 2. Hệ thống mở Session History Panel, liệt kê các phiên bắt đầu trong đúng folder đó theo RULE-02, mỗi phiên có tiêu đề (RULE-01) và thời điểm hoạt động gần nhất.
- Luồng thay thế: A1 folder chưa có phiên nào → hiện "No sessions yet" → SRS-FR-010
- Luồng thay thế: A2 phiên bắt đầu ở folder con → không thuộc workspace cha theo RULE-02 → SRS-FR-007
- Luồng thay thế: A3 người dùng đóng khung hoặc bấm lại folder đang chọn → khung ẩn → SRS-FR-054
- Luồng ngoại lệ: E1 có phiên không đọc được → báo số phiên không đọc được → SRS-FR-011

### SRS-FR-007 — List sessions of a workspace
When the user selects a workspace, the system shall open the Session History Panel listing every Claude Code session that belongs to that workspace per RULE-02.
- Giải thích: mỗi lần chọn folder thì danh sách được đọc lại, nên phiên mới tạo ngoài app cũng hiện ra.
- Ví dụ: chọn `agent-deck` có 3 phiên → khung bên phải cột trái mở, 3 dòng; các ô hẹp lại, terminal fit theo SRS-FR-024.
- Ví dụ âm: phiên bắt đầu ở `/Users/mionix/Project/agent-deck/ui` → không có trong danh sách của `agent-deck`.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-008 — Show session title and last activity
The system shall show the title per RULE-01 and the last activity time of each session in the Session History Panel.
- Ví dụ: phiên có tiêu đề Claude Code đặt là "Scaffold Tauri app", hoạt động lần cuối 2 phút trước → dòng "Scaffold Tauri app · 2 min ago".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-009 — Order session history
The system shall order the Session History Panel by last activity time, newest first.
- Giải thích: theo A-03, phiên vừa làm nằm trên cùng để mở lại ít thao tác nhất.
- Ví dụ: phiên A hoạt động hôm qua, phiên B 2 phút trước → B nằm trên A.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-010 — Empty session history
If the selected workspace has no session, then the system shall show the message "No sessions yet" in the Session History Panel.
- Ví dụ âm: folder mới tinh chưa chạy Claude Code lần nào → hiện "No sessions yet".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-011 — Report unreadable sessions
If one or more sessions of the selected workspace cannot be read, then the system shall show the notice "<N> sessions could not be read" in the Session History Panel.
- Giải thích: theo rủi ro trong BRD, Claude Code đổi cách lưu phiên thì phải báo rõ, không im lặng hiện thiếu.
- Ví dụ âm: 10 phiên, 2 phiên hỏng → hiện 8 phiên và dòng "2 sessions could not be read".
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-02

### SRS-FR-012 — Mark live sessions
While a session is open in a pane, the system shall mark that session as `Live` in the Session History Panel.
- Ví dụ: phiên "Scaffold Tauri app" đang mở trong một ô → dòng của nó có nhãn `Live`.
- Ví dụ âm: phiên đó đang `Needs Approval` → dòng `Live` trong Session History Panel không có Status Highlight (trạng thái hiện ở Active Sessions, SRS-FR-032).
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-02

### SRS-FR-054 — Close the Session History Panel
When the user chooses Close on the Session History Panel or clicks the selected workspace again, the system shall hide the Session History Panel.
- Giải thích: các ô rộng ra, terminal fit lại (SRS-FR-024); bấm folder lần nữa thì khung mở lại (SRS-FR-007).
- Ví dụ: khung `agent-deck` đang mở, bấm lại `agent-deck` → khung đóng, các ô rộng ra.
- Ví dụ: khung đang mở, bấm × trên khung → khung đóng.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-02

## 2.3 Mở lại phiên cũ

- Luồng chính: 1. Người dùng chọn một workspace. 2. Người dùng chọn một phiên trong danh sách. 3. Người dùng chọn "Resume". 4. Một ô mới mở, tiếp tục đúng phiên đó với hội thoại cũ, con trỏ nhập liệu ở ô đó.
- Luồng thay thế: A1 phiên đã đang mở trong một ô → chuyển tới ô đó → SRS-FR-015
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối → SRS-FR-016
- Luồng ngoại lệ: E2 không khởi động được Claude Code → báo trong ô → SRS-FR-017

### SRS-FR-013 — Resume a session
When the user resumes a session from the Session History Panel, the system shall open a new pane that continues that session in its workspace folder.
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
- Luồng thay thế: A1 phiên mới xuất hiện ngay trong Session History Panel của workspace và trong Active Sessions → SRS-FR-019, SRS-FR-051
- Luồng ngoại lệ: E1 workspace `Missing` → từ chối → SRS-FR-020
- Luồng ngoại lệ: E2 không khởi động được Claude Code → báo trong ô (như SRS-FR-017)

### SRS-FR-018 — Start a new session
When the user starts a new session in the selected workspace, the system shall open a new pane that runs a new Claude Code session in that workspace folder.
- Ví dụ: chọn `agent-deck`, bấm "New Session" → ô mới, Claude Code chạy trong `/Users/mionix/Project/personal/agent-deck`.
- Kiểm chứng: Demo
- Ưu tiên: Must
- Nguồn: BR-04

### SRS-FR-019 — Add the new session to the session history
When a new session starts in a pane, the system shall add that session to the Session History Panel of its workspace.
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
- Luồng thay thế: A1 người dùng kéo tiêu đề ô thả lên Drop Zone của ô khác → SRS-FR-080, SRS-FR-081, SRS-FR-082
- Luồng thay thế: A2 phiên trong ô thoát bình thường → ô đóng → SRS-FR-083; thoát bất thường → ô báo "Session ended" → SRS-FR-028
- Luồng ngoại lệ: E1 đóng ô khi phiên đang `Running` hoặc `Needs Approval` → hỏi xác nhận → SRS-FR-027
- Luồng thay thế: A3 người dùng phóng to một ô ra cả cửa sổ rồi thu về → SRS-FR-041, SRS-FR-042
- Luồng thay thế: A4 đang phóng to mà mở ô mới → thu về trước → SRS-FR-046
- Luồng thay thế: A5 người dùng nhấp đúp tiêu đề ô để phóng to, nhấp đúp lần nữa để thu về → SRS-FR-066, SRS-FR-067
- Luồng thay thế: A6 người dùng bấm vào một ô hoặc bấm dòng của phiên ở Active Sessions → ô đó có Focus Outline → SRS-FR-087

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
When the session in a pane exits abnormally, the system shall show the message "Session ended" in that pane.
- Ví dụ: Claude Code trong ô bị kill → ô hiện "Session ended", vẫn xem lại được nội dung cũ.
- Ví dụ âm: gõ `/exit` → ô đóng (SRS-FR-083), không hiện "Session ended".
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

### SRS-FR-041 — Maximize pane
When the user chooses Maximize on a pane, the system shall show that pane over the whole application window below the title bar, covering the Workspace List, Active Sessions, the Session History Panel and the other panes.
- Giải thích: các ô khác vẫn chạy, không kết thúc phiên nào.
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
- Ví dụ âm: nhấp đúp lên một nút trên tiêu đề ô (Shell, đóng) → chỉ làm việc của nút đó, ô không phóng to.
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
- Ví dụ âm: kéo từ một nút trên tiêu đề (Shell, Maximize, đóng) → không bắt đầu kéo.
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
- Giải thích: không hỏi xác nhận (SRS-FR-027, SRS-FR-063 chỉ áp khi người dùng đóng ô); Pane Shell của ô kết thúc theo; dòng của phiên rời Active Sessions; ô đang phóng to thì bố cục còn lại hiện lại.
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
- Ví dụ: bấm dòng một phiên ở Active Sessions → Focus Outline chuyển sang ô của phiên đó.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-099 — Focused session row mark
While a pane has the Focus Outline, the system shall show the Row Focus Mark on the row of that pane's session in Active Sessions.
- Giải thích: chỉ một dòng có Row Focus Mark tại một thời điểm; hiện ở mọi trạng thái kể cả `Idle` và `Ended`; Status Highlight của dòng vẫn hiện bên trong, không bị thay.
- Ví dụ: 2 ô đều `Idle`, bấm vào ô 2 → dòng của phiên ô 2 có vòng iris, dòng ô 1 không.
- Ví dụ: ô 1 đang `Running` và được focus → dòng ô 1 vừa tô nền Running vừa có vòng iris.
- Ví dụ: bấm dòng ô 1 ở Active Sessions → Row Focus Mark chuyển sang dòng ô 1.
- Ví dụ âm: chưa ô nào được focus → không dòng nào có Row Focus Mark.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

## 2.6 Trạng thái phiên

- Luồng chính: 1. Một phiên trong ô đổi trạng thái theo RULE-03 đến RULE-07. 2. Status Highlight cập nhật trong ≤ 3 giây. 3. Phiên `Running`, `Needs Approval`, `Error` tô dòng của phiên trong Active Sessions và dòng folder theo trạng thái; `Idle` và `Ended` không tô.
- Luồng thay thế: A1 phiên mở ngoài agent-deck → không có trạng thái, không có Status Highlight (BRD mục 5).
- Luồng thay thế: A2 một lệnh hay công cụ Claude Code chạy bị lỗi nhưng lượt vẫn tiếp → không tính `Error` theo RULE-06 → SRS-FR-032
- Luồng thay thế: A3 phiên `Error` nhận yêu cầu mới → `Running`; đóng ô → hết tô, theo RULE-08 → SRS-FR-032
- Luồng thay thế: A4 phiên ở folder không được chọn → dòng folder đó tô theo trạng thái gấp nhất → SRS-FR-040
- Luồng thay thế: A5 đang có Maximized Pane → badge trên tiêu đề ô đó → SRS-FR-044
- Luồng ngoại lệ: E1 không theo dõi được trạng thái của một phiên trong ô → báo trên tiêu đề ô → SRS-FR-036
- Luồng ngoại lệ: E2 tín hiệu trạng thái không hợp với trạng thái hiện tại → giữ nguyên → SRS-FR-035

### SRS-FR-031 — Status Board columns — Deleted (CR-001)
Không còn bảng ba cột; trạng thái hiện bằng Status Highlight ở cột trái (SRS-FR-032, SRS-FR-040).

### SRS-FR-032 — Highlight session rows
While a session open in a pane is in the state `Running`, `Needs Approval` or `Error`, the system shall show the Status Highlight of that state on the row of that session in Active Sessions.
- Giải thích: trạng thái xác định theo RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08 và bảng ở mục 5.
- Ví dụ: `agent-deck` ô 1 `Running`, `mokairo` ô 2 `Needs Approval`, ô 3 `Idle` → dòng ô 2 nền Needs Approval + badge "Needs Approval", dòng ô 1 nền Running + badge "Running", dòng ô 3 không tô, bất kể folder nào đang chọn.
- Ví dụ âm: phiên `Ended` → dòng không tô.
- Ví dụ âm: Claude Code chạy `npm test` bị fail rồi tự sửa tiếp → dòng vẫn Running, không tô Error (RULE-06).
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-033 — Status detail line
While a session row shows the Status Highlight of `Needs Approval` or `Error`, the system shall show below the session title the time the session entered that state and the reason of that state.
- Giải thích: lý do là thao tác đang chờ duyệt (ví dụ "Edit src/main.rs") hoặc loại lỗi (RULE-06).
- Ví dụ: dòng "Scaffold Tauri app" badge "Needs Approval", dòng phụ "14:02 · Edit src/main.rs".
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
While at least one session of a workspace open in a pane is `Running`, `Needs Approval` or `Error`, the system shall show on that workspace's row the Status Highlight of its most urgent state and the number of its sessions in that state.
- Giải thích: thứ tự gấp `Error` > `Needs Approval` > `Running`; để thấy phiên cần mình ở folder đang không chọn.
- Ví dụ: `mokairo` có 1 phiên `Error`, 2 phiên `Running` → dòng `mokairo` nền Error, badge "1".
- Ví dụ âm: mọi phiên của folder `Idle` → dòng folder không tô.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-051 — List active sessions
The system shall list in Active Sessions every session open in a pane across all workspaces, with its title and its workspace name.
- Ví dụ: `agent-deck` có 1 ô, `mokairo` có 1 ô → Active Sessions có 2 dòng "Scaffold Tauri app · agent-deck" và "Fix login bug · mokairo".
- Ví dụ âm: phiên cũ không mở trong ô → không có trong Active Sessions.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-06

### SRS-FR-052 — Order active sessions
The system shall order Active Sessions by state urgency, `Error`, `Needs Approval`, `Running`, `Idle`, `Ended`, and within one state by the time the session entered that state, earliest first.
- Giải thích: phiên cần mình nằm trên cùng (BO-01); cùng luật gấp với SRS-FR-045.
- Ví dụ: ô 1 `Running` từ 14:00, ô 2 `Error` từ 14:05, ô 3 `Needs Approval` từ 14:03 → thứ tự ô 2, ô 3, ô 1.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-06

### SRS-FR-053 — Empty active sessions
While no session is open in a pane, the system shall show the message "No active sessions" in Active Sessions.
- Ví dụ âm: mở app, chưa mở ô nào → Active Sessions hiện "No active sessions".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-06

### SRS-FR-044 — Maximized pane status badge
While a pane is maximized and at least one other session open in a pane is `Needs Approval` or `Error`, the system shall show in the header of the Maximized Pane a badge with the number of those sessions.
- Giải thích: cột trái bị che khi phóng to (SRS-FR-041), badge giữ BO-01. Badge màu Error nếu có ít nhất một phiên `Error`, còn lại màu Needs Approval.
- Ví dụ: phóng to ô 1, ô 3 sang `Needs Approval` lúc 14:02:00 → tiêu đề ô 1 có badge "1" trước 14:02:03.
- Ví dụ âm: các ô khác chỉ `Running` → không có badge.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

## 2.7 Chuyển tới ô từ dấu báo trạng thái

- Luồng chính: 1. Người dùng bấm một dòng trong Active Sessions. 2. Ô của phiên đó được focus, sẵn sàng nhận phím.
- Luồng thay thế: A1 đang có Maximized Pane, người dùng bấm badge trên tiêu đề → thu về, focus ô gấp nhất → SRS-FR-045

### SRS-FR-037 — Jump to pane from Active Sessions
When the user clicks a row in Active Sessions, the system shall move keyboard focus to the pane of that session.
- Ví dụ: bấm dòng "Scaffold Tauri app" đang tô Needs Approval → ô đó được focus, bấm phím `1` là chọn "Yes" trong hộp xin phép.
- Ví dụ: bấm dòng `Idle` không tô màu → vẫn tới ô đó.
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

## 2.8 Đo độ trễ trạng thái

- Luồng chính: 1. Mỗi lần một phiên trong ô đổi trạng thái, hệ thống ghi lúc Claude Code báo đổi và lúc Status Highlight hiện. 2. Người dùng mở "Status Latency". 3. Báo cáo hiện tỉ lệ lần đổi trạng thái có Status Highlight hiện ≤ 3 giây trong 14 ngày gần nhất.
- Luồng thay thế: A1 chưa có lần đổi trạng thái nào → báo cáo hiện "No data yet" → SRS-FR-039

### SRS-FR-038 — Record status change timing
When a session open in a pane changes state, the system shall record the time Claude Code reported the change and the time the Status Highlight showed it.
- Giải thích: dữ liệu để đo BO-01 (Q-01).
- Ví dụ: Claude Code báo xin phép lúc 14:02:00.200, dòng phiên đổi màu lúc 14:02:00.450 → ghi một dòng độ trễ 250 ms.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

### SRS-FR-039 — Status latency report
When the user opens the Status Latency report, the system shall show the percentage of state changes in the last 14 days whose Status Highlight appeared within 3 seconds.
- Ví dụ: 14 ngày có 400 lần đổi trạng thái, 398 lần ≤ 3 giây → báo cáo hiện "99.5% (398/400) within 3 s".
- Ví dụ âm: chưa có lần đổi trạng thái nào → hiện "No data yet", không hiện 0%.
- Kiểm chứng: Test
- Ưu tiên: Must
- Nguồn: BR-06

## 2.9 Xoá phiên

- Luồng chính: 1. Người dùng chọn Delete trên một dòng của Session History Panel. 2. Hệ thống hỏi xác nhận. 3. Người dùng đồng ý; phiên vào Thùng rác, biến khỏi danh sách.
- Luồng thay thế: A1 người dùng chọn Cancel → không đổi gì → SRS-FR-048
- Luồng thay thế: A2 phiên đang mở trong ô → kết thúc phiên, đóng ô rồi mới xoá → SRS-FR-049
- Luồng thay thế: A3 người dùng tick nhiều dòng (SRS-FR-073, SRS-FR-074, SRS-FR-075), chọn "Delete selected", xác nhận một lần → SRS-FR-077, SRS-FR-078; đổi folder hoặc đóng khung thì bỏ chọn → SRS-FR-076
- Luồng ngoại lệ: E2 xoá nhiều mà có phiên không chuyển được vào Thùng rác → giữ các phiên đó, báo số đã xoá → SRS-FR-079
- Luồng ngoại lệ: E1 không chuyển được vào Thùng rác → giữ phiên, báo lỗi → SRS-FR-050

### SRS-FR-047 — Delete a session
When the user confirms deleting a session, the system shall move that session's history to the operating system's trash and remove the session from the Session History Panel.
- Giải thích: khôi phục được bằng tay từ Thùng rác; ngoại lệ duy nhất của SRS-NFR-005.
- Ví dụ: xoá "Scaffold Tauri app" → dòng biến mất; khôi phục từ Trash rồi chọn lại folder → thấy lại phiên.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-048 — Confirm deleting a session
When the user chooses Delete on a row of the Session History Panel, the system shall ask "Move "<title>" to Trash?" before deleting.
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
If a session's history cannot be moved to the trash, then the system shall keep that session in the Session History Panel and show the message "Session could not be deleted".
- Ví dụ âm: file phiên bị khoá quyền ghi → phiên vẫn còn, hiện "Session could not be deleted".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-073 — Select a session
When the user ticks the checkbox of a row in the Session History Panel, the system shall add that session to the Session Selection.
- Giải thích: bỏ tick thì phiên ra khỏi Session Selection; tick không mở phiên.
- Ví dụ: tick "Scaffold Tauri app" và "Fix login bug" → Session Selection có 2 phiên.
- Ví dụ âm: tick một dòng → không ô nào được mở.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-074 — Delete selected action
While the Session Selection is not empty, the system shall show the actions "Delete selected (<n>)" and "Select all" in the Session History Panel, where <n> is the number of selected sessions.
- Ví dụ: tick 2 dòng → hiện "Delete selected (2)" và "Select all".
- Ví dụ âm: bỏ tick hết → hai nút ẩn.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-075 — Select all sessions
When the user chooses Select all, the system shall add every session listed in the Session History Panel to the Session Selection.
- Ví dụ: folder có 5 phiên, đã tick 1, chọn Select all → "Delete selected (5)".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

### SRS-FR-076 — Clear the selection
When the Session History Panel switches to another workspace or closes, the system shall empty the Session Selection.
- Ví dụ: tick 2 phiên ở `agent-deck`, chọn `mokairo` rồi quay lại `agent-deck` → không dòng nào được tick.
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
If some selected sessions cannot be moved to the trash, then the system shall keep those sessions in the Session History Panel and in the Session Selection and show the message "<k> of <n> sessions deleted".
- Giải thích: khi xoá nhiều, thông báo này thay cho thông báo của SRS-FR-050.
- Ví dụ âm: chọn 3 phiên, 1 file bị khoá quyền ghi → 2 dòng biến mất, dòng còn lại vẫn được tick, hiện "2 of 3 sessions deleted".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-08

## 2.10 Terminal phụ trong ô

- Luồng chính: 1. Người dùng bấm Shell trên tiêu đề ô → SRS-FR-055. 2. Người dùng gõ lệnh trong Pane Shell. 3. Người dùng bấm Shell để ẩn, lệnh vẫn chạy → SRS-FR-056, SRS-FR-058. 4. Người dùng bấm lại để hiện → SRS-FR-057.
- Luồng thay thế: A1 người dùng kéo vách giữa phiên và Pane Shell → SRS-FR-059, SRS-FR-060
- Luồng thay thế: A2 người dùng gõ `exit` trong Pane Shell → SRS-FR-061
- Luồng thay thế: A3 phiên Claude Code trong ô thoát bất thường → SRS-FR-064; thoát bình thường → ô đóng cùng Pane Shell → SRS-FR-083
- Luồng ngoại lệ: E1 đóng ô khi Pane Shell đang chạy một lệnh → hỏi xác nhận → SRS-FR-063, SRS-FR-062
- Luồng ngoại lệ: E2 shell không khởi động được → SRS-FR-065

### SRS-FR-055 — Open the pane shell
When the user chooses Shell on a pane that has no Pane Shell, the system shall open a Pane Shell below the session in that pane, running the operating system's default shell in the workspace folder.
- Giải thích: mặc định cao 30% ô, phiên Claude Code chiếm phần còn lại; shell mặc định là shell đăng nhập của người dùng trên macOS, PowerShell trên Windows.
- Ví dụ: ô "agent-deck · Scaffold Tauri app", bấm Shell → khu dưới hiện dấu nhắc ở folder `agent-deck`, gõ `pwd` ra đường dẫn folder đó.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-056 — Hide the pane shell
When the user chooses Shell on a pane whose Pane Shell is visible, the system shall hide the Pane Shell and keep its process running.
- Ví dụ: shell đang chạy `npm run dev`, bấm Shell → khu dưới biến mất, phiên Claude Code chiếm cả ô, server vẫn trả lời ở `localhost:1420`.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-057 — Show the pane shell again
When the user chooses Shell on a pane whose Pane Shell is hidden, the system shall show the Pane Shell with its previous output and height.
- Ví dụ: ẩn lúc cao 40% ô, bấm lại → hiện cao 40%, thấy log `npm run dev` in ra trong lúc ẩn.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-058 — Hidden shell marker
While a pane's Pane Shell is hidden, the system shall show a running marker on that pane's Shell button.
- Giải thích: giữ ý của SRS-FR-029 "không để phiên chạy ngầm không ai thấy" cho shell ẩn.
- Ví dụ: shell chạy `npm run dev` rồi ẩn → nút Shell trên tiêu đề ô có chấm.
- Ví dụ âm: ô chưa mở shell, hoặc shell đang hiện → nút Shell không có chấm.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-059 — Resize the pane shell
When the user drags the divider between the session and the Pane Shell, the system shall resize both to follow the divider.
- Ví dụ: kéo vách lên 100 px → shell cao thêm, phần Claude Code thấp đi tương ứng.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-060 — Reflow the pane shell
When the Pane Shell changes size, the system shall fit the Pane Shell's content to its new size.
- Giải thích: gồm kéo vách (SRS-FR-059), đổi khổ ô (SRS-FR-023), phóng to và thu về (SRS-FR-041, SRS-FR-042); phần phiên Claude Code vẫn theo SRS-FR-024.
- Ví dụ: phóng to ô đang hiện shell chạy `htop` → `htop` vẽ lại vừa khổ mới.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-061 — Shell exits
When the Pane Shell's process exits, the system shall close the Pane Shell.
- Ví dụ: gõ `exit` → khu dưới đóng, phiên Claude Code chiếm cả ô, nút Shell không chấm; bấm Shell lại → shell mới, không còn nội dung cũ.
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
If the user closes a pane whose Pane Shell is running a command, then the system shall ask for confirmation before closing that pane.
- Giải thích: "đang chạy một lệnh" là shell không đứng ở dấu nhắc chờ lệnh. Ô vừa bận theo SRS-FR-027 vừa có shell bận → chỉ một hộp xác nhận.
- Ví dụ: phiên `Idle`, shell ẩn chạy `npm run dev`, bấm đóng → hộp "A command is still running in the shell. Close anyway?"; chọn Cancel → ô và shell vẫn chạy.
- Ví dụ âm: shell đứng ở dấu nhắc, phiên `Idle` → đóng không hỏi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-064 — Shell outlives the session
While the session in a pane has exited abnormally, the system shall keep that pane's Pane Shell running.
- Ví dụ: Claude Code bị kill → phần trên hiện "Session ended" (SRS-FR-028), shell vẫn chạy `npm run dev`.
- Ví dụ âm: gõ `/exit` → ô đóng, shell kết thúc theo (SRS-FR-083).
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

### SRS-FR-065 — Report shell start failure
If the Pane Shell cannot start, then the system shall show the message "Shell could not start" in that pane and keep the session running.
- Ví dụ âm: shell mặc định không chạy được → ô hiện "Shell could not start", phiên Claude Code vẫn `Running`, nút Shell không chấm.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-05

## 2.11 Cỡ chữ

- Luồng chính: 1. Người dùng bấm Zoom shortcut để to hoặc nhỏ → SRS-FR-068, SRS-FR-069. 2. Mọi chữ trong cửa sổ đổi cỡ, terminal fit lại → SRS-FR-072. 3. Mở lại app vẫn giữ cỡ đó → SRS-FR-071.
- Luồng thay thế: A1 người dùng bấm Zoom shortcut về mặc định → SRS-FR-070
- Luồng ngoại lệ: E1 Text Size đã ở 200% hoặc 50% → giữ nguyên (Ví dụ âm của SRS-FR-068, SRS-FR-069)

### SRS-FR-068 — Increase text size
When the user presses the Zoom shortcut to enlarge, the system shall increase the Text Size by 10 percentage points, up to 200%.
- Giải thích: áp cho mọi chữ trong cửa sổ: Workspace List, Active Sessions, Session History Panel, tiêu đề ô, terminal phiên, Pane Shell, hộp thoại. Phím tắt chạy cả khi focus đang ở ô; ô không nhận phím đó.
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
- Giải thích: Sidebar ẩn hẳn, không còn dải icon; vùng ô nở ra chiếm chỗ đó, terminal fit lại theo SRS-FR-024; Session History Panel đang mở vẫn mở; phiên, ô, Pane Shell không đổi.
- Ví dụ: Sidebar đang hiện, bấm Sidebar Toggle → Sidebar ẩn, 2 ô cạnh nhau rộng thêm, nút nằm ở mép trái cửa sổ.
- Ví dụ: bấm lần nữa → Sidebar hiện lại như cũ, folder đang chọn giữ nguyên.
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

## 2.14 Giữ phiên trong một việc

- Luồng chính: 1. Người dùng gửi prompt đầu trong ô → Session Goal, Goal Line hiện → SRS-FR-091, SRS-FR-092. 2. Mỗi prompt sau → Claude Code nhận Focus Reminder → SRS-FR-094, SRS-FR-095.
- Luồng thay thế: A1 người dùng bấm Edit Goal → SRS-FR-093. A2 mở lại app hoặc Resume → SRS-FR-096, SRS-FR-097
- Luồng ngoại lệ: E1 không gửi được Focus Reminder → SRS-FR-098

### SRS-FR-091 — Pin first prompt as session goal
When the user sends a prompt in a pane whose session has no Session Goal, the system shall set that prompt as the Session Goal.
- Giải thích: áp cho phiên mới và cho phiên mới Claude Code tạo sau `/clear`; prompt là lệnh skill (`/dev-bug lỗi X`) thì lấy nguyên câu.
- Ví dụ: ô mới, gửi "Sửa lỗi resume mất scrollback" → Session Goal là câu đó.
- Ví dụ âm: gửi tiếp "chạy test" → Session Goal không đổi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-092 — Goal Line
While the session in a pane has a Session Goal, the system shall show the Goal Line below the pane header.
- Giải thích: dài hơn 80 ký tự thì cắt và thêm "…"; di chuột lên thì hiện đủ câu; chưa có Session Goal thì không có Goal Line; nhấp đúp hay kéo Goal Line không phóng to, không kéo ô.
- Ví dụ: Session Goal 120 ký tự → Goal Line hiện 79 ký tự đầu + "…" và nút bút chì.
- Kiểm chứng: Demo
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-093 — Edit session goal
When the user confirms a new text in Edit Goal, the system shall replace the Session Goal with that text.
- Giải thích: bấm bút chì → Goal Line thành ô sửa; Enter lưu, Esc huỷ; câu rỗng thì giữ câu cũ; prompt sau dùng câu mới.
- Ví dụ: sửa thành "Sửa resume mất scrollback trên Windows", Enter → Goal Line hiện câu mới, prompt kế tiếp có Focus Reminder với câu mới.
- Ví dụ âm: xoá hết chữ rồi Enter → Session Goal giữ câu cũ.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-094 — Focus Reminder with each prompt
When the user sends a prompt in a pane whose session has a Session Goal, the system shall give Claude Code the Focus Reminder with that prompt.
- Giải thích: Session Goal dài hơn 500 ký tự thì cắt; chỉ cho phiên mở trong ô của agent-deck.
- Ví dụ: Session Goal "Sửa lỗi resume mất scrollback", gửi "thêm nút export CSV" → Claude Code nhận prompt đó kèm Focus Reminder có câu Session Goal.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-095 — Off-goal instruction
The system shall word the Focus Reminder so that Claude Code, for an Off-goal prompt, does not carry it out, says it is a different task and suggests a new session, unless the user tells it to go ahead.
- Giải thích: app không tự chặn prompt nào; Claude Code tự xét theo RULE-09; hiệu quả đo ở BO-03 (A-11).
- Ví dụ: Session Goal "Sửa lỗi resume", gửi "thêm nút export CSV" → Claude Code trả lời đây là việc khác và đề nghị mở phiên mới.
- Ví dụ: gửi tiếp "cứ làm" → Claude Code làm.
- Ví dụ âm: gửi "commit giúp" → Claude Code commit, không nhắc.
- Kiểm chứng: Inspection
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-096 — Keep session goal across launches
The system shall keep the Session Goal of each session between application launches.
- Ví dụ: sửa Session Goal, thoát app, mở lại → ô mở lại có Goal Line với câu đã sửa.
- Ví dụ: đóng ô, sau đó Resume phiên đó → Goal Line như trước khi đóng.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-097 — Goal of a resumed session without a stored goal
When the user resumes a session that has no stored Session Goal, the system shall set the first prompt the user sent in that session as its Session Goal.
- Giải thích: đọc từ lịch sử phiên của Claude Code, không sửa nó (SRS-NFR-005); phiên chưa có prompt nào thì chưa có Session Goal, SRS-FR-091 áp khi gửi prompt.
- Ví dụ: Resume phiên cũ có prompt đầu "Scaffold Tauri app" → Goal Line "Scaffold Tauri app".
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-09

### SRS-FR-098 — Prompt goes through without reminder
If the system cannot give Claude Code the Focus Reminder for a prompt, then the system shall let that prompt reach Claude Code unchanged.
- Ví dụ: hook không trả được Focus Reminder → Claude Code vẫn nhận và làm prompt như khi chưa có tính năng; ô không báo lỗi.
- Kiểm chứng: Test
- Ưu tiên: Should
- Nguồn: BR-09

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
| Pane Shell | Có hay không, đang ẩn hay hiện, chiều cao | Không | Tối đa một mỗi ô (SRS-FR-055); không giữ lại giữa các lần mở app |

### Status Change Record
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Phiên | Phiên đổi trạng thái | Có | Chỉ phiên mở trong ô |
| Trạng thái mới | Trạng thái phiên chuyển sang | Có | Một trong năm trạng thái ở mục 5 |
| Lúc Claude Code báo | Thời điểm Claude Code báo đổi trạng thái | Có | |
| Lúc hiện Status Highlight | Thời điểm Status Highlight hiện thay đổi | Có | Không sớm hơn lúc Claude Code báo |

Bản ghi chỉ cần giữ đủ 14 ngày gần nhất cho SRS-FR-039.

### App settings
| Trường | Nghĩa | Bắt buộc | Ràng buộc nghiệp vụ |
| --- | --- | --- | --- |
| Text Size | Cỡ chữ của cả cửa sổ | Có | 50%–200%, bước 10%, mặc định 100%; giữ lại giữa các lần mở app (SRS-FR-071) |
| Open Panes | Phiên của từng ô và bố cục (vị trí, tỉ lệ) | Không | Giữ lại giữa các lần mở app (SRS-FR-084); không gồm phóng to, Pane Shell |
| Session Goals | Session Goal của từng phiên theo mã phiên | Không | Giữ lại giữa các lần mở app (SRS-FR-096); không ghi vào dữ liệu phiên của Claude Code (SRS-NFR-005) |

Trạng thái ẩn của Sidebar không được lưu: mở app thì Sidebar luôn hiện (SRS-FR-090).

Session Selection không được lưu: bỏ khi đổi workspace hay đóng Session History Panel (SRS-FR-076) và khi thoát app.

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
| RULE-09 | Một prompt thuộc Session Goal khi nó phục vụ việc chính: sửa lỗi đang chặn việc chính, chạy test, commit, hỏi về phần vừa làm cho việc chính; prompt tạo ra một thay đổi riêng đứng độc lập được là Off-goal prompt. | BR-09 |

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
| Thùng rác của hệ điều hành | Nhận lịch sử phiên người dùng xoá | Khi người dùng xác nhận xoá (SRS-FR-047) | Không chuyển được → SRS-FR-050 |
| Claude Code (phiên tương tác) | Chạy phiên mới hoặc tiếp tục phiên cũ trong một ô; nhận phím, trả nội dung hiển thị | Khi mở ô (SRS-FR-013, SRS-FR-018) | Không khởi động được → SRS-FR-017 |
| Claude Code (tín hiệu trạng thái) | Sự kiện đổi trạng thái của phiên trong ô | Liên tục khi ô còn mở | Không theo dõi được → SRS-FR-036 |
| Shell mặc định của hệ điều hành | Nhận phím, trả nội dung hiển thị | Khi mở Pane Shell (SRS-FR-055) | Không khởi động được → SRS-FR-065 |
| Claude Code (prompt gửi đi) | Nhận Focus Reminder cùng prompt | Mỗi lần người dùng gửi prompt trong ô (SRS-FR-094) | Không nhận được → SRS-FR-098 |

## 7. Màn hình

| Màn hình | Làm gì | SRS-FR |
| --- | --- | --- |
| Cửa sổ chính · Workspace List | Thêm, bỏ, chọn folder; nhãn `Missing`; Status Highlight của folder; tint riêng của section | SRS-FR-001, SRS-FR-002, SRS-FR-003, SRS-FR-004, SRS-FR-005, SRS-FR-006, SRS-FR-034, SRS-FR-040, SRS-FR-054, SRS-NFR-009 |
| Cửa sổ chính · Active Sessions | Phiên đang mở trong ô của mọi folder, Status Highlight, dòng phụ "giờ · lý do", bấm dòng để tới ô, Row Focus Mark của ô đang focus; tint riêng của section | SRS-FR-032, SRS-FR-033, SRS-FR-034, SRS-FR-035, SRS-FR-037, SRS-FR-038, SRS-FR-051, SRS-FR-052, SRS-FR-053, SRS-FR-099, SRS-NFR-009 |
| Cửa sổ chính · Session History Panel | Lịch sử phiên của folder đang chọn, nhãn `Live`, Resume, New Session, xoá một hoặc nhiều phiên, đóng khung | SRS-FR-007, SRS-FR-008, SRS-FR-009, SRS-FR-010, SRS-FR-011, SRS-FR-012, SRS-FR-013, SRS-FR-016, SRS-FR-018, SRS-FR-019, SRS-FR-020, SRS-FR-047, SRS-FR-048, SRS-FR-049, SRS-FR-050, SRS-FR-054, SRS-FR-073, SRS-FR-074, SRS-FR-075, SRS-FR-076, SRS-FR-077, SRS-FR-078, SRS-FR-079, SRS-NFR-003 |
| Cửa sổ chính · Pane Grid | Làm việc với các phiên, kéo thả ô, đóng ô, ô tự đóng khi phiên thoát bình thường, mở lại các ô khi mở app, phóng to/thu về (nút hoặc nhấp đúp tiêu đề), badge của ô phóng to, Pane Shell dưới phiên, Focus Outline của ô đang focus, Goal Line và sửa Session Goal | SRS-FR-014, SRS-FR-015, SRS-FR-017, SRS-FR-021, SRS-FR-023, SRS-FR-024, SRS-FR-025, SRS-FR-026, SRS-FR-027, SRS-FR-028, SRS-FR-029, SRS-FR-030, SRS-FR-036, SRS-FR-041, SRS-FR-042, SRS-FR-043, SRS-FR-044, SRS-FR-045, SRS-FR-046, SRS-FR-055, SRS-FR-056, SRS-FR-057, SRS-FR-058, SRS-FR-059, SRS-FR-060, SRS-FR-061, SRS-FR-062, SRS-FR-063, SRS-FR-064, SRS-FR-065, SRS-FR-066, SRS-FR-067, SRS-FR-072, SRS-FR-080, SRS-FR-081, SRS-FR-082, SRS-FR-083, SRS-FR-084, SRS-FR-085, SRS-FR-086, SRS-FR-087, SRS-FR-091, SRS-FR-092, SRS-FR-093, SRS-FR-094, SRS-FR-095, SRS-FR-096, SRS-FR-097, SRS-FR-098 |
| Cửa sổ chính · toàn cửa sổ | Phóng to, thu nhỏ, về mặc định cỡ chữ của mọi chữ trong cửa sổ; ẩn/hiện Sidebar bằng Sidebar Toggle hoặc Sidebar shortcut | SRS-FR-068, SRS-FR-069, SRS-FR-070, SRS-FR-071, SRS-FR-088, SRS-FR-089, SRS-FR-090 |
| Status Latency | Xem tỉ lệ đổi trạng thái hiện ≤ 3 giây | SRS-FR-039 |

## 8. Báo cáo

| Báo cáo | Chỉ số | Lọc | Tần suất | Ai xem | FR | BO |
| --- | --- | --- | --- | --- | --- | --- |
| Status Latency | Số lần đổi trạng thái có Status Highlight hiện ≤ 3 giây / tổng số lần đổi trạng thái | 14 ngày gần nhất | Khi người dùng mở | PO | SRS-FR-038, SRS-FR-039 | BO-01 |

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
When the user selects a workspace with up to 200 sessions, the system shall show its Session History Panel within 3 seconds.
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
The system shall not modify any Claude Code session history on the machine other than moving a session the user deletes to the operating system's trash.
- Giải thích: ngoại lệ duy nhất là SRS-FR-047 (BR-08, CR-001).
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

### SRS-NFR-009 — Sidebar section tints
The system shall give the Workspace List section and the Active Sessions section two different background tints, each with a contrast ratio of at most 1.25:1 against the sidebar background and a text contrast of at least 4.5:1, in both light and dark themes.
- Giải thích: hai section cùng nằm trong cột trái, cần phân biệt được mà không chói.
- Ví dụ: nền section Folders 1.08:1, nền Active Sessions 1.12:1 so với nền cột trái, chữ 12:1 → đạt.
- Ví dụ âm: nền section 1.6:1 so với nền cột trái → không đạt.
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
| SRS-FR-001 đến SRS-FR-099 (trừ SRS-FR-022, SRS-FR-031 đã xoá) | Theo dòng Kiểm chứng của từng FR | Mọi Ví dụ và Ví dụ âm của FR cho đúng kết quả ghi trong FR |
| SRS-FR-034 | Test | 20 lần đổi trạng thái liên tiếp, mọi lần Status Highlight hiện ≤ 3 giây |
| SRS-NFR-001 đến SRS-NFR-009 | Theo dòng Kiểm chứng của từng NFR | Đạt đúng con số trong câu SHALL |

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
| SRS-FR-038 | BR-06 | | Test | Baselined |
| SRS-FR-039 | BR-06 | | Test | Baselined |
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
| SRS-FR-053 | BR-06 | | Test | Baselined |
| SRS-FR-054 | BR-02 | | Test | Baselined |
| SRS-FR-055 | BR-05 | | Demo | Baselined |
| SRS-FR-056 | BR-05 | | Test | Baselined |
| SRS-FR-057 | BR-05 | | Demo | Baselined |
| SRS-FR-058 | BR-05 | | Test | Baselined |
| SRS-FR-059 | BR-05 | | Demo | Baselined |
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
| SRS-FR-091 | BR-09 | | Test | Baselined |
| SRS-FR-092 | BR-09 | | Demo | Baselined |
| SRS-FR-093 | BR-09 | | Test | Baselined |
| SRS-FR-094 | BR-09 | | Test | Baselined |
| SRS-FR-095 | BR-09 | | Inspection | Baselined |
| SRS-FR-096 | BR-09 | | Test | Baselined |
| SRS-FR-097 | BR-09 | | Test | Baselined |
| SRS-FR-098 | BR-09 | | Test | Baselined |
| SRS-FR-099 | BR-05 | | Test | Baselined |
| SRS-NFR-001 | BR-05 | | Test | Baselined |
| SRS-NFR-002 | BR-05 | | Test | Baselined |
| SRS-NFR-003 | BR-02 | | Test | Baselined |
| SRS-NFR-004 | BRD mục 8 (ràng buộc) | | Demo | Baselined |
| SRS-NFR-005 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-006 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-007 | BRD mục 8 (ràng buộc) | | Inspection | Baselined |
| SRS-NFR-008 | BR-06 | | Inspection | Baselined |
| SRS-NFR-009 | BR-06 | | Analysis | Baselined |
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
| v1.1 | 2026-10-17 | PO | CR-001: Status Highlight thay Status Board (SRS-FR-031 xoá); phóng to ô; xoá phiên vào Thùng rác; theo BRD v2.0 |
| v1.2 | 2026-10-17 | PO | CR-002: Active Sessions ở cột trái, lịch sử phiên sang Session History Panel; thêm SRS-FR-051 đến SRS-FR-054, SRS-NFR-009; theo BRD v2.1 |
| v1.3 | 2026-10-17 | PO | CR-003: Pane Shell dưới phiên trong cùng ô, ẩn đi mà vẫn chạy; thêm SRS-FR-055 đến SRS-FR-065; theo BRD v2.2 |
| v1.4 | 2026-10-18 | PO | CR-004: nhấp đúp tiêu đề ô để phóng to/thu về; Text Size cả cửa sổ bằng Zoom shortcut; xoá nhiều phiên cùng lúc; thêm SRS-FR-066 đến SRS-FR-079; theo BRD v2.3 |
| v1.5 | 2026-10-19 | PO | CR-005: kéo thả ô thay `Split Down` (SRS-FR-022 xoá); ô tự đóng khi phiên thoát bình thường; mở lại các ô khi mở app; sửa SRS-FR-028, SRS-FR-046, SRS-FR-064; thêm SRS-FR-080 đến SRS-FR-086; theo BRD v2.4 |
| v1.6 | 2026-10-20 | PO | CR-006: Focus Outline cho ô đang focus; ẩn/hiện Sidebar bằng nút và Cmd+B / Ctrl+B, mở app luôn hiện; thêm SRS-FR-087 đến SRS-FR-090; theo BRD v2.5 |
| v1.7 | 2026-10-21 | PO | CR-007: Session Goal ghim trên Goal Line, sửa được, giữ giữa các lần mở app; Focus Reminder gửi cùng mỗi prompt, Claude Code nhắc khi lạc đề theo RULE-09; thêm SRS-FR-091 đến SRS-FR-098, A-10, A-11; theo BRD v3.0 |
| v1.8 | 2026-10-21 | PO | CR-008: Row Focus Mark trên dòng Active Sessions của ô đang focus, ở mọi trạng thái, không thay Status Highlight; thêm SRS-FR-099, Row Focus Mark; theo BRD v3.0 |
