import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Brain, Check, Palette, Paperclip, Plus, Square, X } from "lucide-react";
import { getModelConfig, saveModelConfig, type ReasoningEffort } from "@/lib/api/config";
import { cleanImagePrompt, IMAGE_SIZES, type ImageSize } from "@/lib/images";

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
export function Composer({ busy, disabled, onSend, onStop, onGenerateImage, draft, centered }: {
  busy: boolean; disabled?: boolean; onSend: (t: string, files: File[]) => void; onStop: () => void;
  onGenerateImage?: (prompt: string, size: ImageSize) => void;
  draft?: { text: string; n: number } | undefined; centered?: boolean;
}) {
  const [text, setText] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024");
  const imageCommand = /^\/(?:imagen|image)(?:\s|$)/i.test(text.trim());
  const generating = Boolean(onGenerateImage && (imageMode || imageCommand));
  const [files, setFiles] = useState<{ f: File; url?: string | undefined }[]>([]);
  const validText = generating ? Boolean(cleanImagePrompt(text)) && files.length === 0 : Boolean(text.trim());
  const queuedFiles = useRef<typeof files>([]);
  const [fileNotice, setFileNotice] = useState("");
  useEffect(() => () => queuedFiles.current.forEach((x) => { if (x.url) URL.revokeObjectURL(x.url); }), []);
  const addFiles = (list: FileList | null) => {
    if (!list || disabled || busy) return;
    if (generating) { setFileNotice("Vuelve al chat para añadir archivos; los adjuntos actuales se mantienen."); return; }
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
    if ((generating ? !validText : !validText && !files.length) || busy || disabled) return;
    if (generating && onGenerateImage) onGenerateImage(cleanImagePrompt(text), imageSize);
    else onSend(text, files.map((x) => x.f));
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
        {generating && <div className="flex w-full flex-wrap items-center gap-1 px-1 pb-2">
          <span className="flex items-center gap-1.5 text-[13px] text-e-info"><Palette className="size-4" /> Modo Imagen</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" disabled={busy || disabled} aria-label="Formato de imagen" className="h-8 rounded-full text-[12px]">{IMAGE_SIZES.find((s) => s.value === imageSize)?.label}</Button></DropdownMenuTrigger>
            <DropdownMenuContent className="e-pop" side="top">{IMAGE_SIZES.map((s) => <DropdownMenuItem key={s.value} onSelect={() => setImageSize(s.value)}>{s.label}{imageSize === s.value && <Check className="ml-auto size-4" />}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" aria-label="Salir del modo imagen" title="Volver al chat" onClick={() => { setImageMode(false); if (imageCommand) setText(cleanImagePrompt(text)); setFileNotice(""); }}><X /></Button>
          {files.length > 0 && <p role="status" className="w-full text-[12px] text-e-dim">Los adjuntos se mantienen. Vuelve al chat para enviarlos.</p>}
        </div>}
        {files.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 px-1 pb-2">
            {files.map((x, i) => <AttachChip key={i + x.f.name} a={{ name: x.f.name, size: x.f.size, url: x.url }} onRemove={() => removeFile(i)} />)}
          </div>
        )}
        <input ref={fileRef} type="file" hidden multiple accept="image/*,.txt,.csv,.md,.json,.py,.sh,.html,.xml,.yaml,.yml,.tsv,.log,.pdf,.xlsx,.xls,.zip" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" type="button" aria-label="Añadir archivos" className="e-icon-btn shrink-0 text-e-tx" disabled={disabled || busy}><Plus className="size-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="e-pop min-w-56 p-1.5">
            <DropdownMenuItem disabled={generating} className="gap-2 rounded-lg px-3 py-2 text-[14px]" onSelect={() => fileRef.current?.click()}>
              <Paperclip className="size-4" /> Añadir fotos y archivos
            </DropdownMenuItem>
            {onGenerateImage && <DropdownMenuItem className="gap-2 rounded-lg px-3 py-2 text-[14px]" onSelect={() => { setImageMode(true); requestAnimationFrame(() => ref.current?.focus()); }}><Palette className="size-4" /> Crear imagen con IA</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        {!generating && <ReasoningPicker disabled={disabled || busy} />}
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={disabled ? "Sin conexión con Erasmus" : generating ? "Describe la imagen que deseas que Erasmus genere..." : "Pregunta lo que quieras"}
          aria-label="Mensaje"
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={onKey}
          className="max-h-[220px] min-h-[36px] min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[16px] leading-6 text-e-tx outline-none placeholder:text-e-dim"
        />
        {busy ? (
          <Button variant="ghost" type="button" onClick={onStop} aria-label="Detener" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-e-acc text-e-bg2">
            <Square className="size-3.5" fill="currentColor" />
          </Button>
        ) : (
          <Button variant="ghost" type="button" onClick={submit} disabled={(generating ? !validText : !validText && !files.length) || disabled} aria-label="Enviar" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-e-acc text-e-bg2 disabled:opacity-30">
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </Button>
        )}
      </div>
      {fileNotice && <p role="status" className="mx-auto mt-2 max-w-3xl text-[12px] leading-5 text-e-dim">{fileNotice}</p>}
      {!centered && <p className="mx-auto mt-2 max-w-3xl text-center text-[12px] text-e-dim">Erasmus puede cometer errores. Comprueba la información importante.</p>}
    </section>
  );
}
