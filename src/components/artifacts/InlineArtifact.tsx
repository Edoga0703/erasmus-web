import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARTIFACT_SANDBOX, artifactDocument, artifactTabDocument, extractArtifactTitle, openArtifact } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

export function InlineArtifact({ code, lang, wrap }: { code: string; lang: string; wrap: HTMLElement }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const title = useMemo(() => extractArtifactTitle(code, lang), [code, lang]);
  const doc = useMemo(() => artifactDocument({ title, code, lang }), [title, code, lang]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useLayoutEffect(() => {
    wrap.style.display = tab === "preview" ? "none" : "";
    wrap.id = `${id}-code`;
    wrap.setAttribute("role", "tabpanel");
    wrap.setAttribute("aria-labelledby", `${id}-tab-code`);
    return () => {
      wrap.style.display = "";
      wrap.removeAttribute("id");
      wrap.removeAttribute("role");
      wrap.removeAttribute("aria-labelledby");
    };
  }, [tab, wrap, id]);
  useEffect(() => {
    const resources = urls.current;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      resources.forEach((timeout, url) => { clearTimeout(timeout); URL.revokeObjectURL(url); });
      resources.clear();
    };
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true); setError("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError("No se pudo copiar el código."); }
  };
  const openTab = () => {
    const url = URL.createObjectURL(new Blob([artifactTabDocument(doc)], { type: "text/html;charset=utf-8" }));
    urls.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 60_000));
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-e-line bg-e-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-e-line px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-e-tx" title={title}>{title}</span>
        <span className="shrink-0 rounded border border-e-line px-1.5 py-0.5 font-mono text-[11px] text-e-dim">{lang.toUpperCase()}</span>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Abrir en panel lateral" title="Abrir en panel lateral" onClick={() => openArtifact(code, lang, title)}><PanelRightOpen className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Nueva pestaña" title="Nueva pestaña" onClick={openTab}><ExternalLink className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label={copied ? "Copiado" : "Copiar"} title={copied ? "Copiado" : "Copiar"} onClick={() => void copy()}>{copied ? <Check className="size-4 text-e-ok" /> : <Copy className="size-4" />}</Button>
        </div>
        <div role="tablist" aria-label={`Contenido de ${title}`} className="flex w-full gap-1 rounded-full bg-e-bg3 p-1">
          {([['preview', 'Vista previa'], ['code', 'Código']] as const).map(([value, label]) => <Button key={value} id={`${id}-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${id}-${value}`} variant="ghost" size="sm" className={cn("h-7 flex-1 rounded-full text-xs", tab === value && "bg-e-bg2 text-e-tx")} onClick={() => setTab(value)}>{label}</Button>)}
        </div>
      </div>
      <span role="status" className="sr-only">{copied ? "Copiado" : ""}</span>
      {error && <p role="alert" className="px-3 py-2 text-xs text-e-err">{error}</p>}
      <div id={`${id}-preview`} role="tabpanel" aria-labelledby={`${id}-tab-preview`} hidden={tab !== "preview"}>
        {/* Keep the static wrapper: direct srcDoc inherits the app CSP and blocks Tailwind in production. */}
        <iframe key={doc} title={`Vista previa: ${title}`} sandbox={ARTIFACT_SANDBOX} referrerPolicy="no-referrer" src="/artifact-preview.html" onLoad={(event) => event.currentTarget.contentWindow?.postMessage({ type: "erasmus:artifact-document", document: doc }, "*")} className="e-frame h-[440px] w-full rounded-b-2xl border-0" />
      </div>
    </div>
  );
}