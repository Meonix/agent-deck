import { File as FileIcon, Image, TriangleAlert, X } from "lucide-react";
import { labels } from "../labels";
import { formatSize } from "./attachments";
import { ICON_SM } from "./icon";

export type Chip = { kind: "ok"; name: string; size: number; path: string } | { kind: "error"; name: string };

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|heic)$/i;

type Props = {
  chips: Chip[];
  onRemove(index: number): void;
};

/** The files attached to the draft, above the Composer's field row (SRS-FR-161, SRS-FR-162). */
export function AttachmentChips({ chips, onRemove }: Props) {
  if (chips.length === 0) return null;
  return (
    <div role="list" aria-label={labels.attachments} className="mb-2 flex flex-wrap gap-2">
      {chips.map((chip, i) => {
        const Icon = chip.kind === "error" ? TriangleAlert : IMAGE_NAME.test(chip.name) ? Image : FileIcon;
        const text = chip.kind === "error" ? `${chip.name} · ${labels.attachTooLarge}` : `${chip.name} · ${formatSize(chip.size)}`;
        return (
          <div
            key={chip.kind === "ok" ? chip.path : `error-${i}`}
            role="listitem"
            className={`chip ${chip.kind === "ok" ? "chip-idle" : "chip-err"} flex items-center gap-1 whitespace-nowrap`}
          >
            <Icon {...ICON_SM} />
            {text}
            <button type="button" aria-label={labels.removeAttachment(chip.name)} title={labels.removeAttachment(chip.name)} onClick={() => onRemove(i)} className="flex items-center">
              <X {...ICON_SM} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
