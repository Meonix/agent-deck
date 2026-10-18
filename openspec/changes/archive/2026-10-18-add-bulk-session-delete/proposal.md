## Why

BR-08 of the agent-deck BRD (v2.3, CR-004): the user deletes one or several old sessions of a folder at once by
moving them to the Trash. Cleaning a folder with dozens of old sessions one Delete and one confirmation at a
time is slow. Backlog item 16 (Should), after items 11 and 12 which built the single delete and the Session
History Panel.

## What Changes

- Each row of the Session History Panel gets a checkbox; ticked rows form the Session Selection (SRS-FR-073).
- While the selection is not empty, the panel shows "Select all" and "Delete selected (<n>)" (SRS-FR-074);
  Select all ticks every listed row (SRS-FR-075).
- Switching workspace or closing the panel empties the selection (SRS-FR-076).
- Delete selected asks once, "Move <n> sessions to Trash?", or "Close <k> open sessions and move <n> sessions to
  Trash?" when some are open in panes (SRS-FR-077); on confirm each selected session is deleted as a single
  delete is, open ones by ending the session and closing the pane first (SRS-FR-078).
- Sessions that cannot be moved stay listed and ticked, with the message "<k> of <n> sessions deleted"
  (SRS-FR-079).
- The Delete action of a single row is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-history`: adds selecting sessions and deleting the selection (SRS-FR-073, SRS-FR-074, SRS-FR-075,
  SRS-FR-076, SRS-FR-077, SRS-FR-078, SRS-FR-079).

## Impact

- UI: `SessionHistoryPanel` gets the row checkboxes and the selection bar; `App` holds the Session Selection,
  the bulk confirmation and the delete loop, sharing one per-session delete with the existing single Delete.
- No Rust change: the existing `delete_session` command is called once per session. No new dependency, no new
  token. The UI was not designed through `/ux-design-ui`: the PO skipped it at GATE 1; the controls reuse the
  panel's existing button styles.
