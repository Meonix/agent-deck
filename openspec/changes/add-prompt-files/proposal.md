## Why

CR-016 BO-05 is "work with a session without typing in the terminal". BR-12 asks that the user writes prompts from the pane's own input. A screenshot or a log file often explains a problem better than words. In Term the user can paste an image, but the Composer (item 39) takes only text. Backlog item 42 lets the user paste or drop files into the Composer (SRS v1.17, SRS-FR-161, SRS-FR-162).

## What Changes

- Pasting files into the Composer, or dropping files onto it, stores each file as a Prompt File and inserts its absolute path into the prompt at the caret (SRS-FR-161).
  - Prompt Files live in the app's data folder, `<app data>/prompt-files/<id>/<file name>`, outside every repository.
  - A paste covers screenshots and other files the clipboard carries.
  - A drop on a pane's Composer goes to that pane.
- A file larger than 50 MB is not stored. Its chip reads "File lớn hơn 50 MB". The other files of the same paste or drop are still attached (SRS-FR-162).
- Each attached file shows as a chip above the input: an icon, the name and the size. The chip's × takes the path out of the prompt. This follows `design/agent-deck/cr016/design.html` › `#composer-menus` (`ATTACH`).
- Unchanged on purpose:
  - The prompt is still delivered as text. Claude Code reads the path when the prompt is submitted, as if it had been typed in Term.
  - Deleting old Prompt Files is item 45 (SRS-FR-179). This change never deletes one.
  - Windows (ConPTY) behaviour is verified later, at the user's request. This change is built and verified on macOS.

## Non-Goals

- A paperclip button that opens a file picker. The design draws one, but the SRS names only paste and drop. That needs `/ba-change`.
- Dropping a folder. The SRS says "files"; a dropped folder is skipped.
- Quoting a path that holds spaces (the macOS app data folder is under "Application Support"). The SRS says "insert its absolute path"; the path is inserted as it is.

## Success Criteria

- SC-1: Pasting a screenshot into an empty Composer makes it read `<app data>/prompt-files/<id>/<name>.png ` and shows a chip with the name and the size. The file exists at that path with the same bytes.
- SC-2: Dropping `log.txt` (2 KB) onto pane 2's Composer inserts its Prompt File path in pane 2's Composer only. The original `log.txt` is unchanged.
- SC-3: Dropping `demo.mov` (120 MB) together with `log.txt` stores only `log.txt`. A chip reads "demo.mov · File lớn hơn 50 MB", and no path for `demo.mov` is in the prompt.
- SC-4: The × on a chip takes that path out of the prompt; the other text stays.
- SC-5: Sending a prompt with an attached image path makes Claude Code read that image.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `composer`: adds Attach files (SRS-FR-161) and Attachment size limit (SRS-FR-162).

## Impact

- Backend:
  - New `src-tauri/src/prompt_files.rs`: store pasted bytes, copy a dropped file, enforce the 50 MB limit.
  - New Tauri commands `save_prompt_file` (raw bytes plus the file name) and `copy_prompt_file(path)`, registered in `lib.rs`.
  - No new crate.
- Frontend:
  - `SessionsClient` gains `savePromptFile` and `copyPromptFile`.
  - New `src/components/attachments.ts`: pure insert, remove and size helpers.
  - New `src/components/AttachmentChips.tsx`.
  - `Composer.tsx` and `useComposer.ts` handle paste and attachments.
  - A window-level drop listener (`getCurrentWebview().onDragDropEvent`) routes a drop to the pane under the pointer.
  - `labels.ts` gains "File lớn hơn 50 MB".
- No change to delivery, status tracking or hooks.
