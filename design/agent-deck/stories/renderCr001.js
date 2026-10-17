import { panes as defaultPanes } from './wireframe-parts.js';

// CR-001 window: Status Board gone, status lives on folder rows, session rows and the maximized pane badge.
// Built on the shipped P4 Dark attention (square markers, pane border by status).
// No new tokens. Text on the status fills (WCAG script, TOKENS.md §5): muted-foreground 5.18–5.47 light,
// 7.08–7.84 dark; foreground 14.06+; *-foreground on *-bg as in tokens.css.

export const folders = [
  { name: 'agent-deck', selected: true, state: 'Error', count: 1 },
  { name: 'mokairo', state: 'Running', count: 1 },
  { name: 'k3s-infra' },
  { name: 'old-landing', missing: true },
];

export const rows = [
  { title: 'Scaffold Tauri app', when: '2 min ago', state: 'Needs Approval', detail: '14:02 · Edit src/main.rs' },
  { title: 'Research PTY crates', when: '20 min ago', state: 'Error', detail: '13:40 · API overloaded' },
  { title: 'Write BRD and SRS', when: 'Yesterday', selected: true },
  { title: 'Init repo', when: '3 days ago' },
  { title: '(untitled)', when: 'Last week' },
];

// Same token classes as src/components/statusTone.tsx.
const tone = {
  'Needs Approval': { dot: 'bg-approval', bg: 'bg-approval-bg', text: 'text-approval-foreground', border: 'border-approval-border', edge: 'border-l-approval', ring: 'border-approval' },
  Running: { dot: 'bg-running', bg: 'bg-running-bg', text: 'text-running-foreground', border: 'border-running-border', edge: 'border-l-running', ring: 'border-running' },
  Error: { dot: 'bg-error', bg: 'bg-error-bg', text: 'text-error-foreground', border: 'border-error-border', edge: 'border-l-error', ring: 'border-error' },
  Idle: { dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', edge: 'border-l-border', ring: 'border-border' },
};

export const square = (s) => `<span class="inline-block size-2 shrink-0 rounded-[2px] ${tone[s].dot}"></span>`;
export const chip = (s, label = s) => `<span class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[11px] ${tone[s].bg} ${tone[s].text} ${tone[s].border}">${square(s)}${label}</span>`;

// row(state) → classes for a highlighted row · rowChip(state) → session badge · count(state, n) → folder badge
export const versions = {
  soft: {
    row: (s) => `${tone[s].bg}`,
    rowChip: (s) => chip(s),
    count: (s, n) => `<span class="inline-flex items-center gap-1 rounded-md border px-1.5 text-[11px] ${tone[s].bg} ${tone[s].text} ${tone[s].border}">${square(s)}${n}</span>`,
  },
  edge: {
    row: (s) => `${tone[s].bg} border-l-2 ${tone[s].edge} rounded-l-none`,
    rowChip: (s) => chip(s),
    count: (s, n) => `<span class="inline-flex items-center gap-1 text-[11px] font-medium ${tone[s].text}">${square(s)}${n}</span>`,
  },
  quiet: {
    row: (s) => (s === 'Running' ? '' : `${tone[s].bg}`),
    rowChip: (s) => (s === 'Running' ? `<span class="inline-flex items-center gap-1 text-[11px] ${tone[s].text}">${square(s)}Running</span>` : chip(s)),
    count: (s, n) => `<span class="inline-flex items-center gap-1 text-[11px] ${tone[s].text}">${square(s)}${n}</span>`,
  },
};

const liveTag = '<span class="text-[10px] uppercase font-medium text-accent-foreground bg-accent rounded px-1">Live</span>';

const sidebar = (v, d) => `
  <aside class="bg-card border-r border-border overflow-auto">
    <div class="px-3 pt-3 pb-1 flex items-center justify-between">
      <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folders</span>
      <button class="text-xs text-foreground border border-border rounded-md px-2 py-0.5">+ Add Folder</button>
    </div>
    <ul class="px-2 space-y-0.5">
      ${d.folders.map((f) => `
        <li class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${f.state ? v.row(f.state) : ''} ${f.selected ? 'ring-1 ring-ring font-medium text-foreground' : 'text-foreground'}">
          <span ${f.missing ? 'class="line-through text-muted-foreground"' : ''}>${f.name}</span>
          ${f.missing ? '<span class="text-xs text-error-foreground">Missing</span>' : f.state ? v.count(f.state, f.count) : ''}
        </li>`).join('')}
    </ul>
    <div class="px-3 pt-4 pb-1 flex items-center justify-between">
      <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions · ${d.folders.find((f) => f.selected)?.name ?? ''}</span>
      <button class="text-xs bg-primary text-primary-foreground rounded-md px-2 py-1">New Session</button>
    </div>
    <ul class="px-2 space-y-0.5">
      ${d.rows.map((r) => `
        <li class="rounded-md px-2 py-1.5 ${r.state ? v.row(r.state) : r.selected ? 'bg-muted' : ''}">
          <div class="flex items-center justify-between gap-2 text-sm text-foreground">
            <span class="truncate">${r.title}</span>
            ${r.state ? v.rowChip(r.state) : r.live ? liveTag : ''}
          </div>
          ${r.detail ? `<div class="text-xs truncate ${tone[r.state].text}">${r.detail}</div>` : ''}
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>${r.when}</span>
            ${r.selected ? `<span class="flex gap-1">
              <button class="text-foreground border border-border rounded px-1.5">Resume</button>
              <button class="text-muted-foreground border border-border rounded px-1.5">Delete</button></span>` : ''}
          </div>
        </li>`).join('')}
    </ul>
  </aside>`;

export const pane = (p, focused, maximized = false, badge = '') => `
  <section class="flex flex-col min-h-0 min-w-0 h-full rounded-lg border ${p.status === 'Idle' ? (focused ? 'border-ring' : 'border-border') : tone[p.status].ring} ${p.status === 'Needs Approval' ? 'border-2' : ''} bg-background overflow-hidden">
    <header class="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card">
      <span class="min-w-0 text-xs text-foreground truncate"><span class="text-muted-foreground">${p.ws} ·</span> ${p.title}</span>
      <span class="flex shrink-0 items-center gap-2 text-xs whitespace-nowrap">
        ${badge}
        ${p.badge ? `<span class="border border-border rounded-md px-1.5 text-muted-foreground">${p.badge}</span>` : chip(p.status)}
        <span class="text-muted-foreground">⇥ ⇣ ${maximized ? '⤡' : '⤢'} ✕</span>
      </span>
    </header>
    <pre class="flex-1 p-3 font-mono text-xs leading-5 text-foreground overflow-hidden">${p.lines.join('\n')}</pre>
  </section>`;

const titleBar = `
  <div class="h-9 flex items-center justify-between px-4 border-b border-border bg-card">
    <span class="text-sm font-medium text-foreground">agent-deck</span>
    <button class="text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5">Status Latency</button>
  </div>`;

// Badge counts the other sessions in Needs Approval or Error; Error colour wins.
export const maxBadge = (n, state = 'Error') =>
  `<button class="inline-flex items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium ${tone[state].bg} ${tone[state].text} ${tone[state].border}">${square(state)}${n} need you</button>`;

// opts: theme, version · data: folders, rows, panes, grid, focused, maximized { pane, badge }, overlay
export const deck = ({ theme = 'dark', version = 'soft' } = {}, data = {}) => {
  const d = { folders, rows, panes: defaultPanes, grid: 'grid-cols-2 grid-rows-2', focused: 1, ...data };
  const v = versions[version];
  const body = d.maximized
    ? `<div class="h-full p-2">${pane(d.maximized.pane, true, true, d.maximized.badge ?? '')}</div>`
    : `<div class="h-full grid grid-cols-[260px_1fr]">
        ${sidebar(v, d)}
        <main class="min-h-0 grid ${d.grid} gap-2 p-2">${d.panes.map((p, i) => pane(p, i === d.focused)).join('')}</main>
      </div>`;
  return `
    <div class="${theme} h-screen relative">
      <div class="h-full flex flex-col bg-background font-sans">${titleBar}<div class="flex-1 min-h-0">${body}</div></div>
      ${d.overlay ?? ''}
    </div>`;
};
