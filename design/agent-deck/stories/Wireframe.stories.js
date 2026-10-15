import { workspaceList, sessionList, pane, panes, column, statusOrder, cards } from './wireframe-parts.js';

export default { title: 'Design/agent-deck/Wireframe' };

const titleBar = () => `
  <div class="h-9 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
    <span class="text-sm font-medium text-slate-800">agent-deck</span>
    <button class="text-xs text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">Status Latency</button>
  </div>`;

const paneGrid = () => `
  <div class="grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0 h-full">
    ${panes.map((p, i) => pane(p, i === 0)).join('')}
  </div>`;

const frame = (body) => `
  <div class="h-screen flex flex-col bg-slate-50 font-sans">
    ${titleBar()}
    <div class="flex-1 min-h-0">${body}</div>
  </div>`;

/** A — Board dưới: sidebar trái, lưới ô ở giữa, Status Board ba cột nằm ngang dưới đáy. */
export const A = () => frame(`
  <div class="h-full grid grid-cols-[260px_1fr]">
    <aside class="border-r border-slate-200 bg-white overflow-auto">${workspaceList()}${sessionList()}</aside>
    <main class="min-h-0 grid grid-rows-[1fr_auto]">
      ${paneGrid()}
      <section class="border-t border-slate-200 bg-white px-3 py-2">
        <div class="grid grid-cols-3 gap-3">
          ${['Running', 'Needs Approval', 'Error'].map((s) => column(s)).join('')}
        </div>
      </section>
    </main>
  </div>`);

/** B — Board bên phải: sidebar trái, lưới ô ở giữa, Status Board xếp dọc ở cột phải, Needs Approval trên cùng. */
export const B = () => frame(`
  <div class="h-full grid grid-cols-[240px_1fr_280px]">
    <aside class="border-r border-slate-200 bg-white overflow-auto">${workspaceList()}${sessionList()}</aside>
    <main class="min-h-0">${paneGrid()}</main>
    <aside class="border-l border-slate-200 bg-white overflow-auto p-3 space-y-4">
      <div class="text-sm font-medium text-slate-800">Status Board</div>
      ${statusOrder.map((s) => column(s)).join('')}
    </aside>
  </div>`);

/** C — Hộp thư trong sidebar: một sidebar trái, trên cùng là ba nhóm trạng thái kiểu inbox, dưới là folder và phiên; lưới ô chiếm phần còn lại. */
export const C = () => frame(`
  <div class="h-full grid grid-cols-[300px_1fr]">
    <aside class="border-r border-slate-200 bg-white overflow-auto">
      <div class="px-3 pt-3 pb-2 border-b border-slate-200 space-y-3">
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">Status Board</div>
        ${statusOrder.map((s) => `
          <div>
            <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span class="font-medium">${s}</span><span>${cards[s].length}</span>
            </div>
            ${cards[s].map((c) => `
              <div ${s === 'Needs Approval' ? 'class="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-800 bg-slate-200"' : 'class="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-800 bg-slate-100"'}>
                <span class="truncate">${c.title}</span>
                <span class="text-xs text-slate-500">${c.since}</span>
              </div>`).join('')}
          </div>`).join('')}
      </div>
      ${workspaceList()}${sessionList()}
    </aside>
    <main class="min-h-0">${paneGrid()}</main>
  </div>`);

/** Status Latency — màn báo cáo BO-01, dùng chung cho cả ba bố cục. */
export const StatusLatency = () => frame(`
  <div class="h-full flex items-start justify-center p-8">
    <section class="w-full max-w-xl rounded-lg border border-slate-300 bg-white p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-medium text-slate-900">Status Latency</h1>
        <span class="text-xs text-slate-500">Last 14 days</span>
      </div>
      <div>
        <div class="text-4xl font-semibold text-slate-900">99.5%</div>
        <div class="text-sm text-slate-600">398 of 400 state changes appeared within 3 s</div>
      </div>
    </section>
  </div>`);
