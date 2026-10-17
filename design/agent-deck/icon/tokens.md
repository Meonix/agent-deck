# Token cho icon — dùng lại `../tokens.css`, không thêm màu

App đã có theme (slate + iris, trạng thái green/amber/red) → giữ nguyên, icon chỉ chọn trong các giá trị đó.

| Vai trò trong icon | Token | Hex | Độ tương phản (đo bằng script TOKENS.md §5) |
| --- | --- | --- | --- |
| Nền squircle tối | `.dark --background` (slate-dark-1) | #111113 | — |
| Khung sau (ló ra) | `.dark --border` (slate-dark-6) | #363a3f | 1.65 trên #111113 — chỉ là mảng nền, không phải chữ |
| Dấu nhắc trên nền tối | `.dark --foreground` (slate-dark-12) | #edeef0 | 16.25 AA trên #111113 |
| Nhấn chính | `--primary` (iris-9) | #5b5bd6 | chữ trắng trên nó 5.37 AA |
| Dấu nhắc tím trên nền tối | `.dark --accent-foreground` (iris-dark-11) | #b1a9ff | 8.97 AA trên #111113 |
| Con trỏ / chấm "đang chờ" | `--approval` (amber-9) | #ffc53d | 11.95 AA trên #111113 · 3.40 AA-large trên #5b5bd6 |
| Con trỏ "đang chạy" | `.dark --running-foreground` (green-dark-11) | #3dd68c | 9.38 AA trên #18191b |
| Nền squircle sáng | `--background` (slate-1) | #fcfcfd | glyph slate-12 #1c2024 đạt 15.98 AA |

Lưu ý: amber trên iris chỉ 3.40 — dùng được cho mảng lớn (con trỏ khối), không dùng cho nét mảnh.
