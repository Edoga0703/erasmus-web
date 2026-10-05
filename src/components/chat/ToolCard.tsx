import { useState } from "react";
import { ChevronRight, FilePen, FilePlus, FileSearch, FolderTree, Loader2, Terminal } from "lucide-react";
import type { ToolBlock } from "@/lib/blocks";
import type { ToolState } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

const META: Record<ToolBlock["kind"], { label: string; Icon: typeof Terminal }> = {
  "powershell:run": { label: "PowerShell", Icon: Terminal },
  "file:list": { label: "Listar", Icon: FolderTree },
  "file:read": { label: "Leer", Icon: FileSearch },
  "file:write": { label: "Escribir", Icon: FilePen },
  "file:append": { label: "Añadir", Icon: FilePlus },
};

const STATUS: Record<string, { text: string; cls: string }> = {
  pending: { text: "Recibiendo…", cls: "text-e-dim" },
  queued: { text: "En cola", cls: "text-e-dim" },
  running: { text: "Ejecutando…", cls: "text-e-info" },
  ok: { text: "Hecho", cls: "text-e-ok" },
  error: { text: "Error", cls: "text-e-err" },
  skipped: { text: "No ejecutado", cls: "text-e-dim" },
};

export function ToolCard({ block, state, streaming }: { block: ToolBlock; state?: ToolState | undefined; streaming?: boolean | undefined }) {
  const [open, setOpen] = useState(false);
  const { label, Icon } = META[block.kind];
  const key = state?.status ?? (streaming && !block.closed ? "pending" : streaming ? "queued" : block.kind === "powershell:run" ? "skipped" : "queued");
  const st = STATUS[key] ?? { text: "", cls: "" };
  const hasBody = !!(state?.diff?.length || state?.output || block.body);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-e-line bg-e-bg">
      <button
        type="button"
        onClick={() => hasBody && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-e-bg3"
        aria-expanded={open}
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-e-dim transition-transform", open && "rotate-90", !hasBody && "opacity-0")} />
        <Icon className="size-3.5 shrink-0 text-e-acc2" />
        <span className="font-medium text-e-tx">{label}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-e-dim">{block.target.split("\n")[0] || "."}</code>
        <span className={cn("flex shrink-0 items-center gap-1 text-[11.5px]", st.cls)}>
          {key === "running" && <Loader2 className="size-3 animate-spin" />}
          {st.text}
        </span>
      </button>
      {state?.detail && <div className="border-t border-e-line px-3 py-1.5 text-[11.5px] text-e-dim">{state.detail}</div>}
      {open && hasBody && (
        <div className="max-h-80 overflow-auto border-t border-e-line font-mono text-[12px] leading-5">
          {state?.diff ? (
            state.diff.map((r, i) => (
              <div key={i} className={cn("whitespace-pre px-3", r.kind === "add" && "e-diff-add", r.kind === "del" && "e-diff-del", r.kind === "same" && "text-e-dim")}>
                {r.kind === "add" ? "+ " : r.kind === "del" ? "- " : "  "}
                {r.text}
              </div>
            ))
          ) : (
            <pre className="whitespace-pre-wrap px-3 py-2 text-e-tx">{state?.output ?? block.body}</pre>
          )}
        </div>
      )}
    </div>
  );
}
