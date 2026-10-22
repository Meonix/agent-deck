## Context

The pane header (`src/components/TerminalPane.tsx`) ends with Shell chip · Maximize/Restore · ×. × goes through
`App.requestClose`, which asks the shell for its activity and opens the Close Dialog (`ConfirmDialog`); Close calls
`panes.closePane`, which ends the session and the shell (SRS-FR-029, SRS-FR-062) and returns false when it could not.
`hasHistory(entry)` in `App.tsx` already tells whether a pane's session exists on disk (RULE-01: `(untitled)` means
no prompt yet). The Sidebar (`WorkspaceSidebar.tsx`) has two sections, Folders and Active Sessions, tinted with
`--section-folders` and `--section-active` (SRS-NFR-009). Open panes are remembered in `localStorage`
(`paneSnapshot.ts`, key `adOpenPanes`). `panes.resume(workspace, row)` already handles `Missing` folders ("Folder not
found"), start failures and a session already open (SRS-FR-015 to SRS-FR-017). Approach A was chosen at GATE 1.

## Goals / Non-Goals

**Goals:**

- SRS-FR-103 to SRS-FR-112 and SRS-NFR-010, with no change to the behaviour of Close, Resume and pane restore.

**Non-Goals** (the SRS is silent; a wish here goes through `/ba-change`):

- A Status Highlight or any state on stashed rows: a stashed session has no pane, so it has no state.
- Stashing several panes at once, or a keyboard shortcut for Stash.
- A stashed row whose folder was removed from the Folders list: clicking it shows "Folder not found" and the row
  stays, like a `Missing` folder; × removes it.
- A limit on the number of stashed rows; the section scrolls with the Sidebar.
- Sharing the stash across machines.

## Decisions

**D1 — Pure list module `stash.ts`.**
`StashedSession = { sessionId, workspaceId, workspaceName, title, stashedAt }`. Functions: `addStashed(list, item)`
puts the item first and drops an older entry of the same session; `removeStashed(list, sessionId)`;
`pruneStashed(list, workspaceId, presentIds)` drops that workspace's rows whose id is not in `presentIds`;
`readStash()` / `writeStash(list)` on `localStorage` key `adStashedSessions` with a version field, a corrupt or
foreign value reads as empty, a failed write is ignored (same policy as `paneSnapshot.ts`). The list is kept newest
first, so the stored order is the shown order (SRS-FR-106, SRS-FR-111).
Rejected: a Rust store (approach B).

**D2 — `useStash` hook owns the list.** It reads once at mount, writes on every change, and exposes `add`,
`remove`, `prune`. `workspaceName` is stored so a row still has a name when its folder was removed; the live name
from `workspaces.items` wins when present.

**D3 — Unstash follows the panes, not the click (SRS-FR-109).** An effect in `App` removes from the stash every
session that is `started && !ended` in `panes.entries`. This covers the stashed row, Resume in the Session History
Panel and the focus of an already open pane with one rule, and leaves the row when the open fails (`Missing`, start
failure — SRS-FR-108). Stash closes the pane before adding the row, so the effect never removes a row just added.

**D4 — Stash flow in `App`, next to the close flow.** `requestStash(paneId)` asks the shell for its activity the same
way `requestClose` does (latest request wins). Not busy → `stash(entry)`. Busy (`isBusy(entry)` or a busy shell) →
`ConfirmDialog` titled `Stash “<title>”?`, detail from `closeWarnings`, action `Stash` (SRS-FR-105). `stash(entry)`
calls `panes.closePane`; only when it returns true is the row added (a failed close already shows its toast and
leaves the pane, so nothing is stashed).

**D5 — Stash button.** `TerminalPane` gets `canStash` and `onStash`; the button sits just before Maximize/Restore,
same size as it (h-6 w-6), glyph `⤓`, `aria-label` / `title` "Stash session", `disabled` when `!canStash`
(SRS-FR-103). `canStash = hasHistory(entry)`; it is excluded from the header double-click like every header button.

**D6 — Reopen (SRS-FR-108).** A row click finds the workspace in `workspaces.items`; none → toast "Folder not
found"; else `panes.resume(workspace, { id, title })`. `Missing` is refused inside `resume`. × calls `remove`
(SRS-FR-110), no dialog.

**D7 — History gone (SRS-FR-112).** Two paths: a delete that leaves nothing on disk (`deleteOne` returns true,
single, many or Close and move to Trash) removes the row at once; and once per launch, after the workspaces load,
`sessions.list(workspaceId)` runs for each non-`Missing` workspace that has stashed rows and `prune` drops ids not in
the listing. A failed listing keeps the rows.

**D8 — Section and tint (SRS-NFR-010).** A third `<section>` below Active Sessions, header "Stashed Sessions · n",
`ul aria-label="Stashed sessions"`, rows "title · workspace" laid out like Active Sessions rows, × shown on row hover
and on keyboard focus. Active Sessions loses `flex-1`; the Sidebar keeps scrolling as a whole. New token
`--section-stash`: Radix `plum-3` / `plum-dark-3` from `@radix-ui/colors@3.0.0`, contrast against `--card`,
`--foreground` and `--muted-foreground` measured with the WCAG formula and written in the token comment like the two
existing ones; `tailwind.preset.js` gets `section.stash`. If plum fails the bound, the next unused Radix hue is
tried and the comment says which.

### Seams to test (approve at GATE 2)

| Seam | Public interface | Requirements proven there | How |
| --- | --- | --- | --- |
| S1 list logic | `stash.ts`: `addStashed`, `removeStashed`, `pruneStashed`, `readStash`, `writeStash` | SRS-FR-106 order and no duplicates; SRS-FR-110 remove; SRS-FR-111 round trip through `localStorage`, corrupt value → empty; SRS-FR-112 prune by listing | Vitest, `stash.test.ts` |
| S2 UI app | `App` with fake clients and fake adapters (as in `App.test.tsx`) | SRS-FR-103 order and disabled; SRS-FR-104 idle stash, no Close Dialog, history kept; SRS-FR-105 Running → Stash Dialog, Cancel / Stash; SRS-FR-106 / SRS-FR-107 rows and empty text; SRS-FR-108 reopen and `Missing`; SRS-FR-109 via row and via history Resume; SRS-FR-110 ×; SRS-FR-111 rows read from `localStorage` at launch; SRS-FR-112 delete in panel and listing without the id at launch | Vitest + Testing Library, new `describe("Stashed Sessions (CR-011)")` in `App.test.tsx` |
| S3 tint | `tokens.css` values | SRS-NFR-010 | WCAG contrast computed by a script, numbers in the token comment (Analysis) |
| — real app | — | button look, section look in light and dark | demo in the rebuilt `.app` |

## Risks / Trade-offs

- [`localStorage` cleared or a new WebView profile] → the stash is lost, the sessions are not (still in history).
  Accepted with approach A.
- [Launch prune lists every folder with stashed rows] → one `list_sessions` call per such folder, once per launch;
  the same call the Session History Panel makes.
- [Stash while the pane's close fails] → pane stays, nothing is stashed, the close toast explains it.

## Migration Plan

New `localStorage` key only; nothing to migrate. Rollback = revert the change; the stored key is then ignored.

## Open Questions

None.
