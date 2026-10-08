import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Code2, Copy, Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARTIFACT_SANDBOX, artifactDocument, artifactTabDocument, type Artifact } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

export function ArtifactPanel({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const doc = useMemo(() => artifactDocument(artifact), [artifact]);
  useEffect(() => {
    setTab("preview"); setCopied(false); setError("");
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, [artifact]);
  useEffect(() => {
    const resources = urls.current;
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      resources.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
      resources.clear();
    };
  }, []);
  const makeUrl = (text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    urls.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 60_000));
    return url;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true); setError("");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError("No se pudo copiar el código."); }
  };
  const download = () => {
    const svg = artifact.lang === "svg";
    const a = document.createElement("a");
    a.href = makeUrl(artifact.code, svg ? "image/svg+xml;charset=utf-8" : "text/html;charset=utf-8");
    a.download = `${artifact.title.replace(/[^\p{L}\p{N}._-]+/gu, "-") || "artefacto"}.${svg ? "svg" : "html"}`;
    document.body.append(a); a.click(); a.remove();
  };
  return (
    <section aria-label="Panel de artefacto" className="flex h-full min-h-0 min-w-0 flex-col bg-e-bg2 text-e-tx">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-e-line px-3 py-2">
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onClose} aria-label="Volver al chat" title="Volver al chat"><ArrowLeft className="size-4" /></Button>
        <Code2 className="hidden size-4 shrink-0 text-e-dim md:block" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium" title={artifact.title}>{artifact.title}</h2>
        <span className="shrink-0 rounded border border-e-line px-1.5 py-0.5 font-mono text-[11px] text-e-dim">{artifact.lang.toUpperCase()}</span>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Cerrar vista previa" title="Cerrar vista previa"><X className="size-4" /></Button>
      </header>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-e-line px-3 py-2">
        <div role="tablist" aria-label="Contenido del artefacto" className="flex gap-1">
          {([['preview', 'Vista previa'], ['code', 'Código']] as const).map(([value, label]) => <Button key={value} id={`artifact-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`artifact-${value}`} variant="ghost" size="sm" className={cn("h-8 rounded-md px-2 text-xs", tab === value && "bg-e-bg3")} onClick={() => setTab(value)}>{label}</Button>)}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => void copy()} aria-label={copied ? "Copiado" : "Copiar código"} title={copied ? "Copiado" : "Copiar código"}>{copied ? <Check className="size-4 text-e-ok" /> : <Copy className="size-4" />}</Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={download} aria-label="Descargar archivo" title="Descargar archivo"><Download className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => { window.open(makeUrl(artifactTabDocument(doc), "text/html;charset=utf-8"), "_blank", "noopener,noreferrer"); }} aria-label="Abrir en nueva pestaña" title="Abrir en nueva pestaña"><ExternalLink className="size-4" /></Button>
        </div>
      </div>
      <span className="sr-only" role="status">{copied ? "Copiado" : ""}</span>
      {error && <p role="alert" className="px-3 py-2 text-xs text-e-err">{error}</p>}
      <div id="artifact-preview" role="tabpanel" aria-labelledby="artifact-tab-preview" hidden={tab !== "preview"} className="min-h-0 flex-1">
        <iframe title="Vista previa del artefacto" sandbox={ARTIFACT_SANDBOX} referrerPolicy="no-referrer" srcDoc={doc} className="e-frame h-full w-full border-0" />
      </div>
      <div id="artifact-code" role="tabpanel" aria-labelledby="artifact-tab-code" hidden={tab !== "code"} className="min-h-0 flex-1 overflow-auto bg-e-bg">
        <pre className="m-0 min-w-full w-max py-4 font-mono text-xs leading-6"><code>{artifact.code.split("\n").map((line, i) => <span key={i} className="flex min-h-6"><span aria-hidden="true" className="sticky left-0 w-12 shrink-0 select-none bg-e-bg pr-3 text-right text-e-dim">{i + 1}</span><span className="pr-4">{line || "\u200b"}</span>{"\n"}</span>)}</code></pre>
      </div>
    </section>
  );
}