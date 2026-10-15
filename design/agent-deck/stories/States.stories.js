import { render } from './render.js';
import { workspaces, panes } from './wireframe-parts.js';

export default { title: 'Design/agent-deck/States' };

const P4 = { theme: 'dark', glow: true, squares: true };
const noCards = { Running: [], 'Needs Approval': [], Error: [] };

const centered = (title, hint, action) => `
  <main class="min-h-0 flex items-center justify-center p-2">
    <div class="text-center space-y-2 max-w-sm">
      <div class="text-base font-medium text-foreground">${title}</div>
      <div class="text-sm text-muted-foreground">${hint}</div>
      ${action ? `<button class="mt-2 text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5">${action}</button>` : ''}
    </div>
  </main>`;

const toast = (text) => `
  <div class="dark absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-error-border bg-error-bg text-error-foreground text-sm px-4 py-2">${text}</div>`;

/** Chưa thêm folder nào: lần đầu mở app. */
export const EmptyNoFolders = () => render(P4, {
  workspaces: [],
  hideNewSession: true,
  sessionsBody: '<div class="px-4 py-2 text-xs text-muted-foreground">Select a folder to see its sessions.</div>',
  mainBody: centered('No folders yet', 'Add a folder you work in with Claude Code.', '+ Add Folder'),
  cards: noCards,
});

/** Folder có rồi nhưng chưa chạy Claude Code lần nào (SRS-FR-010). */
export const EmptyNoSessions = () => render(P4, {
  workspaces: workspaces.map((w) => ({ ...w, selected: w.name === 'k3s-infra', live: 0, attention: false })),
  sessionsBody: '<div class="px-4 py-2 text-sm text-muted-foreground">No sessions yet</div>',
  mainBody: centered('No open sessions', 'Resume a session from the list, or start a new one.', 'New Session'),
  cards: noCards,
});

/** Đang đọc danh sách phiên của folder (SRS-NFR-003: tối đa 3 giây với 200 phiên). */
export const LoadingSessions = () => render(P4, {
  sessionsBody: `<ul class="px-2 space-y-1.5 pt-1">${[1, 2, 3, 4].map(() => `
    <li class="rounded-md px-2 py-1.5 space-y-1.5"><div class="h-3 w-3/4 rounded bg-muted animate-pulse"></div><div class="h-2.5 w-1/3 rounded bg-muted animate-pulse"></div></li>`).join('')}</ul>`,
});

/** Có phiên không đọc được (SRS-FR-011). */
export const ErrorUnreadableSessions = () => render(P4, {
  sessionsNotice: '<div class="mx-2 mb-1 rounded-md border border-error-border bg-error-bg px-2 py-1.5 text-xs text-error-foreground">2 sessions could not be read</div>',
});

/** Resume hoặc New Session trong folder Missing (SRS-FR-016, SRS-FR-020). */
export const ErrorFolderNotFound = () => render(P4, {
  workspaces: workspaces.map((w) => ({ ...w, selected: w.missing, attention: false })),
  sessionsBody: '<div class="px-4 py-2 text-sm text-muted-foreground">This folder no longer exists on disk.</div>',
  overlay: toast('Folder not found'),
});

/** Bỏ folder đang còn ô mở (SRS-FR-006). */
export const ErrorRemoveBlocked = () => render(P4, {
  overlay: toast('Close the open sessions of this folder first'),
});

/** Không khởi động được Claude Code trong ô (SRS-FR-017). */
export const ErrorClaudeNotStarted = () => render(P4, {
  panes: [{ ...panes[0], status: 'Idle', badge: 'Not started', lines: ['Claude Code could not be started', '', 'Check that Claude Code is installed and on your PATH.'] }, ...panes.slice(1)],
});

/** Không theo dõi được trạng thái của phiên trong ô (SRS-FR-036). */
export const StatusUnavailable = () => render(P4, {
  panes: [panes[0], { ...panes[1], status: 'Idle', badge: 'Status unavailable' }, ...panes.slice(2)],
  cards: { 'Needs Approval': [{ ws: 'agent-deck', title: 'Scaffold Tauri app', since: '14:02', reason: 'Edit src/main.rs' }], Running: [], Error: [{ ws: 'agent-deck', title: 'Research PTY crates', since: '13:40', reason: 'overloaded' }] },
});

/** Phiên trong ô đã thoát (SRS-FR-028). */
export const SessionEnded = () => render(P4, {
  panes: [...panes.slice(0, 3), { ...panes[3], status: 'Idle', badge: 'Ended', lines: ['Done. 3 files changed.', '> /exit'], footer: '<div class="border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">Session ended</div>' }],
});

/** Đóng ô đang Running hoặc Needs Approval (SRS-FR-027). */
export const ConfirmClose = () => render(P4, {
  overlay: `
    <div class="dark absolute inset-0 bg-black/50 flex items-center justify-center">
      <div class="w-96 rounded-lg border border-border bg-card p-5 space-y-4">
        <div class="text-base font-medium text-foreground">Session is still running. Close anyway?</div>
        <div class="text-sm text-muted-foreground">mokairo · Fix login redirect will be ended.</div>
        <div class="flex justify-end gap-2">
          <button class="text-sm text-foreground border border-border rounded-md px-3 py-1.5">Cancel</button>
          <button class="text-sm bg-error text-black rounded-md px-3 py-1.5">Close</button>
        </div>
      </div>
    </div>`,
});

const densePanes = [
  ...panes,
  { ws: 'k3s-infra', title: 'Upgrade ingress', status: 'Needs Approval', lines: ['Do you want to run kubectl apply?', '❯ 1. Yes', '  2. No'] },
  { ws: 'mokairo', title: 'Write e2e tests', status: 'Running', lines: ['✻ Writing tests/login.spec.ts…'] },
];
const denseCards = {
  'Needs Approval': [
    { ws: 'agent-deck', title: 'Scaffold Tauri app', since: '14:02', reason: 'Edit src/main.rs' },
    { ws: 'k3s-infra', title: 'Upgrade ingress', since: '14:05', reason: 'Bash kubectl apply' },
  ],
  Error: [{ ws: 'agent-deck', title: 'Research PTY crates', since: '13:40', reason: 'overloaded' }],
  Running: [
    { ws: 'mokairo', title: 'Fix login redirect', since: '13:58', reason: 'Bash npm test' },
    { ws: 'mokairo', title: 'Write e2e tests', since: '14:06', reason: 'Write tests/login.spec.ts' },
  ],
};

/** Nhiều ô và nhiều thẻ cùng lúc (SRS-NFR-001: ít nhất 4 ô). */
export const DenseData = () => render(P4, { panes: densePanes, cards: denseCards, grid: 'grid-cols-3 grid-rows-2' });

/** Cửa sổ hẹp 1024 px với cùng dữ liệu dày. */
export const DenseNarrow = () => render(P4, { panes: densePanes, cards: denseCards, grid: 'grid-cols-2 grid-rows-3' });
DenseNarrow.globals = { viewport: { value: 'narrow1024', isRotated: false } };

const latency = (body) => `
  <div class="dark h-screen bg-background font-sans flex items-start justify-center p-8">
    <section class="w-full max-w-xl rounded-lg border border-border bg-card p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-medium text-foreground">Status Latency</h1>
        <span class="text-xs text-muted-foreground">Last 14 days</span>
      </div>
      ${body}
    </section>
  </div>`;

/** Báo cáo BO-01 có dữ liệu (SRS-FR-039). */
export const StatusLatency = () => latency(`
  <div>
    <div class="text-4xl font-semibold text-running-foreground">99.5%</div>
    <div class="text-sm text-muted-foreground">398 of 400 state changes appeared within 3 s</div>
  </div>`);

/** Báo cáo khi chưa có lần đổi trạng thái nào — không hiện 0% (SRS-FR-039, Ví dụ âm). */
export const StatusLatencyNoData = () => latency(`
  <div class="text-sm text-muted-foreground">No data yet</div>`);
