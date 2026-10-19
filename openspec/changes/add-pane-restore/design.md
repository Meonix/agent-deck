## Context

`useSessionPanes` holds `{ entries, layout, focusedId, maximizedId }`. `openPane(workspace, target, resumed?)`
measures the new pane, calls `client.open(workspaceId, cols, rows, resumedId?)`, builds a `PaneEntry`, inserts it
with `splitPane(..., "right")`, then wires output, status and exit. The layout is a binary tree of pane ids with a
ratio per split (`paneTree.ts`). A new session is started with `--session-id`, so its history file only exists
once the user has sent a prompt; a resumed one already has it. The Text Size is kept in `localStorage`
(`useTextZoom.ts`). On quit, Rust kills every session (`close_all_on_exit`). The folder list loads asynchronously
(`useWorkspaces`), and each `Workspace` carries `missing`. Requirements: SRS v1.5, CR-005; approach A chosen at
GATE 1.

## Goals / Non-Goals

**Goals:**

- Keep the open panes and their layout across launches (SRS-FR-084).
- Reopen them at launch in the same places and sizes (SRS-FR-085).
- Leave out and report the ones that cannot be resumed (SRS-FR-086).

**Non-Goals:**

- Maximized state, Pane Shell, terminal scrollback (CR-005 out of scope).
- Which pane has keyboard focus after the restore — the SRS does not say; the last reopened pane gets it, as a
  resumed pane does today.
- Keeping panes when the app is killed — not promised by the SRS; the continuous write below happens to cover it.

## Decisions

- **Snapshot written on every change, not at quit.** An effect on `{ layout, entries }` writes the snapshot to
  `localStorage` key `adOpenPanes`. At quit the webview goes away while Rust kills the sessions, so nothing written
  after that can be trusted; the last write before quit is the state the user saw. Writes are skipped until the
  launch restore has run, so an empty first render never wipes the saved panes.
- **What is remembered.** An entry is remembered when it is started, not ended, and `prompted`. `prompted` is set
  when the pane was resumed, when its status is ever `Running` or `Needs Approval` (a prompt was sent), or when its
  title is no longer "(untitled)". The tree is pruned with `removePane` for every pane not remembered, so ratios of
  the remaining splits are kept as they are.
- **Snapshot shape.** `{ version: 1, layout: Layout, panes: { [paneId]: { workspaceId, sessionId, title } } }`.
  An unreadable or unknown-version value is treated as no snapshot.
- **Pure module `paneSnapshot.ts`.** `snapshotOf(layout, entries)`, `readSnapshot()`, `writeSnapshot()`,
  `rebuildLayout(layout, reopened: Record<oldId, newId | null>)` — the last one renames reopened leaves and removes
  failed ones, which gives their space to the neighbours exactly as closing does.
- **Split `openPane`.** Its body becomes `startPane(workspace, size, resumed)` → the entry, or the error;
  `openPane` places it with `splitPane`, `reopenPanes` places them all at once. Output, status and exit are wired
  after the insert, as today.
- **Reopen sequence.** `reopenPanes(workspaces)` runs once, from an `App` effect when the folder list first
  loads and no pane is open. For each remembered pane, in tree order: folder missing or not in the list → failed;
  else `startPane` with the fallback size (each pane fits itself after mounting and resizes its session, as a pane
  does today) — rejected or not started → failed. Then one `setLayout` with the rebuilt tree, `maximizedId: null`,
  focus on the last reopened pane. `k > 0` → toast "<k> sessions could not be reopened". Panes opened by the user
  while the reopen runs are blocked by the existing `opening` guard.

## Seams to test

- **S1 — `paneSnapshot.ts` (`paneSnapshot.test.ts`)**: what is remembered (ended, not started, not prompted left
  out; ratio kept after pruning), `rebuildLayout` renaming and removing, `readSnapshot` on missing, broken or
  wrong-version data. Covers SRS-FR-084 and the geometry of SRS-FR-085 / SRS-FR-086.
- **S2 — App with a fake `SessionsClient`, real `localStorage` (`App.test.tsx`)**: render, open and prompt panes,
  unmount, render again → `sessions.open` called with the resume ids, panes at the saved rects, no maximize, no
  shell (SRS-FR-085); missing folder / rejected resume → pane left out, others widen, toast text (SRS-FR-086); an
  unprompted pane and an ended pane are not reopened and not counted (SRS-FR-084).

## Risks / Trade-offs

- [A pane whose status is never tracked and whose title stays "(untitled)" after a prompt is not remembered] →
  rare (hooks off and Claude Code gave no title); it is left out, not reported.
- [The saved session was resumed elsewhere meanwhile] → `client.open` resumes it like a manual Resume; no new
  handling.
- [Many panes reopen one after another] → each resume is one spawn; four panes (SRS-NFR-001) take about as long
  as four manual resumes.
