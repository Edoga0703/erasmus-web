import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Brain, Check, Paperclip, Plus, Square } from "lucide-react";
import { getModelConfig, saveModelConfig, type ReasoningEffort } from "@/lib/api/config";

const EFFORTS: [ReasoningEffort, string, string][] = [["none", "Sin razonamiento", "Respuesta inmediata"], ["low", "Bajo", "Rápido, piensa poco"], ["medium", "Medio", "Equilibrado (predeterminado)"], ["high", "Alto", "Piensa más a fondo"]];

/** Reasoning level pill (reasoning_effort on every completion), persisted with the model config. */
function ReasoningPicker({ disabled }: { disabled?: boolean | undefined }) {
  const [v, setV] = useState<ReasoningEffort>("medium");
  useEffect(() => {
    const sync = () => setV(getModelConfig().reasoning);
    sync();
    window.addEventListener("erasmus:model-config", sync);
    return () => window.removeEventListener("erasmus:model-config", sync);
  }, []);
  const label = EFFORTS.find((e) => e[0] === v)?.[1] ?? "Medio";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" type="button" disabled={disabled} aria-label={`Nivel de razonamiento: ${label}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] text-e-dim hover:bg-e-bg3 hover:text-e-tx">
          <Brain className="size-4" /><span>{v === "none" ? "Sin razonar" : label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="e-pop min-w-64 p-1.5">
        <div className="px-3 pb-1 pt-1.5 text-[12px] font-medium text-e-dim">Nivel de razonamiento</div>
        {EFFORTS.map(([id, l, d]) => (
          <DropdownMenuItem key={id} className="gap-3 rounded-lg px-3 py-2" onSelect={() => saveModelConfig({ ...getModelConfig(), reasoning: id })}>
            <span className="flex-1"><span className="block text-[14px]">{l}</span><span className="block text-[12px] text-e-dim">{d}</span></span>
            {v === id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
import { Button } from "@/components/ui/button";
import { AttachChip } from "./AttachChip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** ChatGPT-style pill composer. "+" queues photos/files shown as tiles; the shell uploads them on send. */
export function Composer({ busy, disabled, onSend, onStop, draft, centered }: {
  busy: boolean; disabled?: boolean; onSend: (t: string, files: File[]) => void; onStop: () => void;
  draft?: { text: string; n: number } | undefined; centered?: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ f: File; url?: string | undefined }[]>([]);
  const queuedFiles = useRef<typeof files>([]);
  const [fileNotice, setFileNotice] = useState("");
  useEffect(() => () => queuedFiles.current.forEach((x) => { if (x.url) URL.revokeObjectURL(x.url); }), []);
  const addFiles = (list: FileList | null) => {
    if (!list || disabled || busy) return;
    const incoming = Array.from(list);
    const available = Math.max(0, 20 - queuedFiles.current.length);
    const accepted = incoming.slice(0, available).map((f) => ({ f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined }));
    const discarded = incoming.length - accepted.length;
    queuedFiles.current = [...queuedFiles.current, ...accepted];
    setFiles(queuedFiles.current);
    setFileNotice(discarded ? `Puedes añadir hasta 20 archivos por mensaje. Se ${discarded === 1 ? "descartó 1 archivo" : `descartaron ${discarded} archivos`} adicionales; los que ya habías añadido se mantienen.` : "");
    ref.current?.focus();
  };
  const removeFile = (i: number) => {
    const x = queuedFiles.current[i];
    if (x?.url) URL.revokeObjectURL(x.url);
    queuedFiles.current = queuedFiles.current.filter((_, j) => j !== i);
    setFiles(queuedFiles.current);
  };
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; };
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    requestAnimationFrame(() => { if (ref.current) { grow(ref.current); ref.current.focus(); } });
  }, [draft]);

  const submit = () => {
    if ((!text.trim() && !files.length) || busy || disabled) return;
    onSend(text, files.map((x) => x.f));
    setText("");
    queuedFiles.current.forEach((x) => { if (x.url) URL.revokeObjectURL(x.url); });
    queuedFiles.current = [];
    setFiles([]);
    setFileNotice("");
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
      <div className={"e-row mx-auto max-w-3xl flex-wrap items-end" + (files.length ? " pt-3" : "")}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}>
        {files.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 px-1 pb-2">
            {files.map((x, i) => <AttachChip key={i + x.f.name} a={{ name: x.f.name, size: x.f.size, url: x.url }} onRemove={() => removeFile(i)} />)}
          </div>
        )}
        <input ref={fileRef} type="file" hidden multiple accept="image/*,.txt,.csv,.md,.json,.py,.sh,.html,.xml,.yaml,.yml,.tsv,.log,.pdf" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" type="button" aria-label="Añadir archivos" className="e-icon-btn shrink-0 text-e-tx" disabled={disabled}><Plus className="size-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="e-pop min-w-56 p-1.5">
            <DropdownMenuItem className="gap-2 rounded-lg px-3 py-2 text-[14px]" onSelect={() => fileRef.current?.click()}>
              <Paperclip className="size-4" /> Añadir fotos y archivos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ReasoningPicker disabled={disabled} />
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={disabled ? "Sin conexión con Erasmus" : "Pregunta lo que quieras"}
          aria-label="Mensaje"
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={onKey}
          className="max-h-[220px] min-h-[36px] flex-1 resize-none self-center bg-transparent py-1.5 text-[16px] leading-6 text-e-tx outline-none placeholder:text-e-dim"
        />
        {busy ? (
          <Button variant="ghost" type="button" onClick={onStop} aria-label="Detener" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-e-acc text-e-bg2">
            <Square className="size-3.5" fill="currentColor" />
          </Button>
        ) : (
          <Button variant="ghost" type="button" onClick={submit} disabled={(!text.trim() && !files.length) || disabled} aria-label="Enviar" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-e-acc text-e-bg2 disabled:opacity-30">
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </Button>
        )}
      </div>
      {fileNotice && <p role="status" className="mx-auto mt-2 max-w-3xl text-[12px] leading-5 text-e-dim">{fileNotice}</p>}
      {!centered && <p className="mx-auto mt-2 max-w-3xl text-center text-[12px] text-e-dim">Erasmus puede cometer errores. Comprueba la información importante.</p>}
    </section>
  );
}
