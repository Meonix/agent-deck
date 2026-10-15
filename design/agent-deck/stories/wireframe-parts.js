// Grey-only building blocks shared by the three wireframe layouts.

export const workspaces = [
  { name: 'agent-deck', live: 2, selected: true },
  { name: 'mokairo', live: 1 },
  { name: 'k3s-infra', live: 0 },
  { name: 'old-landing', live: 0, missing: true },
];

export const sessions = [
  { title: 'Scaffold Tauri app', when: '2 min ago', live: true },
  { title: 'Research PTY crates', when: '1 h ago', live: true },
  { title: 'Write BRD and SRS', when: 'Yesterday' },
  { title: 'Init repo', when: '3 days ago' },
  { title: '(untitled)', when: 'Last week' },
];

export const panes = [
  { ws: 'agent-deck', title: 'Scaffold Tauri app', status: 'Needs Approval', lines: ['Do you want to edit src/main.rs?', '❯ 1. Yes', '  2. Yes, and don’t ask again', '  3. No'] },
  { ws: 'mokairo', title: 'Fix login redirect', status: 'Running', lines: ['✻ Running Bash(npm test)…', '  ⎿ 42 passed, 1 failed', '✻ Reading src/auth/login.ts'] },
  { ws: 'agent-deck', title: 'Research PTY crates', status: 'Error', lines: ['API Error: 529 overloaded', '', '>'] },
  { ws: 'mokairo', title: 'Refactor API client', status: 'Idle', lines: ['Done. 3 files changed.', '', '>'] },
];

export const cards = {
  'Needs Approval': [{ ws: 'agent-deck', title: 'Scaffold Tauri app', since: '14:02', reason: 'Edit src/main.rs' }],
  Running: [{ ws: 'mokairo', title: 'Fix login redirect', since: '13:58', reason: 'Bash npm test' }],
  Error: [{ ws: 'agent-deck', title: 'Research PTY crates', since: '13:40', reason: 'overloaded' }],
};

export const statusOrder = ['Needs Approval', 'Error', 'Running'];

export const workspaceList = () => `
  <div class="px-3 pt-3 pb-1 flex items-center justify-between">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">Folders</span>
    <button class="text-xs text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">+ Add Folder</button>
  </div>
  <ul class="px-2 space-y-0.5">
    ${workspaces.map((w) => `
      <li ${w.selected ? 'class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm bg-slate-200 text-slate-900"' : 'class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-700"'}>
        <span ${w.missing ? 'class="line-through text-slate-400"' : ''}>${w.name}</span>
        <span class="text-xs text-slate-500">${w.missing ? 'Missing' : w.live ? `● ${w.live}` : ''}</span>
      </li>`).join('')}
  </ul>`;

export const sessionList = () => `
  <div class="px-3 pt-4 pb-1 flex items-center justify-between">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">Sessions · agent-deck</span>
    <button class="text-xs text-white bg-slate-700 rounded-md px-2 py-0.5">New Session</button>
  </div>
  <ul class="px-2 space-y-0.5">
    ${sessions.map((s, i) => `
      <li ${i === 2 ? 'class="rounded-md px-2 py-1.5 bg-slate-100"' : 'class="rounded-md px-2 py-1.5"'}>
        <div class="flex items-center justify-between text-sm text-slate-800">
          <span class="truncate">${s.title}</span>
          ${s.live ? '<span class="text-[10px] uppercase border border-slate-400 text-slate-600 rounded px-1">Live</span>' : ''}
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>${s.when}</span>
          ${i === 2 ? '<button class="text-xs border border-slate-400 rounded px-1.5">Resume</button>' : ''}
        </div>
      </li>`).join('')}
  </ul>`;

export const pane = (p, focused = false) => `
  <section ${focused ? 'class="flex flex-col min-h-0 min-w-0 rounded-lg border border-slate-500 bg-white overflow-hidden"' : 'class="flex flex-col min-h-0 min-w-0 rounded-lg border border-slate-300 bg-white overflow-hidden"'}>
    <header class="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50">
      <span class="text-xs text-slate-700 truncate">${p.ws} · ${p.title}</span>
      <span class="flex items-center gap-2 text-xs text-slate-500">
        <span class="border border-slate-300 rounded px-1">${p.status}</span>
        <span>⇥ ⇣ ✕</span>
      </span>
    </header>
    <pre class="flex-1 p-3 font-mono text-xs leading-5 text-slate-700 bg-slate-100 overflow-hidden">${p.lines.join('\n')}</pre>
  </section>`;

export const card = (c, status) => `
  <article ${status === 'Needs Approval' ? 'class="rounded-md border border-slate-300 bg-white px-2.5 py-2 border-l-4 border-l-slate-800"' : status === 'Error' ? 'class="rounded-md border border-slate-300 bg-white px-2.5 py-2 border-l-4 border-l-slate-600"' : 'class="rounded-md border border-slate-300 bg-white px-2.5 py-2 border-l-4 border-l-slate-400"'}>
    <div class="text-sm text-slate-800 truncate">${c.title}</div>
    <div class="text-xs text-slate-500 truncate">${c.ws} · ${c.since} · ${c.reason}</div>
  </article>`;

export const column = (status) => `
  <div class="flex flex-col gap-1.5 min-w-0">
    <div class="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
      <span>${status}</span><span>${cards[status].length}</span>
    </div>
    ${cards[status].map((c) => card(c, status)).join('')}
  </div>`;
