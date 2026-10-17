import { deck, folders, rows, maxBadge } from './renderCr001.js';
import { panes } from './wireframe-parts.js';

// CR-001 states on the chosen colour version (1 · Soft fill, dark). Earlier states stay in States.stories.js.
export default { title: 'Design/agent-deck/States CR-001' };

const dialog = (title, hint, action) => `
  <div class="dark absolute inset-0 bg-black/50 flex items-center justify-center">
    <div class="w-96 rounded-lg border border-border bg-card p-5 space-y-4">
      <div class="text-base font-medium text-foreground">${title}</div>
      <div class="text-sm text-muted-foreground">${hint}</div>
      <div class="flex justify-end gap-2">
        <button class="text-sm text-foreground border border-border rounded-md px-3 py-1.5">Cancel</button>
        <button class="text-sm bg-error text-black rounded-md px-3 py-1.5">${action}</button>
      </div>
    </div>
  </div>`;

const toast = (text) => `
  <div class="dark absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-error-border bg-error-bg text-error-foreground text-sm px-4 py-2">${text}</div>`;

/** Xoá một phiên không mở trong ô: hỏi trước khi chuyển vào Thùng rác (SRS-FR-048). */
export const DeleteConfirm = () => deck({}, {
  overlay: dialog('Move “Write BRD and SRS” to Trash?', 'You can restore it from the Trash.', 'Move to Trash'),
});

/** Xoá phiên đang mở trong ô: câu hỏi nói rõ ô sẽ bị đóng (SRS-FR-049). */
export const DeleteConfirmOpen = () => deck({}, {
  rows: rows.map((r) => ({ ...r, selected: r.title === 'Research PTY crates' })),
  overlay: dialog('Close “Research PTY crates” and move it to Trash?', 'The session will be ended and its pane closed.', 'Close and move'),
});

/** Không chuyển được vào Thùng rác: phiên vẫn còn trong danh sách (SRS-FR-050). */
export const DeleteFailed = () => deck({}, { overlay: toast('Session could not be deleted') });

/** Mọi phiên đang mở đều Idle: không dòng nào tô, không badge (SRS-FR-040 ví dụ âm). */
export const AllIdle = () => deck({}, {
  folders: folders.map(({ state, count, ...f }) => f),
  rows: [
    { title: 'Scaffold Tauri app', when: '2 min ago', live: true },
    { title: 'Research PTY crates', when: '20 min ago', live: true },
    ...rows.slice(2),
  ],
  panes: panes.map((p) => ({ ...p, status: 'Idle', lines: ['Done. 3 files changed.', '', '>'] })),
});

/** Không theo dõi được trạng thái: dòng chỉ có nhãn Live, không tô (SRS-FR-036). */
export const StatusUnavailable = () => deck({}, {
  rows: [rows[0], { title: 'Research PTY crates', when: '20 min ago', live: true }, ...rows.slice(2)],
  folders: folders.map((f) => (f.name === 'agent-deck' ? { ...f, state: 'Needs Approval', count: 1 } : f)),
  panes: [panes[0], panes[1], { ...panes[2], status: 'Idle', badge: 'Status unavailable', lines: ['>'] }, panes[3]],
});

const densePanes = [
  ...panes,
  { ws: 'k3s-infra', title: 'Upgrade ingress', status: 'Needs Approval', lines: ['Do you want to run kubectl apply?', '❯ 1. Yes', '  2. No'] },
  { ws: 'mokairo', title: 'Write e2e tests', status: 'Running', lines: ['✻ Writing tests/login.spec.ts…'] },
];
const denseFolders = [
  { name: 'agent-deck', selected: true, state: 'Error', count: 1 },
  { name: 'mokairo', state: 'Running', count: 2 },
  { name: 'k3s-infra', state: 'Needs Approval', count: 1 },
  { name: 'old-landing', missing: true },
  { name: 'notes' },
  { name: 'dotfiles' },
];
const denseRows = [
  rows[0],
  rows[1],
  { title: 'Wire status hooks', when: '5 min ago', state: 'Running' },
  ...rows.slice(2),
  { title: 'Spike xterm webgl', when: '2 weeks ago' },
  { title: 'Draft README', when: '3 weeks ago' },
];

/** Sáu ô, ba folder có phiên cần mình cùng lúc (SRS-NFR-001). */
export const DenseData = () => deck({}, { folders: denseFolders, rows: denseRows, panes: densePanes, grid: 'grid-cols-3 grid-rows-2' });

/** Cửa sổ hẹp 1024 px với cùng dữ liệu dày. */
export const DenseNarrow = () => deck({}, { folders: denseFolders, rows: denseRows, panes: densePanes, grid: 'grid-cols-2 grid-rows-3' });
DenseNarrow.globals = { viewport: { value: 'narrow1024', isRotated: false } };

/** Ô phóng to, các ô khác chỉ Running: không có badge (SRS-FR-044 ví dụ âm). */
export const MaximizedNoBadge = () => deck({}, { maximized: { pane: panes[1] } });

/** Ô phóng to, chỉ có phiên Needs Approval: badge màu vàng (SRS-FR-044). */
export const MaximizedApprovalOnly = () => deck({}, { maximized: { pane: panes[1], badge: maxBadge(1, 'Needs Approval') } });

/** Ô phóng to trong cửa sổ hẹp 1024 px: header vẫn đủ chỗ cho badge và nút. */
export const MaximizedNarrow = () => deck({}, { maximized: { pane: panes[1], badge: maxBadge(2) } });
MaximizedNarrow.globals = { viewport: { value: 'narrow1024', isRotated: false } };

/** Bản sáng của dòng tô màu và hộp xoá, vì app theo chế độ sáng/tối của hệ thống. */
export const DeleteConfirmLight = () => deck({ theme: 'light' }, {
  overlay: dialog('Move “Write BRD and SRS” to Trash?', 'You can restore it from the Trash.', 'Move to Trash').replace('class="dark ', 'class="light '),
});
