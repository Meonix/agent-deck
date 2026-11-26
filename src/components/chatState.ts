import { labels } from "../labels";

export type ChatItem =
  | { kind: "prompt"; key: string; text: string }
  | { kind: "reply"; key: string; text: string }
  | { kind: "tool"; key: string; id: string; name: string; arg: string | null; detail?: ToolDetail }
  | { kind: "result"; key: string; toolId: string; text: string; isError: boolean };

export type ToolDetail =
  | { question: { text: string; multiSelect: boolean; count: number; options: string[] } }
  | { plan: string };

export type ToolResult = { text: string; isError: boolean };

export type ChatEntry =
  | { kind: "prompt"; key: string; text: string }
  | { kind: "reply"; key: string; text: string }
  | { kind: "tool"; key: string; id: string; name: string; arg: string | null; detail?: ToolDetail; result: ToolResult | null };

export type ChatMessage = { reset?: true; items?: ChatItem[]; unreadable?: true };

export type ChatState = { loading: boolean; unreadable: boolean; items: ChatEntry[];
  /** Results whose tool has not arrived yet, by tool id. */
  held: Record<string, { key: string; result: ToolResult }>;
};

export type Activity = {
  tool: string | null;
  arg: string | null;
  context: number | null;
  shells: number;
  subagents: number;
};

export const initialChat: ChatState = { loading: true, unreadable: false, items: [], held: {} };

export function applyChat(state: ChatState, message: ChatMessage): ChatState {
  if (message.unreadable) return { ...state, loading: false, unreadable: true };
  const base: ChatState = message.reset ? { loading: false, unreadable: false, items: [], held: {} } : state;
  const items = [...base.items];
  const held = { ...base.held };
  const keys = new Set(items.map((i) => i.key));
  for (const o of Object.values(held)) keys.add(o.key);
  for (const item of message.items ?? []) {
    if (keys.has(item.key)) continue;
    keys.add(item.key);
    if (item.kind === "result") {
      const result = { text: item.text, isError: item.isError };
      const at = items.findIndex((i) => i.kind === "tool" && i.id === item.toolId);
      if (at >= 0) items[at] = { ...(items[at] as Extract<ChatEntry, { kind: "tool" }>), result };
      else held[item.toolId] = { key: item.key, result };
    } else if (item.kind === "tool") {
      items.push({ ...item, result: held[item.id]?.result ?? null });
      delete held[item.id];
    } else {
      items.push(item);
    }
  }
  return { ...base, items, held };
}

/** The Activity Bar's count parts in order; unknown context and zero counts are left out. */
export function activityParts(activity: Activity): string[] {
  const parts: string[] = [];
  if (activity.context !== null) parts.push(labels.activity.context(activity.context));
  if (activity.shells > 0) parts.push(labels.activity.shells(activity.shells));
  if (activity.subagents > 0) parts.push(labels.activity.subagents(activity.subagents));
  return parts;
}
