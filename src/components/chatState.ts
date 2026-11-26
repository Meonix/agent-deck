export type ChatItem =
  | { kind: "prompt"; key: string; text: string }
  | { kind: "reply"; key: string; text: string }
  | { kind: "tool"; key: string; id: string; name: string; arg: string | null }
  | { kind: "result"; key: string; toolId: string; text: string; isError: boolean };

export type ToolResult = { text: string; isError: boolean };

export type ChatEntry =
  | { kind: "prompt"; key: string; text: string }
  | { kind: "reply"; key: string; text: string }
  | { kind: "tool"; key: string; id: string; name: string; arg: string | null; result: ToolResult | null };

export type ChatMessage = { reset?: true; items?: ChatItem[]; unreadable?: true };

export type ChatState = { loading: boolean; unreadable: boolean; items: ChatEntry[] };

export type Activity = {
  tool: string | null;
  arg: string | null;
  context: number | null;
  shells: number;
  subagents: number;
};

export const initialChat: ChatState = { loading: true, unreadable: false, items: [] };

type Held = Map<string, { key: string; result: ToolResult }>;

// Results whose tool has not arrived yet; a side table keeps ChatState to its three fields.
const held = new WeakMap<ChatState, Held>();

export function applyChat(state: ChatState, message: ChatMessage): ChatState {
  if (message.unreadable) return { ...state, loading: false, unreadable: true };
  const base: ChatState = message.reset ? { loading: false, unreadable: false, items: [] } : state;
  const items = [...base.items];
  const orphans: Held = new Map(message.reset ? [] : held.get(state));
  const keys = new Set(items.map((i) => i.key));
  for (const o of orphans.values()) keys.add(o.key);
  for (const item of message.items ?? []) {
    if (keys.has(item.key)) continue;
    keys.add(item.key);
    if (item.kind === "result") {
      const result = { text: item.text, isError: item.isError };
      const at = items.findIndex((i) => i.kind === "tool" && i.id === item.toolId);
      if (at >= 0) items[at] = { ...(items[at] as Extract<ChatEntry, { kind: "tool" }>), result };
      else orphans.set(item.toolId, { key: item.key, result });
    } else if (item.kind === "tool") {
      const orphan = orphans.get(item.id);
      orphans.delete(item.id);
      items.push({ ...item, result: orphan?.result ?? null });
    } else {
      items.push(item);
    }
  }
  const next = { ...base, items };
  held.set(next, orphans);
  return next;
}

export function activityText(activity: Activity): string {
  const parts: string[] = [];
  if (activity.tool) parts.push(activity.arg ? `${activity.tool} ${activity.arg}` : activity.tool);
  if (activity.context !== null) parts.push(`${activity.context}% context`);
  if (activity.shells > 0) parts.push(`${activity.shells} shell`);
  if (activity.subagents > 0) parts.push(`${activity.subagents} subagent`);
  return parts.join(" · ");
}
