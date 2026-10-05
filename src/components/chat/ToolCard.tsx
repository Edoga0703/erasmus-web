import { useMemo, useState } from "react";
import { ChevronRight, FileCode2, FilePen, FilePlus, FileSearch, FolderTree, Loader2, SquareTerminal } from "lucide-react";
import type { ToolBlock } from "@/lib/blocks";
import type { ToolState } from "@/hooks/use-chat";
import { highlight } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const META: Record<ToolBlock["kind"], { label: string; Icon: typeof FileCode2 }> = {
  "code:python": { label: "Python", Icon: FileCode2 },
  "code:bash": { label: "Bash", Icon: SquareTerminal },
  "file:list": { label: "Listar", Icon: FolderTree },
  "file:read": { label: "Leer", Icon: FileSearch },
  "file:write": { label: "Escribir", Icon: FilePen },
  "file:append": { label: "Añadir", Icon: FilePlus },
};

const STATUS: Record<string, { text: string; cls: string }> = {
  pending: { text: "Recibiendo…", cls: "text-e-dim" },
  queued: { text: "En cola", cls: "text-e-dim" },
  running: { text: "Ejecutando…", cls: "text-e-info" },
  ok: { text: "Éxito", cls: "text-e-ok" },
  error: { text: "Error", cls: "text-e-err" },
  limit: { text: "Límite alcanzado", cls: "text-e-dim" },
  saved: { text: "Del historial", cls: "text-e-dim" },
};

const TAIL = 20;

function Output({ text, tone }: { text: string; tone?: "err" }) {
  const [all, setAll] = useState(false);
  const lines = text.replace(/\n$/, "").split("\n");
  const hidden = lines.length - TAIL;
  const shown = all || hidden <= 0 ? lines : lines.slice(-TAIL);
  return (
    <div className={cn("border-t border-e-line", tone === "err" && "e-diff-del")}>
      {hidden > 0 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full px-3 py-1 text-left text-[11.5px] text-e-info hover:underline">
          {all ? "Mostrar solo las últimas 20 líneas" : `Mostrar todo (${hidden} líneas más)`}
        </button>
      )}
      <pre className={cn("max-h-80 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[12px] leading-5", tone !== "err" && "text-e-tx")}>{shown.join("\n")}</pre>
    </div>
  );
}

export function ToolCard({ block, state, streaming }: { block: ToolBlock; state?: ToolState | undefined; streaming?: boolean | undefined }) {
  const isCode = block.kind.startsWith("code:");
  const [open, setOpen] = useState(false);
  const { label, Icon } = META[block.kind];
  const key = state?.status ?? (streaming && !block.closed ? "pending" : "queued");
  const st = STATUS[key] ?? { text: "", cls: "" };
  const codeHtml = useMemo(() => (isCode && open ? highlight(block.body, block.kind === "code:python" ? "python" : "bash") : ""), [isCode, open, block.body, block.kind]);
  const hasBody = isCode || !!(state?.diff?.length || state?.output || block.body);

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
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-e-dim">{block.target || "."}</code>
        {state?.exitCode !== undefined && (
          <span className={cn("shrink-0 rounded px-1.5 font-mono text-[10.5px]", state.exitCode === 0 ? "e-diff-add" : "e-diff-del")}>exit {state.exitCode}</span>
        )}
        {state?.durationMs !== undefined && <span className="shrink-0 font-mono text-[11px] text-e-dim">{(state.durationMs / 1000).toFixed(1)} s</span>}
        <span className={cn("flex shrink-0 items-center gap-1 text-[11.5px]", st.cls)}>
          {key === "running" && <Loader2 className="size-3 animate-spin" />}
          {st.text}
        </span>
      </button>

      {open && isCode && (
        <pre className="max-h-72 overflow-auto border-t border-e-line px-3 py-2 font-mono text-[12px] leading-5">
          <code dangerouslySetInnerHTML={{ __html: codeHtml }} />
        </pre>
      )}
      {open && !isCode && hasBody && (
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

      {state?.detail && <div className="border-t border-e-line px-3 py-1.5 text-[11.5px] text-e-dim">{state.detail}</div>}
      {isCode && state?.stdout ? <Output text={state.stdout} /> : null}
      {isCode && state?.stderr ? <Output text={state.stderr} tone="err" /> : null}
    </div>
  );
}
