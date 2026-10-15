import { workspaces, sessions, panes, cards, statusOrder } from './wireframe-parts.js';

const tone = {
  'Needs Approval': { dot: 'bg-approval', chip: 'bg-approval-bg text-approval-foreground border-approval-border', edge: 'border-l-approval', ring: 'border-approval' },
  Running: { dot: 'bg-running', chip: 'bg-running-bg text-running-foreground border-running-border', edge: 'border-l-running', ring: 'border-running' },
  Error: { dot: 'bg-error', chip: 'bg-error-bg text-error-foreground border-error-border', edge: 'border-l-error', ring: 'border-error' },
  Idle: { dot: 'bg-muted-foreground', chip: 'bg-muted text-muted-foreground border-border', edge: 'border-l-border', ring: 'border-border' },
};

// opts: theme ('dark' | 'light'), float (panels floating with gaps), glow (pane border takes status colour), squares (Warp-style square markers)
export const render = (opts, data = {}) => {
  const d = { workspaces, sessions, panes, cards, ...data };
  const marker = (s) => opts.squares
    ? `<span class="inline-block size-2 rounded-[2px] ${tone[s].dot}"></span>`
    : `<span class="inline-block size-2 rounded-full ${tone[s].dot}"></span>`;
  const panel = opts.float ? 'rounded-lg border border-border bg-card' : 'bg-card';

  const sidebar = `
    <aside class="${panel} overflow-auto ${opts.float ? '' : 'border-r border-border'}">
      <div class="px-3 pt-3 pb-1 flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folders</span>
        <button class="text-xs text-foreground border border-border rounded-md px-2 py-0.5">+ Add Folder</button>
      </div>
      <ul class="px-2 space-y-0.5">
        ${d.workspaces.map((w) => `
          <li class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${w.selected ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground'}">
            <span class="flex items-center gap-2 ${w.missing ? 'line-through text-muted-foreground' : ''}">
              ${opts.glow && (w.attention ?? w.name === 'agent-deck') ? marker('Needs Approval') : ''}${w.name}
            </span>
            <span class="text-xs ${w.missing ? 'text-error-foreground' : 'text-muted-foreground'}">${w.missing ? 'Missing' : w.live ? `${w.live} live` : ''}</span>
          </li>`).join('')}
      </ul>
      <div class="px-3 pt-4 pb-1 flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions</span>
        ${d.hideNewSession ? '' : '<button class="text-xs bg-primary text-primary-foreground rounded-md px-2 py-1">New Session</button>'}
      </div>
      ${d.sessionsNotice ?? ''}
      ${d.sessionsBody ?? `<ul class="px-2 space-y-0.5">
        ${d.sessions.map((s, i) => `
          <li class="rounded-md px-2 py-1.5 ${i === 2 ? 'bg-muted' : ''}">
            <div class="flex items-center justify-between text-sm text-foreground">
              <span class="truncate">${s.title}</span>
              ${s.live ? '<span class="text-[10px] uppercase font-medium text-accent-foreground bg-accent rounded px-1">Live</span>' : `<span class="text-xs text-muted-foreground">${s.when}</span>`}
            </div>
            ${i === 2 ? '<div class="mt-1 flex justify-end"><button class="text-xs text-foreground border border-border rounded px-1.5">Resume</button></div>' : ''}
          </li>`).join('')}
      </ul>`}
    </aside>`;

  const pane = (p, i) => `
    <section class="flex flex-col min-h-0 min-w-0 rounded-lg border ${opts.glow ? (p.status === 'Idle' ? 'border-border' : tone[p.status].ring) : i === 0 ? 'border-ring' : 'border-border'} ${opts.glow && p.status === 'Needs Approval' ? 'border-2' : ''} bg-background overflow-hidden">
      <header class="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card">
        <span class="min-w-0 text-xs text-foreground truncate"><span class="text-muted-foreground">${p.ws} ·</span> ${p.title}</span>
        <span class="flex shrink-0 items-center gap-2 text-xs whitespace-nowrap">
          ${p.badge ? `<span class="border border-border rounded-md px-1.5 text-muted-foreground">${p.badge}</span>` : `<span class="flex items-center gap-1 border rounded-md px-1.5 ${tone[p.status].chip}">${marker(p.status)}${p.status}</span>`}
          <span class="text-muted-foreground">⇥ ⇣ ✕</span>
        </span>
      </header>
      <pre class="flex-1 p-3 font-mono text-xs leading-5 text-foreground overflow-hidden">${p.lines.join('\n')}</pre>
      ${p.footer ?? ''}
    </section>`;

  const card = (c, s) => `
    <article class="rounded-md border border-border border-l-4 ${tone[s].edge} ${opts.float ? 'bg-background' : 'bg-card'} px-2.5 py-2">
      <div class="text-sm text-foreground truncate">${c.title}</div>
      <div class="text-xs text-muted-foreground truncate">${c.ws} · ${c.since} · <span class="${tone[s].chip.split(' ')[1]}">${c.reason}</span></div>
    </article>`;

  const board = `
    <aside class="${panel} overflow-auto p-3 space-y-4 ${opts.float ? '' : 'border-l border-border'}">
      <div class="text-sm font-medium text-foreground">Status Board</div>
      ${statusOrder.map((s) => `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-medium uppercase tracking-wide">
            <span class="flex items-center gap-1.5 ${tone[s].chip.split(' ')[1]}">${marker(s)}${s}</span>
            <span class="text-muted-foreground">${d.cards[s].length}</span>
          </div>
          ${d.cards[s].length ? d.cards[s].map((c) => card(c, s)).join('') : '<div class="rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">Nothing here</div>'}
        </div>`).join('')}
    </aside>`;

  const titleBar = opts.float
    ? `<div class="flex justify-center pt-2"><div class="flex items-center gap-6 rounded-full border border-border bg-card px-4 py-1">
         <span class="text-sm font-medium text-foreground">agent-deck</span>
         <button class="text-xs text-muted-foreground">Status Latency</button></div></div>`
    : `<div class="h-9 flex items-center justify-between px-4 border-b border-border bg-card">
         <span class="text-sm font-medium text-foreground">agent-deck</span>
         <button class="text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5">Status Latency</button></div>`;

  return `
    <div class="${opts.theme} h-screen relative">
      <div class="h-full flex flex-col bg-background font-sans">
        ${titleBar}
        <div class="flex-1 min-h-0 grid grid-cols-[240px_1fr_280px] ${opts.float ? 'gap-2 p-2' : ''}">
          ${sidebar}
          ${d.mainBody ?? `<main class="min-h-0 grid ${d.grid ?? 'grid-cols-2 grid-rows-2'} gap-2 ${opts.float ? '' : 'p-2'}">${d.panes.map(pane).join('')}</main>`}
          ${board}
        </div>
      </div>
      ${d.overlay ?? ''}
    </div>`;
};

