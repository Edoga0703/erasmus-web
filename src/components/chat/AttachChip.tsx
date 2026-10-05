import { X } from "lucide-react";
import type { Attachment } from "@/hooks/use-chat";
import { TypeIcon } from "@/components/files/FilesPanel";

const fmt = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** ChatGPT-style attachment tile: image thumbnail or file card, optional remove button. */
export function AttachChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <div className="group/chip relative">
      {a.url ? (
        <img src={a.url} alt={a.name} title={a.name} className="size-16 rounded-2xl border border-e-line object-cover" />
      ) : (
        <div className="flex h-16 w-56 max-w-[70vw] items-center gap-3 rounded-2xl border border-e-line bg-e-bg2 px-3" title={a.name}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-e-bg3"><TypeIcon name={a.name} /></span>
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-[13.5px] font-medium text-e-tx">{a.name}</span>
            <span className="block text-[12px] text-e-dim">{a.name.split(".").pop()?.toUpperCase()} · {fmt(a.size)}</span>
          </span>
        </div>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${a.name}`} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-e-acc text-e-bg2">
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
