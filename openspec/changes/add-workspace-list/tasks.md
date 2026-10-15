## 1. Setup

- [x] 1.1 Install the Rust toolchain with rustup (after the user agrees) and confirm `cargo --version`
- [x] 1.2 Scaffold the Tauri 2 app at the repo root (`src/` React + TypeScript + Vite, `src-tauri/`), add `tauri-plugin-dialog`, confirm `npm run tauri dev` opens a window on macOS
- [x] 1.3 Wire Tailwind v4 to `design/agent-deck/tokens.css` and `tailwind.preset.js`; add Vitest + Testing Library; confirm `cargo test` and `npm test` both run (zero tests)

## 2. Workspace rules in Rust (seam S1)

- [x] 2.1 `WorkspaceList::add` adds a new entry named after the folder (SRS-FR-001) — RED → GREEN → REFACTOR
- [x] 2.2 `add` of an existing canonical path returns `AlreadyPresent` with the existing id and adds nothing (SRS-FR-003)
- [x] 2.3 `entries` marks an entry `Missing` when `FolderProbe` says the folder is gone (SRS-FR-005)
- [x] 2.4 `remove` deletes the entry when `OpenPanes` reports none, and returns `RemoveError::HasOpenPanes` otherwise (SRS-FR-004, SRS-FR-006)

## 3. Persistence (seam S2)

- [x] 3.1 `WorkspaceStore::save` + `load` round-trip keeps entries and order (SRS-FR-002), atomic write
- [x] 3.2 Remove + save leaves the workspace folder and every file in it untouched (SRS-FR-004)
- [x] 3.3 Corrupt `workspaces.json` loads as an empty list and is kept as `workspaces.json.bak`

## 4. Tauri commands

- [x] 4.1 `list_workspaces`, `add_workspace`, `remove_workspace` commands over a shared `WorkspaceList` + `WorkspaceStore` in the app data dir, `NoPanes` as the `OpenPanes` implementation; typed client `src/api/workspaces.ts`

## 5. UI (seam S3)

- [ ] 5.1 `WorkspaceSidebar` lists entries, highlights the selected one, shows `Missing` (SRS-FR-005) — styled per `design/agent-deck` P4
- [ ] 5.2 "+ Add Folder" opens the picker; Cancel leaves the list unchanged (SRS-FR-001); a duplicate selects the existing entry (SRS-FR-003)
- [ ] 5.3 Remove action; blocked removal shows "Close the open sessions of this folder first" (SRS-FR-006)
- [ ] 5.4 Main-area empty state "No folders yet" per story `States/EmptyNoFolders`; all labels English (SRS-NFR-008)

## 6. Verification

- [ ] 6.1 Run `cargo test`, `npm test`, `npm run build`, `npm run tauri build` on macOS and paste the output
- [ ] 6.2 macOS demo: walk the 6 `workspace-list` scenarios in the built `.app` (SRS-NFR-004 macOS scenario)
- [ ] 6.3 Windows 11 demo — deferred by the PO on 2026-10-16; leave unchecked and say so in the report
