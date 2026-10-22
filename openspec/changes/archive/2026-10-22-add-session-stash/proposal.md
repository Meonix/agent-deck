## Why

BR-03 of the agent-deck BRD (v4.1, CR-011): the user puts aside a session whose work is unfinished, closing its
pane, into a list of its own, and reopens it from that list later. Today the only way back to such a session is to
find it again in the Session History Panel of its folder, among every other session. Serves BO-02 (back to an old
session in ≤ 3 actions: one click on a stashed row). Backlog item 26 (Should).

## What Changes

- A Stash button in every pane header, immediately left of Maximize / Restore; disabled while the session has no
  history on disk (SRS-FR-103).
- Stash on a pane that is not busy closes it like Close (session and Pane Shell end) and adds its session to
  Stashed Sessions, with no Close Dialog (SRS-FR-104).
- Stash on a busy pane (`Running`, `Needs Approval`, or a shell running a command) shows the Stash Dialog first
  (SRS-FR-105).
- A Stashed Sessions section in the Sidebar below Active Sessions: title and workspace of each stashed session,
  most recently stashed first, or "No stashed sessions" (SRS-FR-106, SRS-FR-107).
- Choosing a row resumes the session in a new pane (SRS-FR-108); a stashed session that opens in a pane by any path
  leaves the list (SRS-FR-109); × on a row removes it without opening anything (SRS-FR-110).
- The list and its order survive a relaunch (SRS-FR-111); a session whose history is gone leaves it
  (SRS-FR-112).
- The section gets its own background tint (SRS-NFR-010).

## Capabilities

### New Capabilities

- `session-stash`: stashing a pane's session, the Stashed Sessions section, reopening and removing stashed
  sessions (SRS-FR-103 to SRS-FR-112, SRS-NFR-010).

### Modified Capabilities

None. Close (SRS-FR-029, SRS-FR-062), resume (SRS-FR-013, SRS-FR-015 to SRS-FR-017) and pane restore (SRS-FR-084)
are reused unchanged.

## Impact

- UI: new `src/components/stash.ts` (pure list logic and storage) and `useStash.ts`; `WorkspaceSidebar` gets the
  Stashed Sessions section; `TerminalPane` gets the Stash button; `App` wires stashing, the Stash Dialog, reopening
  and pruning.
- `design/agent-deck/tokens.css` and `tailwind.preset.js`: new `--section-stash` token, light and dark.
- No Rust change, no new Tauri command, no new dependency. Storage: `localStorage` key `adStashedSessions`, next to
  `adOpenPanes`.
