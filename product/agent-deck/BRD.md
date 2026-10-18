---
req-doc: brd
slug: agent-deck
scope: product
status: Approved v2.3 (2026-10-18)
---
# BRD — agent-deck

<!-- Write in Vietnamese. No technical solution. Unconfirmed → A-xx, unknown → Q-xx. -->

## 1. Tóm tắt

agent-deck là ứng dụng desktop dùng cá nhân, cài và chạy trên máy (macOS trước, Windows sau).
Nó gom việc làm với Claude Code về một chỗ: các folder hay làm việc, lịch sử phiên của từng folder,
nhiều phiên Claude Code tương tác cùng lúc trong một cửa sổ, và dấu báo trạng thái ở cột trái cho
biết phiên nào đang chạy, phiên nào đang chờ mình duyệt, phiên nào đang lỗi.

## 2. Vấn đề và lý do

PO chọn "không sót phiên chờ" làm mục tiêu chính (Q-01), xác nhận vấn đề gốc là phiên chờ duyệt bị bỏ quên.

- Khi chạy nhiều phiên Claude Code ở nhiều folder, mỗi phiên nằm trong một cửa sổ terminal riêng.
- Phiên đang chờ duyệt thì đứng im cho tới khi người dùng tình cờ quay lại cửa sổ đó.
- Lịch sử phiên của từng folder nằm rải rác trên máy, không có chỗ xem lại và mở lại nhanh.

## 3. Stakeholder

| Ai | Vai trò | Cần gì |
| --- | --- | --- |
| Người dùng (PO) | Vừa là chủ sản phẩm, vừa là người dùng duy nhất | Làm song song nhiều phiên Claude Code mà không bỏ sót phiên cần mình |

## 4. Mục tiêu kinh doanh (BO)

| ID | Mục tiêu | Chỉ số | Ngưỡng | Thời hạn |
| --- | --- | --- | --- | --- |
| BO-01 | Không bỏ sót phiên Claude Code đang chờ duyệt hoặc đang lỗi | Thời gian từ lúc một phiên mở trong agent-deck bắt đầu chờ duyệt hoặc gặp lỗi đến lúc phiên đó hiện dấu báo trạng thái trong app (dòng phiên, dòng folder, hoặc badge của ô phóng to) | ≤ 3 giây | Đạt trong 2 tuần dùng thử ngay sau khi có MVP |
| BO-02 | Quay lại làm tiếp một phiên cũ thật nhanh | Số thao tác từ lúc mở app đến lúc gõ tiếp được vào một phiên cũ bất kỳ | ≤ 3 thao tác | Đạt trong 2 tuần dùng thử ngay sau khi có MVP |

## 5. Phạm vi

### Trong phạm vi

- Quản lý danh sách folder hay làm việc với AI agent.
- Xem và mở lại phiên Claude Code đã có trên máy, theo từng folder.
- Chạy nhiều phiên Claude Code tương tác cùng lúc, chia ô trong một cửa sổ.
- Theo dõi trạng thái từng phiên: đang chạy, cần duyệt, lỗi.
- Xoá một hoặc nhiều phiên cũ vào Thùng rác.
- Một terminal thường (không chạy Claude Code) dưới mỗi phiên, ẩn đi được mà vẫn chạy.
- Phóng to, thu nhỏ cỡ chữ của cả cửa sổ bằng phím tắt.

### Ngoài phạm vi

- AI agent khác ngoài Claude Code (opencode, Codex CLI, Gemini CLI) — để sau bản đầu.
- Bộ cài đặt, ký số, tự cập nhật, phát hành cho người khác dùng.
- Linux.
- Theo dõi trạng thái phiên Claude Code mở ngoài agent-deck (Terminal, VS Code…). Các phiên này vẫn hiện trong lịch sử (BR-02) nhưng không có trạng thái.

## 6. Yêu cầu nghiệp vụ (BR)

| ID | Yêu cầu | BO | MoSCoW |
| --- | --- | --- | --- |
| BR-01 | Người dùng thêm, bỏ và chọn folder làm việc; danh sách được giữ lại giữa các lần mở app | BO-02 | Must |
| BR-02 | Người dùng xem danh sách phiên Claude Code đã có trên máy của folder đang chọn, mỗi phiên có tiêu đề và thời điểm hoạt động gần nhất | BO-02 | Must |
| BR-03 | Người dùng mở lại một phiên cũ để làm tiếp | BO-02 | Must |
| BR-04 | Người dùng bắt đầu một phiên Claude Code mới trong folder đang chọn | BO-02 | Must |
| BR-05 | Người dùng làm việc với nhiều phiên cùng lúc trong một cửa sổ, chia ô ngang và dọc, phóng to một ô ra cả cửa sổ, mở một terminal thường dưới phiên trong cùng ô và ẩn nó đi mà vẫn chạy, phóng to hoặc thu nhỏ cỡ chữ của cả cửa sổ bằng phím tắt, thao tác đầy đủ như trong terminal thường | BO-01 | Must |
| BR-06 | Người dùng thấy ngay trên danh sách folder và danh sách phiên đang mở phiên nào đang chạy, phiên nào cần duyệt, phiên nào lỗi | BO-01 | Must |
| BR-07 | Từ dấu báo trạng thái, người dùng chuyển thẳng tới ô của phiên đó | BO-01 | Should |
| BR-08 | Người dùng xoá một hoặc nhiều phiên cũ của folder cùng lúc bằng cách chuyển chúng vào Thùng rác | BO-02 | Should |

## 7. Quy trình và luật nghiệp vụ

Quy trình chính:

1. Người dùng chọn một folder trong danh sách.
2. App hiện các phiên đã có của folder đó.
3. Người dùng mở lại một phiên cũ, hoặc bắt đầu phiên mới; phiên mở ra trong một ô.
4. Người dùng mở thêm ô, ở cùng folder hoặc folder khác.
5. Khi một phiên cần duyệt hoặc gặp lỗi, dòng của nó trong danh sách phiên đang mở và dòng folder của nó ở cột trái đổi màu và hiện badge.
6. Người dùng bấm vào dòng đó để tới đúng ô và xử lý.

Luật nghiệp vụ:

- Một phiên ở đúng một trạng thái tại một thời điểm: đang chạy, cần duyệt, rảnh, lỗi, hoặc đã kết thúc.
- Phiên thuộc về folder mà nó được bắt đầu trong đó.

## 8. Ràng buộc

- Dùng cá nhân, một người dùng.
- App cài và chạy trên máy như ứng dụng desktop, không phải trang web.
- Bản đầu dùng hằng ngày trên macOS; phải build ra được bản chạy trên Windows.
- Không sửa dữ liệu phiên của Claude Code trên máy; chỉ được chuyển cả một phiên vào Thùng rác khi người dùng chọn xoá phiên đó (BR-08).
- Không thay đổi cấu hình Claude Code dùng chung toàn máy của người dùng.

## 9. Giả định (A)

| ID | Giả định | Ai cần xác nhận |
| --- | --- | --- |
| A-01 | Máy đã cài sẵn Claude Code và đã đăng nhập | PO |

## 10. Rủi ro

| Rủi ro | Ảnh hưởng | Cách giảm |
| --- | --- | --- |
| Claude Code đổi cách lưu phiên giữa các phiên bản (nhà phát triển ghi rõ là định dạng nội bộ) | Danh sách phiên hiển thị sai hoặc trống | Kiểm lại mỗi khi Claude Code lên phiên bản; báo rõ khi không đọc được thay vì im lặng |
| Hành vi trên Windows khác macOS | Bản Windows chạy lỗi dù macOS ổn | Chạy thử trên Windows ngay từ mốc đầu, không để cuối |
| Đã có sản phẩm làm gần giống (Nimbalyst, Superset, cmux) | Công sức bỏ ra không cần thiết | Dùng thử Nimbalyst trước khi bắt đầu xây |

## 11. Chỉ số thành công

- BO-01: trong 2 tuần dùng thử sau khi có MVP, mọi phiên mở trong agent-deck mà chờ duyệt hoặc lỗi hiện dấu báo trạng thái trong ≤ 3 giây.
- BO-02: trong 2 tuần dùng thử sau khi có MVP, mở lại bất kỳ phiên cũ nào trong ≤ 3 thao tác (chọn folder, chọn phiên, mở).

## 12. Câu hỏi mở (Q)

| ID | Câu hỏi | Người trả lời | Trạng thái | Chặn gate |
| --- | --- | --- | --- | --- |
| Q-01 | Vấn đề gốc là gì, và mục tiêu đo bằng chỉ số nào, ngưỡng bao nhiêu, đến khi nào? | PO | Đã trả lời 2026-10-15 | Có |

## 13. Log phỏng vấn

| Ngày | Q | A |
| --- | --- | --- |
| 2026-10-15 | Bản đầu coi là xong khi nào? | MVP dùng cá nhân: chạy trên máy PO (macOS trước), đủ 4 chức năng ở mức cơ bản, chưa cần bộ cài hay ký số |
| 2026-10-15 | Bản đầu hỗ trợ agent nào? | Chỉ Claude Code |
| 2026-10-15 | Đặt tài liệu ở đâu? | `product/agent-deck/` |
| 2026-10-15 | Q-01: BO-01 đo bằng gì? | Không sót phiên chờ: phiên chờ duyệt hoặc lỗi hiện trên bảng ≤ 3 giây, đạt trong 2 tuần dùng thử sau MVP |
| 2026-10-15 | Có thêm BO cho folder, lịch sử phiên, chia ô không? | Có, BO-02: mở lại phiên cũ ≤ 3 thao tác, đạt trong 2 tuần dùng thử sau MVP |
| 2026-10-15 | Phiên mở ngoài app có hiện trạng thái không? | Không. BO-01 chỉ tính phiên mở trong agent-deck; phiên ngoài chỉ hiện trong lịch sử; không sửa cấu hình Claude Code toàn máy |
| 2026-10-17 | CR-001: xoá phiên nghĩa là gì? | Chuyển phiên vào Thùng rác, từng phiên một, có xác nhận; phiên đang mở thì đóng ô rồi xoá |
| 2026-10-17 | CR-001: bảng trạng thái chiếm chỗ | Gộp vào cột trái: dòng phiên và dòng folder đổi màu nền + badge; ô phóng to có badge đếm phiên khác cần duyệt/lỗi |
| 2026-10-17 | CR-003: terminal phụ chạy ngầm có trái với "không để phiên chạy ngầm không ai thấy" không? | Không, nếu gắn với ô: ẩn thì nút Shell có chấm báo đang chạy; đóng ô thì kết thúc shell, hỏi xác nhận nếu shell đang chạy lệnh |
| 2026-10-18 | CR-004: nhấp đúp, cỡ chữ, xoá nhiều phiên làm thế nào? | Nhấp đúp tiêu đề ô để phóng to / thu về; Cmd (macOS) / Ctrl (Windows) + − 0 đổi cỡ chữ cả cửa sổ, bước 10%, 50–200%, nhớ giữa các lần mở app; tick nhiều dòng history rồi xoá cùng lúc với một hộp xác nhận |

## 14. Duyệt

| Version | Ngày | Người duyệt | Ghi chú |
| --- | --- | --- | --- |
| v1.0 | 2026-10-15 | PO | Duyệt, chuyển sang viết SRS |
| v2.0 | 2026-10-17 | PO | CR-001: chỉ số BO-01 đổi sang dấu báo trạng thái; BR-05, BR-06, BR-07 sửa; thêm BR-08; nới ràng buộc chỉ-đọc cho xoá vào Thùng rác |
| v2.1 | 2026-10-17 | PO | CR-002: BR-06 "danh sách phiên" → "danh sách phiên đang mở" (Active Sessions); lịch sử phiên sang khung riêng |
| v2.2 | 2026-10-17 | PO | CR-003: BR-05 thêm terminal thường dưới phiên trong cùng ô, ẩn đi mà vẫn chạy |
| v2.3 | 2026-10-18 | PO | CR-004: BR-05 thêm phóng/thu cỡ chữ cả cửa sổ; BR-08 xoá một hoặc nhiều phiên cùng lúc |
