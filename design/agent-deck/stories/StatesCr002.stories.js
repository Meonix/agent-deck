import { maxBadge } from './renderCr001.js';
import { active, deck, folders, history } from './renderCr002.js';
import { panes } from './wireframe-parts.js';

// CR-002 states on the chosen colour version (1 · Tint phẳng, dark).
export default { title: 'Design/agent-deck/States CR-002' };

const skeleton = `
  <ul class="px-2 space-y-1.5 pt-1">
    ${[0, 1, 2, 3].map(() => `
      <li class="px-2 py-1.5 space-y-1.5">
        <div class="h-3 w-3/4 rounded bg-muted animate-pulse"></div>
        <div class="h-2.5 w-1/3 rounded bg-muted animate-pulse"></div>
      </li>`).join('')}
  </ul>`;

const notice = (text, tone = 'text-muted-foreground') => `<p class="px-3 py-2 text-sm ${tone}">${text}</p>`;

/** Chưa mở ô nào: Active Sessions rỗng; khung lịch sử vẫn mở cho folder đang chọn (SRS-FR-053). */
export const NoActiveSessions = () => deck({}, {
  folders: folders.map(({ state, count, ...f }) => f),
  active: [],
  history: history.map(({ live, ...r }) => r),
  panes: [],
});

/** Folder chưa có phiên nào: khung lịch sử chỉ có New Session và "No sessions yet" (SRS-FR-010). Khác nghĩa với Active rỗng. */
export const NoSessionsYet = () => deck({}, {
  folders: [{ name: 'notes', selected: true }, ...folders.map(({ selected, ...f }) => f)],
  history: [],
  historyBody: notice('No sessions yet'),
});

/** Đang đọc lịch sử của folder vừa chọn (≤ 3 giây với 200 phiên, SRS-NFR-003). */
export const HistoryLoading = () => deck({}, { historyBody: skeleton });

/** Một số phiên không đọc được: vẫn hiện phần đọc được + dòng báo (SRS-FR-011). */
export const HistoryUnreadable = () => deck({}, {
  history: history.slice(0, 3),
  historyNotice: notice('2 sessions could not be read', 'text-approval-foreground'),
});

/** Khung lịch sử đóng (× hoặc bấm lại folder): các ô rộng ra (SRS-FR-054). */
export const HistoryClosed = () => deck({}, { historyOpen: false });

/** Chọn folder Missing: khung lịch sử mở nhưng Resume / New Session báo "Folder not found" (SRS-FR-016, SRS-FR-020). */
export const MissingFolder = () => deck({}, {
  folders: folders.map((f) => ({ ...f, selected: f.name === 'old-landing' })),
  history: [{ title: 'Landing copy', when: '2 months ago', selected: true }, { title: 'Hero image', when: '3 months ago' }],
  overlay: `<div class="dark absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-error-border bg-error-bg text-error-foreground text-sm px-4 py-2">Folder not found</div>`,
});

const denseActive = [
  active[0],
  { title: 'Upgrade ingress', ws: 'k3s-infra', state: 'Error', detail: '14:10 · Session exited' },
  active[1],
  { title: 'Rotate certs', ws: 'k3s-infra', state: 'Needs Approval', detail: '14:06 · Bash kubectl apply' },
  active[2],
  { title: 'Write e2e tests', ws: 'mokairo', state: 'Running' },
  { title: 'Wire status hooks', ws: 'agent-deck', state: 'Running' },
  active[3],
  { title: 'Draft README', ws: 'notes', state: 'Idle' },
];
const denseFolders = [
  { name: 'agent-deck', selected: true, state: 'Error', count: 1 },
  { name: 'mokairo', state: 'Running', count: 2 },
  { name: 'k3s-infra', state: 'Error', count: 1 },
  { name: 'notes' },
  { name: 'old-landing', missing: true },
  { name: 'dotfiles' },
];
const densePanes = [
  ...panes,
  { ws: 'k3s-infra', title: 'Rotate certs', status: 'Needs Approval', lines: ['Do you want to run kubectl apply?', '❯ 1. Yes', '  2. No'] },
  { ws: 'mokairo', title: 'Write e2e tests', status: 'Running', lines: ['✻ Writing tests/login.spec.ts…'] },
];

/** Chín phiên đang mở ở bốn folder, xếp gấp trước (SRS-FR-051, SRS-FR-052). */
export const DenseData = () => deck({}, { folders: denseFolders, active: denseActive, panes: densePanes, grid: 'grid-cols-3 grid-rows-2' });

/** Cửa sổ hẹp 1024 px, khung lịch sử mở: ô còn khoảng 480 px. */
export const DenseNarrow = () => deck({}, { folders: denseFolders, active: denseActive, panes: densePanes.slice(0, 4), grid: 'grid-cols-1 grid-rows-4' });
DenseNarrow.globals = { viewport: { value: 'narrow1024', isRotated: false } };

/** Ô phóng to che cả cột trái, Active Sessions và khung lịch sử (SRS-FR-041). */
export const Maximized = () => deck({}, { maximized: { pane: panes[1], badge: maxBadge(2) } });

/** Bản sáng: app theo chế độ sáng/tối của hệ thống, tint phải vẫn phân biệt được. */
export const Light = () => deck({ theme: 'light' });
