## 1. Prompt File store (tests first) — seam 1

- [x] 1.1 RED `src-tauri/src/prompt_files.rs` tests for `store_bytes` and `store_copy` (design.md › Storage): name reduction, unique ids, equal bytes, 50 MB accepted and 50 MB + 1 rejected (sparse file), folder → NotAFile, missing → NotFound, symlink to a file copied. (SRS-FR-161, SRS-FR-162)
- [x] 1.2 Implement → GREEN.
- [x] 1.3 Tauri commands `save_prompt_file` (raw body + `x-file-name` header) and `copy_prompt_file(path)` on a blocking thread, root = `<app data>/prompt-files`; register in `lib.rs`. `SessionsClient.savePromptFile(name, bytes)` / `copyPromptFile(path)` with `invoke` mapping tests; fakes updated.

## 2. Attachment helpers (tests first) — seam 2

- [x] 2.1 RED `src/components/attachments.test.ts`: `insertPaths` at the caret (spec "Insert at the caret"), `removePath` (spec "Remove an attachment"), `formatSize` (214 KB, 2 KB, 120.0 MB), `tooLarge` at 50 MB and 50 MB + 1. (SRS-FR-161, SRS-FR-162)
- [x] 2.2 Implement `attachments.ts` → GREEN.

## 3. Paste and chips in the Composer (tests first) — seam 3

- [x] 3.1 RED `Composer` RTL tests with a fake client: paste one and two files, paste over 50 MB, × on ok and error chips, plain-text paste untouched, send clears the chips, a path deleted by hand loses its chip. (SRS-FR-161, SRS-FR-162)
- [x] 3.2 Implement `AttachmentChips.tsx`, paste handling and attachment state in `Composer.tsx` / `useComposer.ts`, label "File lớn hơn 50 MB", following `#composer-menus` › `ATTACH` → GREEN.

## 4. Drop routing (tests first) — seam 4

- [x] 4.1 RED: a drop handler test with a fake `onDragDropEvent` and `elementFromPoint` — a drop over pane 2 attaches to pane 2 only, a drop over no pane does nothing, the physical position is divided by `devicePixelRatio`; `copyPromptFile` errors map to an error chip (`too_large`) or a skip (`not_a_file`, `not_found`). (SRS-FR-161, SRS-FR-162)
- [x] 4.2 Implement the window listener and the per-pane attach registry → GREEN.

## 5. Verify

- [x] 5.1 Real app on macOS (`qa-verify-after-dev`): SC-1 to SC-5, a drop at a non-100% Text Size, and a paste of a file copied in Finder (measured, reported).
