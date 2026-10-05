import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Plus, Square } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** ChatGPT-style pill composer. "+" uploads a text file into this conversation's sandbox (via onAttach → /api/fs/write). */
export function Composer({ busy, disabled, onSend, onStop, onAttach, draft, centered }: {
  busy: boolean; disabled?: boolean; onSend: (t: string) => void; onStop: () => void;
  onAttach?: (f: File) => void; draft?: { text: string; n: number } | undefined; centered?: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; };
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    requestAnimationFrame(() => { if (ref.current) { grow(ref.current); ref.current.focus(); } });
  }, [draft]);

  const submit = () => {
    if (!text.trim() || busy || disabled) return;
    onSend(text);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className={centered ? "w-full px-4" : "bg-e-bg2 px-3 pb-2 pt-1 sm:px-4"}>
      <div className="e-row mx-auto max-w-3xl items-end">
        <input ref={fileRef} type="file" hidden accept=".txt,.csv,.md,.json,.py,.sh,.html,.xml,.yaml,.yml,.tsv,.log" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach?.(f); e.target.value = ""; }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Añadir archivos" className="e-icon-btn shrink-0 text-e-tx" disabled={disabled}><Plus className="size-5" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="e-pop min-w-56 p-1.5">
            <DropdownMenuItem className="gap-2 rounded-lg px-3 py-2 text-[14px]" onSelect={() => fileRef.current?.click()}>
              <Paperclip className="size-4" /> Subir archivo al sandbox
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={disabled ? "Sin conexión con el puente" : "Pregunta lo que quieras"}
          aria-label="Mensaje"
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={onKey}
          className="max-h-[220px] min-h-[36px] flex-1 resize-none self-center bg-transparent py-1.5 text-[16px] leading-6 text-e-tx outline-none placeholder:text-e-dim"
        />
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Detener" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-e-acc text-e-bg2">
            <Square className="size-3.5" fill="currentColor" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={!text.trim() || disabled} aria-label="Enviar" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-e-acc text-e-bg2 disabled:opacity-30">
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {!centered && <p className="mx-auto mt-2 max-w-3xl text-center text-[12px] text-e-dim">Erasmus puede cometer errores. Comprueba la información importante.</p>}
    </section>
  );
}
