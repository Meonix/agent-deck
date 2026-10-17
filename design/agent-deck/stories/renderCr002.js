import { pane, square } from './renderCr001.js';
import { panes as defaultPanes } from './wireframe-parts.js';

// CR-002 window on wireframe C: Folders + Active Sessions (all folders) in the left column,
// Session History Panel as an inset card. Status colours stay the CR-001 soft fill.
// Section tints --section-folders (sky-3) / --section-active (sand-3), measured in tokens.css (SRS-NFR-009).

export const folders = [
  { name: 'agent-deck', selected: true, state: 'Error', count: 1 },
  { name: 'mokairo', state: 'Running', count: 1 },
  { name: 'k3s-infra' },
  { name: 'old-landing', missing: true },
];

// Urgency order per SRS-FR-052.
export const active = [
  { title: 'Research PTY crates', ws: 'agent-deck', state: 'Error', detail: '13:40 · API overloaded' },
  { title: 'Scaffold Tauri app', ws: 'agent-deck', state: 'Needs Approval', detail: '14:02 · Edit src/main.rs' },
  { title: 'Fix login redirect', ws: 'mokairo', state: 'Running' },
  { title: 'Refactor API client', ws: 'mokairo', state: 'Idle' },
];

export const history = [
  { title: 'Scaffold Tauri app', when: '2 min ago', live: true },
  { title: 'Research PTY crates', when: '20 min ago', live: true },
  { title: 'Write BRD and SRS', when: 'Yesterday', selected: true },
  { title: 'Init repo', when: '3 days ago' },
  { title: '(untitled)', when: 'Last week' },
];

const fill = { Error: 'bg-error-bg', 'Needs Approval': 'bg-approval-bg', Running: 'bg-running-bg', Idle: '' };
const detailText = { Error: 'text-error-foreground', 'Needs Approval': 'text-approval-foreground' };
const idleSquare = '<span class="inline-block size-2 shrink-0 rounded-[2px] border border-muted-foreground"></span>';

const count = (s, n) =>
  `<span class="inline-flex items-center gap-1 rounded-md border px-1.5 text-[11px] ${fill[s]} border-border text-foreground">${square(s)}${n}</span>`;

// Full class names written out so Tailwind's source scan picks them up.
const tint = { folders: 'bg-section-folders', active: 'bg-section-active' };

// section(kind) → wrapper classes · selected → selected folder row · folderChip → folder label on an Active row
export const versions = {
  flat: {
    section: (kind) => tint[kind],
    gap: '<div class="h-px bg-border"></div>',
    selected: 'bg-accent text-accent-foreground font-medium',
    folderChip: 'border border-border text-muted-foreground',
  },
  cards: {
    section: (kind) => `${tint[kind]} m-2 rounded-lg border border-border`,
    gap: '',
    selected: 'ring-1 ring-ring font-medium text-foreground',
    folderChip: 'border border-border text-muted-foreground',
  },
  linked: {
    section: (kind) => tint[kind],
    gap: '<div class="h-px bg-border"></div>',
    selected: 'bg-background ring-1 ring-ring font-medium text-foreground',
    folderChip: 'bg-section-folders text-foreground',
  },
};

const head = (label, action = '') => `
  <div class="px-3 pt-3 pb-1 flex items-center justify-between">
    <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">${label}</span>${action}
  </div>`;

const folderSection = (v, d) => `
  <section class="${v.section('folders')} pb-2">
    ${head('Folders', '<button class="text-xs text-foreground border border-border rounded-md px-2 py-0.5 bg-background">+ Add Folder</button>')}
    <ul class="px-2 space-y-0.5">
      ${d.folders.map((f) => `
        <li class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${f.state ? fill[f.state] : ''} ${f.selected ? (f.state ? 'ring-1 ring-ring font-medium text-foreground' : v.selected) : 'text-foreground'}">
          <span ${f.missing ? 'class="line-through text-muted-foreground"' : ''}>${f.name}</span>
          ${f.missing ? '<span class="text-xs text-error-foreground">Missing</span>' : f.state ? count(f.state, f.count) : ''}
        </li>`).join('')}
    </ul>
  </section>`;

const activeRow = (v) => (r) => `
  <li class="rounded-md px-2 py-1 ${fill[r.state]}">
    <div class="flex items-center gap-1.5 text-sm text-foreground">
      ${r.state === 'Idle' ? idleSquare : square(r.state)}
      <span class="truncate flex-1">${r.title}</span>
      <span class="text-[10px] rounded px-1 whitespace-nowrap ${v.folderChip}">${r.ws}</span>
    </div>
    ${r.detail ? `<div class="pl-3.5 text-xs truncate ${detailText[r.state]}">${r.detail}</div>` : ''}
  </li>`;

const activeSection = (v, d) => `
  <section class="${v.section('active')} pb-2 flex-1">
    ${head(`Active Sessions · ${d.active.length}`)}
    ${d.active.length
      ? `<ul class="px-2 space-y-0.5">${d.active.map(activeRow(v)).join('')}</ul>`
      : '<p class="px-3 py-2 text-sm text-muted-foreground">No active sessions</p>'}
  </section>`;

const liveTag = '<span class="text-[10px] uppercase font-medium text-accent-foreground bg-accent rounded px-1">Live</span>';

const historyCard = (d) => `
  <div class="p-2 pr-0 min-h-0">
    <aside class="h-full rounded-lg border border-border bg-background overflow-auto">
      <div class="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
        <span class="text-sm font-medium text-foreground truncate">${d.folders.find((f) => f.selected)?.name ?? ''}</span>
        <span class="flex items-center gap-1.5">
          <button class="text-xs bg-primary text-primary-foreground rounded-md px-2 py-1">New Session</button>
          <button aria-label="Close" class="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">✕</button>
        </span>
      </div>
      <div class="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">History · ${d.history.length}</div>
      ${d.historyNotice ?? ''}
      ${d.historyBody ?? `<ul class="px-2 space-y-0.5">
        ${d.history.map((r) => `
          <li class="rounded-md px-2 py-1.5 ${r.selected ? 'bg-muted' : ''}">
            <div class="flex items-center justify-between gap-2 text-sm text-foreground">
              <span class="truncate">${r.title}</span>${r.live ? liveTag : ''}
            </div>
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span>${r.when}</span>
              ${r.selected ? `<span class="flex gap-1">
                <button class="text-foreground border border-border rounded px-1.5">Resume</button>
                <button class="text-muted-foreground border border-border rounded px-1.5">Delete</button></span>` : ''}
            </div>
          </li>`).join('')}
      </ul>`}
    </aside>
  </div>`;

const titleBar = `
  <div class="h-9 flex items-center justify-between px-4 border-b border-border bg-card">
    <span class="text-sm font-medium text-foreground">agent-deck</span>
    <button class="text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5">Status Latency</button>
  </div>`;

// opts: theme, version · data: folders, active, history, historyNotice, historyBody, historyOpen, panes, grid, focused, maximized, overlay
export const deck = ({ theme = 'dark', version = 'flat' } = {}, data = {}) => {
  const d = { folders, active, history, panes: defaultPanes, grid: 'grid-cols-2 grid-rows-2', focused: 1, historyOpen: true, ...data };
  const v = versions[version];
  const left = `
    <aside class="bg-card border-r border-border overflow-auto flex flex-col">
      ${folderSection(v, d)}${v.gap}${activeSection(v, d)}
    </aside>`;
  const main = `<main class="min-h-0 grid ${d.grid} gap-2 p-2">${d.panes.map((p, i) => pane(p, i === d.focused)).join('')}</main>`;
  const body = d.maximized
    ? `<div class="h-full p-2">${pane(d.maximized.pane, true, true, d.maximized.badge ?? '')}</div>`
    : `<div class="h-full grid ${d.historyOpen ? 'grid-cols-[260px_280px_1fr]' : 'grid-cols-[260px_1fr]'}">
        ${left}${d.historyOpen ? historyCard(d) : ''}${main}
      </div>`;
  return `
    <div class="${theme} h-screen relative">
      <div class="h-full flex flex-col bg-background font-sans">${titleBar}<div class="flex-1 min-h-0">${body}</div></div>
      ${d.overlay ?? ''}
    </div>`;
};
