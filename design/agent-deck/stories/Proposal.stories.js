import { render } from './render.js';

export default { title: 'Design/agent-deck/Proposal' };

/** 1 · Dark Linear — nền tối liền mạch, mục chọn tô iris (ref #1 Linear); chấm trạng thái trước nhãn (ref #4 Superset). */
export const P1DarkLinear = () => render({ theme: 'dark' });

/** 2 · Light Conductor — nền sáng, chip trạng thái nền nhạt (ref #7 Conductor); thời gian canh phải trong danh sách phiên (ref #3 Raycast AI). */
export const P2LightConductor = () => render({ theme: 'light' });

/** 3 · Dark floating — ba vùng là panel nổi bo góc có khe, header viên thuốc (ref #2 Raycast); nút New Session đặc iris (ref #6 Nimbalyst). */
export const P3DarkFloating = () => render({ theme: 'dark', float: true });

/** 4 · Dark attention — viền ô đổi theo trạng thái, ô Needs Approval viền dày, folder có phiên chờ hiện chấm (ref #5 cmux); dấu vuông kiểu Warp (ref #8). */
export const P4DarkAttention = () => render({ theme: 'dark', glow: true, squares: true });
