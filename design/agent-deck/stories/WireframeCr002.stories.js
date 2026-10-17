import { panes } from './wireframe-parts.js';

// CR-002: left column = Folders + Active Sessions (all folders), history moves to its own closable column.
export default { title: 'Design/agent-deck/Wireframe CR-002' };

const folders = [
  { name: 'agent-deck', selected: true, state: 'Error', count: 1 },
  { name: 'mokairo', state: 'Running', count: 1 },
  { name: 'k3s-infra' },
  { name: 'old-landing', missing: true },
];

// Already in urgency order (SRS-FR-052): Error, Needs Approval, Running, Idle.
const active = [
  { title: 'Research PTY crates', ws: 'agent-deck', state: 'Error', detail: '13:40 · API overloaded' },
  { title: 'Scaffold Tauri app', ws: 'agent-deck', state: 'Needs Approval', detail: '14:02 · Edit src/main.rs' },
  { title: 'Fix login redirect', ws: 'mokairo', state: 'Running' },
  { title: 'Refactor API client', ws: 'mokairo', state: 'Idle' },
];

const history = [
  { title: 'Scaffold Tauri app', when: '2 min ago', live: true },
  { title: 'Research PTY crates', when: '20 min ago', live: true },
  { title: 'Write BRD and SRS', when: 'Yesterday', selected: true },
  { title: 'Init repo', when: '3 days ago' },
  { title: '(untitled)', when: 'Last week' },
];

// Grey stand-ins: darker fill = more urgent. Section tints are two different light greys.
const fill = { Error: 'bg-slate-300', 'Needs Approval': 'bg-slate-200', Running: 'bg-white', Idle: '' };
const badge = {
  Error: 'bg-slate-800 text-white',
  'Needs Approval': 'border border-slate-700 text-slate-800 bg-white',
  Running: 'border border-slate-400 text-slate-600 bg-white',
  Idle: 'border border-slate-300 text-slate-500 bg-white',
};
const tintFolders = 'bg-slate-100';
const tintActive = 'bg-gray-200';

const titleBar = () => `
  <div class="h-9 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
    <span class="text-sm font-medium text-slate-800">agent-deck</span>
    <button class="text-xs text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">Status Latency</button>
  </div>`;

const frame = (body) => `
  <div class="h-screen flex flex-col bg-slate-50 font-sans">
    ${titleBar()}
    <div class="flex-1 min-h-0">${body}</div>
  </div>`;

const sectionHead = (label, action = '') => `
  <div class="px-3 pt-3 pb-1 flex items-center justify-between">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">${label}</span>
    ${action}
  </div>`;

const addFolder = '<button class="text-xs text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">+ Add Folder</button>';

const folderSection = () => `
  <section class="${tintFolders} pb-2">
    ${sectionHead('Folders', addFolder)}
    <ul class="px-2 space-y-0.5">
      ${folders.map((f) => `
        <li class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-800 ${f.state ? fill[f.state] : ''} ${f.selected ? 'ring-1 ring-slate-500 font-medium' : ''}">
          <span ${f.missing ? 'class="line-through text-slate-400"' : ''}>${f.name}</span>
          ${f.missing ? '<span class="text-xs text-slate-500">Missing</span>'
            : f.state ? `<span class="text-[11px] rounded-full px-1.5 ${badge[f.state]}">${f.count}</span>` : ''}
        </li>`).join('')}
    </ul>
  </section>`;

const pill = (s) => `<span class="text-[10px] uppercase rounded px-1 whitespace-nowrap ${badge[s]}">${s}</span>`;

/** Two-line row: title + state, then "folder · time · reason". */
const activeRowTall = (r) => `
  <li class="rounded-md px-2 py-1.5 ${fill[r.state]}">
    <div class="flex items-center justify-between gap-2 text-sm text-slate-800">
      <span class="truncate">${r.title}</span>${pill(r.state)}
    </div>
    <div class="text-xs text-slate-600 truncate">${r.ws}${r.detail ? ` · ${r.detail}` : ''}</div>
  </li>`;

const marker = {
  Error: 'bg-slate-800',
  'Needs Approval': 'bg-slate-500',
  Running: 'bg-slate-400',
  Idle: 'border border-slate-400',
};

/** One-line row: folder as a small chip; the detail line only appears for Needs Approval / Error. */
const activeRowCompact = (r) => `
  <li class="rounded-md px-2 py-1 ${fill[r.state]}">
    <div class="flex items-center gap-1.5 text-sm text-slate-800">
      <span class="w-2 h-2 rounded-sm shrink-0 ${marker[r.state]}"></span>
      <span class="truncate flex-1">${r.title}</span>
      <span class="text-[10px] text-slate-500 border border-slate-300 rounded px-1">${r.ws}</span>
    </div>
    ${r.detail ? `<div class="pl-3.5 text-xs text-slate-600 truncate">${r.detail}</div>` : ''}
  </li>`;

const activeSection = (row, grow = true) => `
  <section class="${tintActive} pb-2 ${grow ? 'flex-1' : ''}">
    ${sectionHead(`Active Sessions · ${active.length}`)}
    <ul class="px-2 space-y-0.5">${active.map(row).join('')}</ul>
  </section>`;

const historyRows = () => `
  <ul class="px-2 space-y-0.5">
    ${history.map((r) => `
      <li class="rounded-md px-2 py-1.5 ${r.selected ? 'bg-slate-100' : ''}">
        <div class="flex items-center justify-between gap-2 text-sm text-slate-800">
          <span class="truncate">${r.title}</span>
          ${r.live ? '<span class="text-[10px] uppercase border border-slate-400 text-slate-600 rounded px-1">Live</span>' : ''}
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>${r.when}</span>
          ${r.selected ? '<span class="flex gap-1"><button class="border border-slate-400 rounded px-1.5">Resume</button><button class="border border-slate-300 text-slate-500 rounded px-1.5">Delete</button></span>' : ''}
        </div>
      </li>`).join('')}
  </ul>`;

const historyHead = () => `
  <div class="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
    <span class="text-sm font-medium text-slate-800 truncate">agent-deck</span>
    <span class="flex items-center gap-1.5">
      <button class="text-xs text-white bg-slate-700 rounded-md px-2 py-0.5">New Session</button>
      <button aria-label="Close" class="text-xs text-slate-500 border border-slate-300 rounded px-1.5">✕</button>
    </span>
  </div>
  <div class="px-3 pb-1 text-[11px] uppercase tracking-wide text-slate-400">History · 5</div>`;

/** Flush column, divided by a 1px border (GitHub Desktop, reference 14). */
const historyFlush = () => `
  <aside class="border-r border-slate-200 bg-white overflow-auto">${historyHead()}${historyRows()}</aside>`;

/** Inset card with a gap around it (Superhuman, reference 15). */
const historyCard = () => `
  <div class="p-2 pr-0 min-h-0">
    <aside class="h-full rounded-lg border border-slate-300 bg-white overflow-auto">${historyHead()}${historyRows()}</aside>
  </div>`;

const pane = (p, focused) => `
  <section class="flex flex-col min-h-0 min-w-0 rounded-lg border ${focused ? 'border-slate-500' : 'border-slate-300'} bg-white overflow-hidden h-full">
    <header class="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50">
      <span class="text-xs text-slate-700 truncate">${p.ws} · ${p.title}</span>
      <span class="flex items-center gap-2 text-xs text-slate-500">
        <span class="border border-slate-300 rounded px-1">${p.status}</span>
        <span>⇥ ⇣ ⤢ ✕</span>
      </span>
    </header>
    <pre class="flex-1 p-3 font-mono text-xs leading-5 text-slate-700 bg-slate-100 overflow-hidden">${p.lines.join('\n')}</pre>
  </section>`;

const grid = () => `
  <main class="min-h-0">
    <div class="grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0 h-full">
      ${panes.map((p, i) => pane(p, i === 1)).join('')}
    </div>
  </main>`;

const leftColumn = (sections) => `
  <aside class="border-r border-slate-200 bg-white overflow-auto flex flex-col">${sections}</aside>`;

const withHistory = (left, hist) => frame(`
  <div class="h-full grid grid-cols-[260px_280px_1fr]">${left}${hist}${grid()}</div>`);

const withoutHistory = (left) => frame(`
  <div class="h-full grid grid-cols-[260px_1fr]">${left}${grid()}</div>`);

const leftA = () => leftColumn(`${folderSection()}<div class="h-px bg-slate-200"></div>${activeSection(activeRowTall)}`);
const leftB = () => leftColumn(`${activeSection(activeRowTall, false)}<div class="h-px bg-slate-200"></div><div class="flex-1 flex flex-col">${folderSection().replace('pb-2', 'pb-2 flex-1')}</div>`);
const leftC = () => leftColumn(`${folderSection()}<div class="h-px bg-slate-200"></div>${activeSection(activeRowCompact)}`);

export const A = () => withHistory(leftA(), historyFlush());
A.storyName = 'A · Folders trên, Active dưới, khung lịch sử liền';

export const AClosed = () => withoutHistory(leftA());
AClosed.storyName = 'A · Khung lịch sử đóng';

export const B = () => withHistory(leftB(), historyFlush());
B.storyName = 'B · Active trên, Folders dưới';

export const C = () => withHistory(leftC(), historyCard());
C.storyName = 'C · Active gọn một dòng, khung lịch sử dạng thẻ nổi';
