import { panes } from './wireframe-parts.js';

// CR-001: Status Board gone; status lives on folder rows, session rows and the maximized pane badge.
export default { title: 'Design/agent-deck/Wireframe CR-001' };

const folders = [
  { name: 'agent-deck', selected: true, state: 'Error', count: 1 },
  { name: 'mokairo', state: 'Running', count: 1 },
  { name: 'k3s-infra' },
  { name: 'old-landing', missing: true },
];

const rows = [
  { title: 'Scaffold Tauri app', when: '2 min ago', live: true, state: 'Needs Approval', detail: '14:02 · Edit src/main.rs' },
  { title: 'Research PTY crates', when: '20 min ago', live: true, state: 'Error', detail: '13:40 · API overloaded' },
  { title: 'Write BRD and SRS', when: 'Yesterday', selected: true },
  { title: 'Init repo', when: '3 days ago' },
  { title: '(untitled)', when: 'Last week' },
];

// Grey stand-ins for the status colours: darker fill = more urgent.
const fill = {
  Error: 'bg-slate-300',
  'Needs Approval': 'bg-slate-200',
  Running: 'bg-slate-100',
};
const badge = {
  Error: 'bg-slate-800 text-white',
  'Needs Approval': 'border border-slate-700 text-slate-800 bg-white',
  Running: 'border border-slate-400 text-slate-600 bg-white',
};

const titleBar = (extra = '') => `
  <div class="h-9 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
    <span class="text-sm font-medium text-slate-800">agent-deck</span>
    <span class="flex items-center gap-2">${extra}
      <button class="text-xs text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">Status Latency</button>
    </span>
  </div>`;

const frame = (body, extra) => `
  <div class="h-screen flex flex-col bg-slate-50 font-sans">
    ${titleBar(extra)}
    <div class="flex-1 min-h-0">${body}</div>
  </div>`;

const sectionHead = (label, action) => `
  <div class="px-3 pt-3 pb-1 flex items-center justify-between">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">${label}</span>
    ${action}
  </div>`;

const addFolder = '<button class="text-xs text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">+ Add Folder</button>';
const newSession = '<button class="text-xs text-white bg-slate-700 rounded-md px-2 py-0.5">New Session</button>';

// Folder row: fill + count pill on the right (A, B) or a left edge bar + count (C).
const folderList = (edge = false) => `
  <ul class="px-2 space-y-0.5">
    ${folders.map((f) => {
      const tint = f.state ? fill[f.state] : f.selected ? 'bg-slate-100' : '';
      const ring = f.selected ? 'ring-1 ring-slate-500' : '';
      const bar = edge && f.state ? 'border-l-4 border-l-slate-700' : edge ? 'border-l-4 border-l-transparent' : '';
      return `
      <li class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-800 ${edge ? '' : tint} ${ring} ${bar}">
        <span ${f.missing ? 'class="line-through text-slate-400"' : ''}>${f.name}</span>
        ${f.missing ? '<span class="text-xs text-slate-500">Missing</span>'
          : f.state ? `<span class="text-[11px] rounded-full px-1.5 ${badge[f.state]}" title="${f.state}">${f.count}</span>` : ''}
      </li>`;
    }).join('')}
  </ul>`;

const selectedRing = 'ring-1 ring-slate-400';
const selectedFill = 'bg-slate-100';

const statusPill = (s) => `<span class="text-[10px] uppercase rounded px-1 whitespace-nowrap ${badge[s]}">${s}</span>`;

/** A — Tô cả dòng: nền dòng + badge tên trạng thái; Delete hiện trên dòng đang chọn cạnh Resume. */
const sessionRowsA = () => `
  <ul class="px-2 space-y-0.5">
    ${rows.map((r) => `
      <li class="rounded-md px-2 py-1.5 ${r.state ? fill[r.state] : r.selected ? selectedRing : ''}">
        <div class="flex items-center justify-between gap-2 text-sm text-slate-800">
          <span class="truncate">${r.title}</span>
          ${r.state ? statusPill(r.state) : r.live ? '<span class="text-[10px] uppercase border border-slate-400 text-slate-600 rounded px-1">Live</span>' : ''}
        </div>
        ${r.detail ? `<div class="text-xs text-slate-700 truncate">${r.detail}</div>` : ''}
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>${r.when}</span>
          ${r.selected ? '<span class="flex gap-1"><button class="border border-slate-400 rounded px-1.5">Resume</button><button class="border border-slate-300 text-slate-500 rounded px-1.5">Delete</button></span>' : ''}
        </div>
      </li>`).join('')}
  </ul>`;

/** B — Nhóm "Open" trên cùng: phiên đang mở tách khỏi lịch sử; Delete nằm trong menu ⋯ của từng dòng. */
const sessionRowsB = () => {
  const open = rows.filter((r) => r.live);
  const history = rows.filter((r) => !r.live);
  const row = (r) => `
    <li class="group rounded-md px-2 py-1.5 ${r.state ? fill[r.state] : r.selected ? selectedFill : ''}">
      <div class="flex items-center justify-between gap-2 text-sm text-slate-800">
        <span class="truncate">${r.title}</span>
        <span class="flex items-center gap-1">${r.state ? statusPill(r.state) : ''}<span class="text-slate-400">⋯</span></span>
      </div>
      ${r.detail ? `<div class="text-xs text-slate-700 truncate">${r.detail}</div>` : `<div class="text-xs text-slate-500">${r.when}</div>`}
      ${r.selected ? `
      <div class="mt-1 rounded-md border border-slate-300 bg-white text-xs text-slate-700 w-32">
        <div class="px-2 py-1">Resume</div>
        <div class="px-2 py-1 border-t border-slate-200">Move to Trash</div>
      </div>` : ''}
    </li>`;
  return `
    <div class="px-3 pt-1 text-[11px] uppercase tracking-wide text-slate-400">Open · ${open.length}</div>
    <ul class="px-2 space-y-0.5">${open.map(row).join('')}</ul>
    <div class="px-3 pt-3 text-[11px] uppercase tracking-wide text-slate-400">History</div>
    <ul class="px-2 space-y-0.5">${history.map(row).join('')}</ul>`;
};

const edgeC = (r) => (r.state === 'Error' ? 'border-l-slate-800 bg-slate-100' : r.state ? 'border-l-slate-500 bg-slate-100' : 'border-l-transparent');

/** C — Viền trái + ô vuông: không tô cả dòng, chỉ vạch 4px bên trái và badge vuông; Delete là ✕ ở cuối dòng khi rê chuột. */
const sessionRowsC = () => `
  <ul class="px-2 space-y-0.5">
    ${rows.map((r) => `
      <li class="rounded-md px-2 py-1.5 border-l-4 ${edgeC(r)} ${r.selected ? selectedRing : ''}">
        <div class="flex items-center justify-between gap-2 text-sm text-slate-800">
          <span class="truncate">${r.title}</span>
          <span class="flex items-center gap-1.5">
            ${r.state ? `<span class="text-[10px] rounded-sm px-1 ${badge[r.state]}">${r.state === 'Needs Approval' ? 'Approve' : r.state}</span>` : ''}
            ${r.selected ? '<span class="text-xs text-slate-500 border border-slate-300 rounded px-1">✕</span>' : ''}
          </span>
        </div>
        <div class="text-xs ${r.detail ? 'text-slate-700' : 'text-slate-500'} truncate">${r.detail ?? r.when}</div>
      </li>`).join('')}
  </ul>`;

const sidebar = (rowsHtml, edge) => `
  <aside class="border-r border-slate-200 bg-white overflow-auto">
    ${sectionHead('Folders', addFolder)}
    ${folderList(edge)}
    ${sectionHead('Sessions · agent-deck', newSession)}
    ${rowsHtml}
  </aside>`;

const paneHeaderButtons = (maximized) => `<span>⇥ ⇣ ${maximized ? '⤡' : '⤢'} ✕</span>`;

const pane = (p, focused, maximized = false, headerExtra = '') => `
  <section class="flex flex-col min-h-0 min-w-0 rounded-lg border ${focused ? 'border-slate-500' : 'border-slate-300'} bg-white overflow-hidden h-full">
    <header class="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50">
      <span class="text-xs text-slate-700 truncate">${p.ws} · ${p.title}</span>
      <span class="flex items-center gap-2 text-xs text-slate-500">
        ${headerExtra}
        <span class="border border-slate-300 rounded px-1">${p.status}</span>
        ${paneHeaderButtons(maximized)}
      </span>
    </header>
    <pre class="flex-1 p-3 font-mono text-xs leading-5 text-slate-700 bg-slate-100 overflow-hidden">${p.lines.join('\n')}</pre>
  </section>`;

const grid = () => `
  <div class="grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0 h-full">
    ${panes.map((p, i) => pane(p, i === 1)).join('')}
  </div>`;

const layout = (rowsHtml, edge) => frame(`
  <div class="h-full grid grid-cols-[260px_1fr]">
    ${sidebar(rowsHtml, edge)}
    <main class="min-h-0">${grid()}</main>
  </div>`);

// Maximized: pane 2 (mokairo · Fix login redirect) fills everything below the title bar.
const maxPane = panes[1];
const headerBadge = '<button class="text-[11px] rounded-full px-2 bg-slate-800 text-white">2 need you</button>';
const floatingBadge = `
  <div class="absolute top-14 right-5 rounded-md border border-slate-400 bg-white px-2 py-1 text-xs text-slate-800">
    <div class="font-medium">2 sessions need you</div>
    <div class="text-slate-500">Error · Research PTY crates</div>
  </div>`;
const titleBadge = '<button class="text-xs rounded-md px-2 py-0.5 bg-slate-800 text-white">2 need you ▸</button>';

export const A = () => layout(sessionRowsA(), false);
A.storyName = 'A · Tô cả dòng';

export const AMaximized = () => frame(`<div class="h-full p-2">${pane(maxPane, true, true, headerBadge)}</div>`);
AMaximized.storyName = 'A · Ô phóng to, badge trên header ô';

export const B = () => layout(sessionRowsB(), false);
B.storyName = 'B · Nhóm Open trên cùng';

export const BMaximized = () => frame(`<div class="h-full p-2 relative">${pane(maxPane, true, true)}${floatingBadge}</div>`);
BMaximized.storyName = 'B · Ô phóng to, thẻ nổi góc phải';

export const C = () => layout(sessionRowsC(), true);
C.storyName = 'C · Viền trái + badge vuông';

export const CMaximized = () => frame(`<div class="h-full p-2">${pane(maxPane, true, true)}</div>`, titleBadge);
CMaximized.storyName = 'C · Ô phóng to, badge trên thanh tiêu đề app';
