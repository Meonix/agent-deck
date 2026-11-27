import { type Dispatch, type RefObject, type SetStateAction, useLayoutEffect, useRef, useState } from "react";
import type { SessionsClient } from "../api/sessions";
import type { Chip } from "./AttachmentChips";
import { type AttachResult, insertPaths, rejectedAttach, removePath, tooLarge } from "./attachments";

type Options = {
  client: SessionsClient;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  /** The Composer's textarea: attached paths go in at its caret. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Paths went into the draft, so it is no longer a recalled prompt. */
  onInsert(): void;
};

/** The files attached to a Composer's draft and their chips (SRS-FR-161, SRS-FR-162). */
export function useAttachments({ client, draft, setDraft, inputRef, onInsert }: Options) {
  const [attached, setAttached] = useState<AttachResult[]>([]);
  // Where the caret goes once the draft holding the attached paths is in the textarea.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    const at = pendingCaret.current;
    if (!el || at === null || el.value !== draft) return;
    pendingCaret.current = null;
    el.setSelectionRange(at, at);
    el.focus();
  });

  const attach = (results: AttachResult[]) => {
    if (results.length === 0) return;
    setAttached((prev) => [...prev, ...results]);
    const paths = results.flatMap((r) => ("error" in r ? [] : [r.path]));
    const el = inputRef.current;
    if (paths.length === 0) {
      el?.focus();
      return;
    }
    onInsert();
    setDraft((current) => {
      const at = el && el.value === current ? el.selectionStart : current.length;
      const next = insertPaths(current, at, paths);
      pendingCaret.current = next.caret;
      return next.text;
    });
  };

  // A path the user deleted by hand loses its chip; the index of each chip points back into `attached`.
  const shown = attached.flatMap((r, at): { at: number; chip: Chip }[] => {
    if ("error" in r) return [{ at, chip: { kind: "error", name: r.name } }];
    return draft.includes(r.path) ? [{ at, chip: { kind: "ok", name: r.name, size: r.size, path: r.path } }] : [];
  });
  const chips = shown.map((s) => s.chip);
  const onRemoveChip = (index: number) => {
    const entry = shown[index];
    if (!entry) return;
    if (entry.chip.kind === "ok") setDraft(removePath(draft, entry.chip.path));
    setAttached((prev) => prev.filter((_, i) => i !== entry.at));
  };

  const onPasteFiles = (files: File[]) => {
    void Promise.all(files.map((file) => saveFile(client, file))).then((results) => attach(results.filter((r) => r !== null)));
  };

  const clear = () => setAttached([]);

  return { attach, chips, onRemoveChip, onPasteFiles, clear };
}

async function saveFile(client: SessionsClient, file: File): Promise<AttachResult | null> {
  const name = file.name || "file";
  if (tooLarge(file.size)) return { name, error: "too_large" };
  try {
    return await client.savePromptFile(name, new Uint8Array(await file.arrayBuffer()));
  } catch (reason) {
    return rejectedAttach(name, reason);
  }
}
