import { deck, maxBadge } from './renderCr001.js';
import { panes } from './wireframe-parts.js';

// CR-001 colour versions on wireframe A. Chosen 2026-10-17: 1 · Soft fill.
export default { title: 'Design/agent-deck/Proposal CR-001' };

/** 1 · Soft fill — cả dòng nền trạng thái bậc 3, badge chip có ô vuông (ref #5 cmux tô mục cần người; ref #8 Warp ô vuông). Dark như app hiện tại. ĐÃ CHỌN. */
export const V1SoftFill = () => deck({ theme: 'dark', version: 'soft' });
V1SoftFill.storyName = '1 · Soft fill (dark)';

/** 2 · Fill + edge — nền bậc 3 thêm vạch trái 2px màu bậc 9, folder chỉ ô vuông + số (ref #4 Superset chấm trước tên; ref #10 Linear Inbox dòng hai tầng). */
export const V2FillEdge = () => deck({ theme: 'dark', version: 'edge' });
V2FillEdge.storyName = '2 · Fill + edge (dark)';

/** 3 · Quiet running — chỉ Needs Approval / Error được tô nền; Running chỉ ô vuông xanh, đỡ nhiễu khi nhiều phiên chạy (ref #11 Zed chấm màu trước tiêu đề). */
export const V3QuietRunning = () => deck({ theme: 'dark', version: 'quiet' });
V3QuietRunning.storyName = '3 · Quiet running (dark)';

/** 4 · Soft fill bản sáng — kiểm bậc 3 trên nền sáng, vì app theo chế độ sáng/tối của hệ thống. */
export const V4SoftFillLight = () => deck({ theme: 'light', version: 'soft' });
V4SoftFillLight.storyName = '4 · Soft fill (light)';

/** Ô phóng to — dùng chung cho cả bốn bản: badge "2 need you" màu Error trên header ô. */
export const MaximizedDark = () => deck({ theme: 'dark' }, { maximized: { pane: panes[1], badge: maxBadge(2) } });
MaximizedDark.storyName = 'Ô phóng to (dark)';

export const MaximizedLight = () => deck({ theme: 'light' }, { maximized: { pane: panes[1], badge: maxBadge(2) } });
MaximizedLight.storyName = 'Ô phóng to (light)';
