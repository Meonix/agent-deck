## Context

The repository holds only business documents (`product/agent-deck/`), the UI design (`design/agent-deck/`)
and OpenSpec. There is no application code yet. The stack was settled in the brainstorm (v1) and at GATE 1
of this change: Tauri 2 with a Rust core and a React/TypeScript UI. The dev machine (macOS 26) has Node 26
and npm, no Rust toolchain, no `pnpm`, no `gh`.

UI source of truth: `design/agent-deck/` — `brief.md`, `tokens.css`, `tailwind.preset.js` and the Storybook
stories `Design/agent-deck/Proposal/P4DarkAttention` and `Design/agent-deck/States`. This change builds the
Folders section of the left sidebar (layout B) and the `EmptyNoFolders` main-area state. Tokens and layout
are taken from there, not copied into this document.

## Goals / Non-Goals

**Goals:**

- A Tauri 2 app that starts on macOS 14+ and shows the Workspace List.
- Workspace rules (SRS-FR-001 to SRS-FR-006) live in Rust, where later items (session history, panes,
  status hooks) will need them.
- Every scenario in `specs/` is covered by an automated test at an agreed seam, or by the demo script when
  the requirement's verification method is Demo.

**Non-Goals:**

- Windows 11 build and check (part of SRS-NFR-004) — deferred by the PO on 2026-10-16. The Windows
  scenario of `app-shell` stays unchecked in this change.
- Session list, panes, Status Board, Status Latency — later backlog items.
- Remembering which workspace was selected across restarts — the SRS does not ask for it; raise through
  `/ba-change` if wanted.
- Renaming a workspace or reordering the list by hand — not in the SRS.
- What happens when the Workspace List file is corrupt — the SRS is silent; this change starts with an
  empty list and keeps the corrupt file aside as `workspaces.json.bak` so no data is silently lost. A
  business decision belongs in `/ba-change`.
- Installer, signing, auto-update — out of scope in the BRD.

## Decisions

**D1 — Workspace rules in a plain Rust module, not in Tauri commands.**
`src-tauri/src/workspace/` holds `WorkspaceList` (ordered entries, de-duplication by canonical path,
removal) with no Tauri types. Two small traits keep it testable without the OS:
`FolderProbe` (does this path exist?) and `OpenPanes` (does this workspace have an open pane?).
Alternative: logic inside `#[tauri::command]` functions — rejected, it can only be tested by running the app.

**D2 — `OpenPanes` returns "no panes" in this change.**
No pane exists before backlog item 2. The real registry arrives with `add-session-pane`; here a
`NoPanes` implementation is wired in, and SRS-FR-006 is proven with a fake that reports open panes.

**D3 — Persistence is one JSON file in the app data directory.**
`<app_data_dir>/workspaces.json`, written atomically (write temp file, then rename). It stores only the
ordered paths; display name and `Missing` are derived on load. Alternatives: `tauri-plugin-store` (puts the
rule-owning data in a JS-facing store), SQLite (heavy for a short list; revisit for Status Change Records in
backlog item 4).

**D4 — Duplicate check on the canonical path.**
`std::fs::canonicalize` before comparing, so `/Users/x/proj/` and `/Users/x/proj` are one entry. If the
folder cannot be canonicalised (already missing), compare the path as stored.

**D5 — UI talks to Rust through one typed client.**
`src/api/workspaces.ts` wraps `invoke` (`list_workspaces`, `add_workspace`, `remove_workspace`) and the
dialog plugin's folder picker. Components receive this client as a prop/context, so Vitest tests pass a fake.

**D6 — Styling from the design folder.**
Tailwind v4 with `@import` of `design/agent-deck/tokens.css` and `@config` of `tailwind.preset.js`; the app
root carries the `dark` class when the OS is in dark mode. No colour or token is redefined in `src/`.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 `WorkspaceList` (Rust) | `add(path) -> AddOutcome { Added(id) \| AlreadyPresent(id) }`, `remove(id, &dyn OpenPanes) -> Result<(), RemoveError>`, `entries(&dyn FolderProbe) -> Vec<WorkspaceView>` | SRS-FR-001 (added entry), SRS-FR-003, SRS-FR-004 (entry gone), SRS-FR-005, SRS-FR-006 | `cargo test`, fake `FolderProbe` and `OpenPanes` |
| S2 `WorkspaceStore` (Rust) | `load(dir) -> WorkspaceList`, `save(dir, &WorkspaceList)` | SRS-FR-002 (order kept), SRS-FR-004 (folder and its files untouched after remove + save) | `cargo test` on a temp directory |
| S3 `WorkspaceSidebar` (React) | component taking a `WorkspacesClient` | SRS-FR-001 (Cancel leaves list unchanged), SRS-FR-003 (existing entry becomes selected), SRS-FR-005 (`Missing` label), SRS-FR-006 (message shown), SRS-NFR-008 (English labels) | Vitest + Testing Library, fake client |
| — Tauri command glue | `list_workspaces`, `add_workspace`, `remove_workspace` | none on its own | not unit-tested; covered by the macOS demo |
| — Whole app on macOS | installed `.app` | SRS-NFR-004 (macOS scenario) | demo script, 6 scenarios of `workspace-list` |

## Risks / Trade-offs

- [Windows not checked] → Windows-only bugs (paths with `\`, ConPTY later) surface late. Mitigation: paths
  handled through `std::path`, never string-split; the deferral is recorded in the proposal and backlog stays
  honest.
- [Rust toolchain missing on the dev machine] → install via rustup before task 1; ask the user first.
- [`canonicalize` on macOS resolves `/private/var` vs `/var`] → compare canonical forms on both sides only.
- [Corrupt JSON on start] → fall back to empty list, keep `.bak`; see Non-Goals.

## Open Questions

None blocking. Windows verification path to be chosen when the PO lifts the deferral.
