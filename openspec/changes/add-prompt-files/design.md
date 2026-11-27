## Context

This is CR-016 backlog item 42 (SRS v1.17: SRS-FR-161, SRS-FR-162; SRS § 3 Prompt File).

The look comes from `design/agent-deck/cr016/design.html` › `#composer-menus` › `ATTACH`:
- A row of chips sits above the Composer field: `px-3 pt-2 flex flex-wrap gap-2`, top border, card background.
- An ok chip is `chip chip-idle` with an icon (`image` for images, otherwise `file`), "name · size" and an `x`.
- A rejected chip is `chip chip-err` with `triangle-alert` and "name · File lớn hơn 50 MB".
- `.chip`, `.chip-idle` and `.chip-err` already exist in `src/index.css`.

The Composer (`Composer.tsx`, `useComposer.ts`, items 39 and 41) is a textarea plus the "/" and "@" menus. Its draft lives in `useComposer`.

Tauri 2 has `dragDropEnabled` on by default (`tauri.conf.json` does not set it). A file dropped on the window is therefore not a DOM `drop` with `File`s: the webview emits `onDragDropEvent` with absolute paths and a physical position. Pane dragging uses pointer events, not HTML5 drag-and-drop, so the two do not meet.

`core:default` in `src-tauri/capabilities/default.json` covers webview events. The app data folder is `app.path().app_data_dir()`, the one `workspaces.json` uses.

## Goals / Non-Goals

**Goals:**
- Paste and drop store Prompt Files and insert their paths at the caret.
- Chips show what is attached, with a ×.
- More than 50 MB is rejected per file, with the SRS message.

**Non-Goals:**
- Windows/ConPTY verification (later, at the user's request).
- A paperclip file picker, dropped folders, and quoting paths (proposal › Non-Goals).
- Deleting Prompt Files (item 45, SRS-FR-179).

## Decisions

### Storage (`prompt_files.rs`)
- **Layout:** `<app data>/prompt-files/<id>/<name>`.
  - `<id>` is the store time in milliseconds plus a counter, so two files with the same name never collide.
  - `<name>` is the original file name reduced to its last path part. An empty name, `.` or `..` becomes `file`.
  - Keeping the real name lets Claude Code see the extension, and lets the user recognise the file in the prompt.
- **`store_bytes(root, name, bytes) -> Result<PathBuf, StoreError>`** stores a paste.
- **`store_copy(root, source) -> Result<PathBuf, StoreError>`** stores a drop.
  - It reads the source's metadata first, without following a symlink to decide that it is a file.
  - A symlink to a file is copied by content.
  - A folder gives `NotAFile`.
  - A missing source gives `NotFound`.
- **`MAX_BYTES = 50 * 1024 * 1024`.** Both paths check the size before writing and return `TooLarge` above it. A copy streams with `std::fs::copy`, so 50 MB never sits in memory.
- **Errors reach the frontend as strings:** `"too_large"`, `"not_a_file"`, `"not_found"`, or the io error text.

### Tauri commands
- **`save_prompt_file(request)`:**
  - Raw body: the bytes, using `tauri::ipc::Request` with `InvokeBody::Raw`.
  - Header `x-file-name`: the file name, percent-encoded so Vietnamese names survive.
  - The frontend calls `invoke("save_prompt_file", bytes, { headers })`.
- **`copy_prompt_file(path)`.**
- Both return `{ path: string, name: string, size: number }`.
- Disk work runs in `spawn_blocking`.
- The source path of a drop comes from the OS drop event, which is the user's own action. The backend only reads it and copies it into its own folder.

### Frontend
- **`attachments.ts` (pure):**
  - `insertPaths(text, caret, paths) → {text, caret}`. Each path is followed by a space. A space is added before the first one when the char before the caret is not whitespace.
  - `removePath(text, path)` removes the path and one following space.
  - `formatSize(bytes)`:
    - under 1024 → "N B";
    - under 1 MB → "N KB" (rounded);
    - else "N.N MB".
  - `tooLarge(size)`.
- **Attachment state per pane (in `useComposer`):**
  - A list of `{ name, size, path }` or `{ name, error: "too_large" }`.
  - The chip list shows the ok attachments whose path is still in the draft, plus the error chips.
  - Sending clears the list.
  - A path the user deletes by hand loses its chip on the next render.
- **Paste:**
  - `onPaste` on the textarea reads `clipboardData.files`.
  - When it holds files, the default text paste is prevented.
  - Each file over 50 MB gets an error chip without being sent.
  - The others are sent in order with `savePromptFile(name, bytes)`.
  - The paths are inserted once all replies are in, at the caret of the paste. A failed save gives nothing.
- **Drop:**
  - One window listener (in `App` or `PaneGrid`) on `getCurrentWebview().onDragDropEvent`.
  - On `drop` it converts the physical position to CSS pixels with `devicePixelRatio`, then finds `document.elementFromPoint(x, y)?.closest("[data-pane-id]")`.
  - It hands the paths to that pane's attach function through a registry keyed by pane id (`Map<string, (paths) => void>`).
  - A drop on no pane is ignored.
  - Per path, `copyPromptFile(path)`:
    - `"too_large"` → an error chip;
    - `"not_a_file"` or `"not_found"` → skipped.
  - The paths are inserted at the textarea's current caret, and focus goes to the Composer.
- **Chips (`AttachmentChips.tsx`):**
  - They sit inside the Composer strip, above the field row, only when there is at least one.
  - The × of an ok chip calls `removePath`. The × of an error chip drops that chip.

## Seams to test

1. `prompt_files::store_bytes` / `store_copy` with a temp root:
   - name reduction (`../x.png`, `a/b.png`, empty, Vietnamese);
   - unique ids for the same name;
   - bytes equal;
   - exactly 50 MB accepted, 50 MB + 1 rejected (a sparse file via `set_len`, so the test stays fast);
   - folder → `NotAFile`, missing → `NotFound`;
   - symlink to a file copied by content.
2. `attachments.ts` pure functions against the spec scenarios.
3. `Composer` in RTL with a fake client:
   - paste of 1 and 2 files inserts paths at the caret and shows chips;
   - paste of a > 50 MB file shows the error chip and does not call the client;
   - × removes the path;
   - plain-text paste is untouched;
   - send clears the chips.
4. Drop routing: the handler finds the pane under a position (fake `elementFromPoint`, fake `onDragDropEvent`) and calls only that pane's attach. Plus the `invoke` mapping of `savePromptFile` (raw body plus header) and `copyPromptFile`.
5. Real app on macOS (`qa-verify-after-dev`):
   - paste a screenshot;
   - drop 2 files on pane 2;
   - drop a 120 MB plus a 2 KB file;
   - remove a chip;
   - send a prompt with an image path and Claude Code reads it (SC-1 to SC-5).
   - Also measure what a paste of a file copied in Finder gives in WKWebView.

## Risks / Trade-offs

- **Pasting a file copied in Finder may give no `File` in WKWebView** → seam 5 measures it. If it gives nothing, only images are pasteable, and that gap is reported.
- **Paths with spaces ("Application Support")** → the path goes in as it is (proposal › Non-Goals). Seam 5 checks that Claude Code still reads the file.
- **`devicePixelRatio` mapping is off on a zoomed window (Text Size, SRS-FR-071)** → drop on a pane at a non-100% zoom is part of seam 5.
