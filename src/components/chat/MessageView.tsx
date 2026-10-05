import { AttachChip } from "./AttachChip";
import { memo, useMemo, useState } from "react";
import { Check, Copy, Pencil, RefreshCw, ThumbsDown, ThumbsUp, ChevronsDown } from "lucide-react";
import { parseSegments } from "@/lib/blocks";
import type { UIMessage } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { ToolCard } from "./ToolCard";
import { ThinkingChip } from "./Thinking";

function ActBtn({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={cn("inline-flex size-8 items-center justify-center rounded-lg text-e-dim hover:bg-e-bg3 hover:text-e-tx", active && "text-e-tx")}>
      {children}
    </button>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <ActBtn label={done ? "Copiado" : "Copiar"} onClick={() => { void navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
    </ActBtn>
  );
}

/** Memoized: during streaming only the message whose object changed re-renders (use-chat patches by id). */
export const MessageView = memo(function MessageView({ m, isLast, busy, onRegenerate, onEdit, onContinue }: {
  m: UIMessage; isLast?: boolean | undefined; busy?: boolean | undefined; onRegenerate?: (() => void) | undefined; onEdit?: ((text: string) => void) | undefined; onContinue?: (() => void) | undefined;
}) {
  const segs = useMemo(() => (m.role === "assistant" ? parseSegments(m.content) : []), [m.content, m.role]);
  const [vote, setVote] = useState<0 | 1 | -1>(0);
  if (m.hidden) return null;

  if (m.role === "user") {
    return (
      <div className="group flex flex-col items-end">
        {!!m.attachments?.length && <div className="mb-2 flex max-w-[85%] flex-wrap justify-end gap-2">{m.attachments.map((a) => <AttachChip key={a.name} a={a} />)}</div>}
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-e-bg3 px-5 py-2.5 text-[16px] leading-7 text-e-tx sm:max-w-[70%]">{m.content}</div>
        <div className="mt-1 flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <CopyBtn text={m.content} />
          {onEdit && !busy && <ActBtn label="Editar mensaje" onClick={() => onEdit(m.content)}><Pencil className="size-4" /></ActBtn>}
        </div>
      </div>
    );
  }

  const empty = !m.content.trim();
  const plain = m.content.replace(/```[\s\S]*?```/g, (b) => b).trim();
  return (
    <div className="group text-e-tx">
      {((empty && m.streaming) || m.reasoning) && <ThinkingChip since={m.ts} active={!!m.streaming && empty && !m.reasoning} reasoning={m.reasoning} thinkMs={m.thinkMs} streaming={m.streaming && empty} />}
      {segs.map((s, i) =>
        s.type === "text" ? (
          s.text.trim() ? <Markdown key={i} source={s.text} streaming={m.streaming} /> : null
        ) : (
          <ToolCard key={i} block={s.block} state={m.tools?.[s.index]} streaming={m.streaming} />
        ),
      )}
      {m.streaming && !empty && <span className="e-caret" />}
      {!m.streaming && m.finish === "length" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-e-line px-4 py-2.5 text-[13.5px]" data-cut>
          <span className="flex-1 text-e-dim">La respuesta se cortó porque alcanzó el límite de longitud.</span>
          {isLast && onContinue && !busy && (
            <button type="button" onClick={onContinue} className="inline-flex items-center gap-1.5 rounded-full bg-e-acc px-3.5 py-1.5 text-[13px] font-medium text-e-bg2">
              <ChevronsDown className="size-4" /> Continuar
            </button>
          )}
        </div>
      )}
      {!m.streaming && !empty && (
        <div className={cn("-ml-1.5 mt-1 flex items-center gap-0.5", !isLast && "md:opacity-0 md:group-hover:opacity-100")}>
          <CopyBtn text={plain} />
          <ActBtn label="Buena respuesta" active={vote === 1} onClick={() => setVote(vote === 1 ? 0 : 1)}><ThumbsUp className="size-4" fill={vote === 1 ? "currentColor" : "none"} /></ActBtn>
          <ActBtn label="Mala respuesta" active={vote === -1} onClick={() => setVote(vote === -1 ? 0 : -1)}><ThumbsDown className="size-4" fill={vote === -1 ? "currentColor" : "none"} /></ActBtn>
          {isLast && onRegenerate && !busy && <ActBtn label="Regenerar" onClick={onRegenerate}><RefreshCw className="size-4" /></ActBtn>}
          {m.usage && (
            <span className="ml-2 text-[12px] tabular-nums text-e-dim" data-usage
              title={`Entrada: ${m.usage.prompt.toLocaleString("es-ES")} · Salida: ${m.usage.completion.toLocaleString("es-ES")}${m.usage.reasoning ? ` (razonamiento ${m.usage.reasoning.toLocaleString("es-ES")})` : ""}`}>
              {m.usage.total.toLocaleString("es-ES")} tokens
            </span>
          )}
        </div>
      )}
    </div>
  );
});
