import { deck } from './renderCr002.js';

// CR-002 colour versions on wireframe C, section tints from tokens.css (sky-3 · sand-3). Chosen 2026-10-17: 1 · Tint phẳng (dark).
export default { title: 'Design/agent-deck/Proposal CR-002' };

/** 1 · Tint phẳng — mỗi section phủ tint hết chiều ngang cột, ngăn bằng viền 1px (ref #13 Cursor section có số đếm; ref #14 GitHub Desktop ngăn viền). Folder đang chọn giữ nền accent như app hiện tại. ĐÃ CHỌN. */
export const V1Flat = () => deck({ theme: 'dark', version: 'flat' });
V1Flat.storyName = '1 · Tint phẳng (dark)';

export const V1FlatLight = () => deck({ theme: 'light', version: 'flat' });
V1FlatLight.storyName = '1 · Tint phẳng (light)';

/** 2 · Thẻ tint — mỗi section là thẻ bo góc có viền, nổi trên nền cột, cùng kiểu với khung lịch sử (ref #15 Superhuman panel thẻ; ref #1 Linear panel bo góc). Folder đang chọn bằng ring. */
export const V2Cards = () => deck({ theme: 'dark', version: 'cards' });
V2Cards.storyName = '2 · Thẻ tint (dark)';

export const V2CardsLight = () => deck({ theme: 'light', version: 'cards' });
V2CardsLight.storyName = '2 · Thẻ tint (light)';

/** 3 · Tint nối — như 1, nhưng chip tên folder trên dòng Active mang tint của section Folders để mắt nối phiên với folder; folder đang chọn nền --background + ring cho nổi trên tint xanh (ref #11 Zed chip; ref #7 Conductor). */
export const V3Linked = () => deck({ theme: 'dark', version: 'linked' });
V3Linked.storyName = '3 · Tint nối (dark)';

export const V3LinkedLight = () => deck({ theme: 'light', version: 'linked' });
V3LinkedLight.storyName = '3 · Tint nối (light)';
