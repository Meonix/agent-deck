import type { CommandItem, FileEntry } from "../api/sessions";

export type Trigger = { kind: "command" | "file"; query: string; start: number; end: number };

const isSpace = (c: string) => c === " " || c === "\t" || c === "\n";

export function trigger(text: string, caret: number): Trigger | null {
  let start = caret;
  while (start > 0 && !isSpace(text[start - 1])) start--;
  if (start >= caret) return null;
  if (start === 0 && text[0] === "/") {
    return { kind: "command", query: text.slice(1, caret), start, end: caret };
  }
  if (text[start] === "@") {
    return { kind: "file", query: text.slice(start + 1, caret), start, end: caret };
  }
  return null;
}

const b = (name: string, description: string): CommandItem => ({ name, description, source: "builtin" });

// Measured from Claude Code 2.1.332; live state in descriptions (current model, mode) is cut.
export const BUILTIN_COMMANDS: readonly CommandItem[] = [
  b("add-dir", "Add a working directory"),
  b("advisor", "Let Claude consult a stronger model at key moments"),
  b("artifact-capabilities", "Runtime capabilities for published Artifacts"),
  b("artifact-diagramming", "Diagramming guidance for Artifacts"),
  b("artifacts", "Browse your published and shared artifacts"),
  b("auto-mode-setup", "Teach auto mode about your environment"),
  b("autocompact", "Set how full the context gets before auto-summarizing"),
  b("autofix-pr", "Monitor and autofix any issues with the current PR"),
  b("background", "Send this session to the background and free the terminal"),
  b("batch", "Plan a large change; background agents each open a PR"),
  b("branch", "Create a branch of the current conversation at this point"),
  b("btw", "Ask a side question without interrupting Claude"),
  b("bug", "Report a bug or share your session"),
  b("cd", "Move this session to a new working directory"),
  b("chrome", "Open Claude in Chrome settings"),
  b("claude-api", "Build and debug apps that use the Claude API"),
  b("claude-approvals", "Edit, explain, or tune a Claude Approvals policy file or classifier"),
  b("claude-in-chrome", "Let Claude browse and interact with pages in your Chrome"),
  b("clear", "Start a new session with empty context; loops carry over, and the old one stays in /resume"),
  b("code-review", "Review the current diff or a PR for bugs"),
  b("color", "Set the prompt bar color for this session"),
  b("compact", "Free up context by summarizing the conversation so far"),
  b("config", "Open settings"),
  b("context", "Show what fills the context"),
  b("copy", "Copy the last response to clipboard (/copy 2 for the one before)"),
  b("dataviz", "Chart and dashboard design guidance"),
  b("debug", "Turn on debug logging and investigate problems"),
  b("design", "Make a new Design artifact from a brief"),
  b("design-login", "Authorize design-system access for /design-sync with your claude.ai account"),
  b("design-sync", "Sync your design system to Claude Design"),
  b("desktop", "Continue the current session in Claude Desktop"),
  b("diff", "Toggle the diff panel showing uncommitted changes"),
  b("doctor", "Health-check your setup and fix issues: installation, unused extensions, duplicated or bloated memory files"),
  b("effort", "Set the model's effort level"),
  b("exit", "Exit the CLI"),
  b("export", "Export this session to a file or clipboard"),
  b("fast", "Toggle fast mode"),
  b("feedback", "Send feedback to Anthropic or report a bug"),
  b("fewer-permission-prompts", "Pre-approve safe read-only commands based on your usage"),
  b("focus", "Toggle focus view: just your prompt, summary, and response"),
  b("fork", "Copy this conversation into a new background session and keep working here"),
  b("goal", "Set a goal Claude checks before stopping"),
  b("help", "Show help and available commands"),
  b("hooks", "View hook configurations for tool events"),
  b("ide", "Manage IDE integrations and show status"),
  b("import", "Import config from another AI coding agent"),
  b("init", "Initialize a new CLAUDE.md file with codebase documentation"),
  b("insights", "Generate a report analyzing your Claude Code sessions"),
  b("install-github-app", "Set up Claude GitHub Actions for a repository"),
  b("install-slack-app", "Install the Claude Slack app"),
  b("keybindings", "Open your keyboard shortcuts file"),
  b("list-agents", "List subagents, teammates, and other Claude sessions you can message"),
  b("login", "Sign in with your Anthropic account"),
  b("logout", "Sign out from your Anthropic account"),
  b("loop", "Repeat a prompt or command on an interval (e.g. /loop 5m /foo)"),
  b("mcp", "Manage MCP servers"),
  b("memory", "Edit CLAUDE.md files and memory settings"),
  b("mobile", "Show QR code to download the Claude mobile app"),
  b("model", "Switch model"),
  b("output-style", "List output styles or switch to one"),
  b("passes", "Share a free week of Claude Code with friends and earn usage credits"),
  b("permissions", "Manage allow and deny tool permission rules"),
  b("plan", "Turn on plan mode or view the plan"),
  b("plugin", "Manage Claude Code plugins"),
  b("plugin-authoring", "Write a mod: a live pane, view or behaviour change in Claude Code"),
  b("powerup", "Learn Claude Code features in short lessons"),
  b("privacy-settings", "View and update your privacy settings"),
  b("radio", "Listen to Claude FM lo-fi radio"),
  b("rate-limit-options", "Manage usage limits and upgrade options"),
  b("recap", "Generate a one-line session recap now"),
  b("release-notes", "View release notes"),
  b("reload-plugins", "Activate pending plugin changes in the current session"),
  b("reload-skills", "Pick up skills added or changed on disk during this session"),
  b("remote-control", "Control this session from your phone or claude.ai/code"),
  b("remote-env", "Choose the default environment for cloud agents"),
  b("rename", "Rename the current conversation"),
  b("restart", "Restart Claude Code and keep this session"),
  b("resume", "Resume a previous session"),
  b("rewind", "Restore earlier code, conversation, or both"),
  b("run", "Launch this project’s app to see your change working"),
  b("run-skill-generator", "Create a skill that knows how to run this project’s app"),
  b("sandbox", "Configure the sandbox"),
  b("schedule", "Create and manage scheduled tasks that run in the cloud"),
  b("security-review", "Complete a security review of the pending changes on the current branch"),
  b("send-to-project", "Send this session's work to a Claude Project"),
  b("ship", "Open a pull request if there is none, review it here, then watch it"),
  b("simplify", "Clean up the changed code without changing behavior"),
  b("skill-doctor", "Show which loaded skills are unused and costing context"),
  b("skills", "List available skills"),
  b("slides", "Make a new Slides deck artifact from a brief"),
  b("status", "Show version, account, model, MCP servers, and setup warnings"),
  b("statusline", "Set up the status line"),
  b("steward", "Watch your open pull request in this session and fix what comes up"),
  b("stickers", "Check Claude Code sticker availability"),
  b("subtask", "Send a subagent off with your full context; its result comes back here"),
  b("tasks", "View and manage this session's background work"),
  b("team-onboarding", "Help teammates ramp on Claude Code with a guide from your usage"),
  b("teleport", "Resume a cloud session here"),
  b("terminal-setup", "Turn on iTerm2 clipboard access for /copy"),
  b("theme", "Change the theme"),
  b("tui", "Set the terminal UI renderer (classic | fullscreen)"),
  b("ultrareview", "Start a cloud agent that finds and verifies bugs in your branch"),
  b("update-config", "Change settings: hooks, permissions, environment variables"),
  b("upgrade", "Upgrade your plan for higher rate limits and more Opus"),
  b("usage", "Show session cost, plan usage, and activity stats"),
  b("usage-credits", "Configure usage credits or request them from your admin when you hit a limit"),
  b("verify", "Try your change and report if it works"),
  b("voice", "Toggle voice mode"),
  b("web-setup", "Set up cloud sessions with your GitHub account"),
  b("whiteboard", "Make a new Whiteboard artifact from a brief"),
  b("workflow-authoring", "Load the reference for writing Workflow tool scripts"),
  b("workflows", "Browse running and completed workflows"),
];

export function mergeCommands(builtin: readonly CommandItem[], fetched: readonly CommandItem[]): CommandItem[] {
  const seen = new Set<string>();
  const out: CommandItem[] = [];
  for (const item of [...builtin, ...fetched]) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}

const byLowerName = (a: CommandItem, b: CommandItem) => {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

export function matchCommands(items: readonly CommandItem[], query: string): CommandItem[] {
  const q = query.toLowerCase();
  const a: CommandItem[] = [];
  const bGroup: CommandItem[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    if (name.startsWith(q)) a.push(item);
    else if (name.slice(name.lastIndexOf(":") + 1).startsWith(q)) bGroup.push(item);
  }
  return [...a.sort(byLowerName), ...bGroup.sort(byLowerName)];
}

export const FILE_ROWS = 8;

export function matchFiles(entries: readonly FileEntry[], query: string): FileEntry[] {
  const q = query.toLowerCase();
  const ranked: { entry: FileEntry; rank: number }[] = [];
  for (const entry of entries) {
    const path = entry.path.toLowerCase();
    if (!path.includes(q) || path === q) continue;
    const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
    const name = trimmed.slice(trimmed.lastIndexOf("/") + 1);
    ranked.push({ entry, rank: name.startsWith(q) ? 0 : path.startsWith(q) ? 1 : 2 });
  }
  ranked.sort(
    (x, y) =>
      x.rank - y.rank ||
      x.entry.path.length - y.entry.path.length ||
      (x.entry.path < y.entry.path ? -1 : x.entry.path > y.entry.path ? 1 : 0),
  );
  return ranked.slice(0, FILE_ROWS).map((r) => r.entry);
}

export type Choice = { kind: "command"; name: string } | { kind: "file"; entry: FileEntry };

export function apply(text: string, t: Trigger, choice: Choice): { text: string; caret: number } {
  let wordEnd = t.end;
  while (wordEnd < text.length && !isSpace(text[wordEnd])) wordEnd++;
  const rest = text.slice(wordEnd);
  const inserted = choice.kind === "command" ? "/" + choice.name : "@" + choice.entry.path;
  const folder = choice.kind === "file" && choice.entry.dir;
  const restStartsSpace = rest.length > 0 && isSpace(rest[0]);
  const space = folder || restStartsSpace ? "" : " ";
  const head = text.slice(0, t.start) + inserted + space;
  return { text: head + rest, caret: head.length + (restStartsSpace && !folder ? 1 : 0) };
}
