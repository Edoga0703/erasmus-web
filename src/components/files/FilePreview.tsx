import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { highlight } from "@/lib/markdown";
import { downloadFile } from "./FilesPanel";

const ext = (p: string) => p.split(".").pop()?.toLowerCase() ?? "";
const IMG = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const LANG: Record<string, string> = { py: "python", ts: "typescript", tsx: "typescript", js: "javascript", json: "json", sh: "bash", md: "markdown", html: "xml", css: "css", csv: "plaintext", txt: "plaintext", yml: "yaml", yaml: "yaml", sql: "sql" };
const IMG_MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

type View = { kind: "loading" } | { kind: "error"; msg: string } | { kind: "text"; html: string } | { kind: "html"; src: string } | { kind: "blob"; url: string; type: "img" | "pdf" };

/** Text/code (highlighted), image, PDF; HTML artifacts in an iframe with sandbox="allow-scripts allow-popups" (no same-origin). */
export function FilePreview({ path, artifact, onBack }: { path: string; artifact: boolean; onBack: () => void }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    const e = ext(path);
    setView({ kind: "loading" });
    void (async () => {
      try {
        if (IMG.has(e) || e === "pdf") {
          const raw = await api.download(path);
          const blob = new Blob([raw], { type: e === "pdf" ? "application/pdf" : IMG_MIME[e] ?? raw.type });
          url = URL.createObjectURL(blob);
          if (alive) setView({ kind: "blob", url, type: e === "pdf" ? "pdf" : "img" });
          return;
        }
        const r = await api.fsRead(path);
        if (!alive) return;
        if (e === "html" || e === "htm") setView({ kind: "html", src: r.content });
        else setView({ kind: "text", html: highlight(r.content, LANG[e]) });
      } catch (err) {
        if (alive) setView({ kind: "error", msg: err instanceof ApiError ? err.message : "No se pudo abrir el archivo." });
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-e-line px-3 py-2">
        <button className="e-icon-btn" aria-label="Volver" onClick={onBack}><ArrowLeft className="size-3.5" /></button>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={path}>{artifact ? path.replace(/^artifacts\//, "") : path}</span>
        <button className="inline-flex items-center gap-1 rounded-md border border-e-line px-2 py-1 text-[12px] hover:bg-e-bg3" onClick={() => void downloadFile(path)}>
          <Download className="size-3.5" /> Descargar
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view.kind === "loading" && <p className="p-4 text-[13px] text-e-dim">Cargando…</p>}
        {view.kind === "error" && <div className="e-err-banner m-3 px-3 py-2 text-[12.5px]">{view.msg}</div>}
        {view.kind === "text" && <pre className="hljs m-0 min-h-full whitespace-pre-wrap break-words p-3 font-mono text-[12px]" dangerouslySetInnerHTML={{ __html: view.html }} />}
        {view.kind === "html" && <iframe title={path} sandbox="allow-scripts allow-popups" srcDoc={view.src} className="e-frame h-full min-h-[60vh] w-full border-0" />}
        {view.kind === "blob" && view.type === "img" && <div className="flex justify-center p-4"><img src={view.url} alt={path} className="max-h-[70vh] max-w-full object-contain" /></div>}
        {view.kind === "blob" && view.type === "pdf" && (typeof navigator !== "undefined" && navigator.pdfViewerEnabled ? (
          <iframe title={path} src={view.url} className="h-full min-h-[70vh] w-full border-0" />
        ) : (
          // Mobile browsers (and headless) have no inline PDF viewer: offer open/download instead of a blank frame.
          <div className="flex flex-col items-center gap-3 p-8 text-center text-[13px] text-e-dim" data-pdf-fallback="">
            <p>Este navegador no muestra PDF dentro de la página.</p>
            <div className="flex gap-2">
              <a href={view.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-e-line px-3 py-1.5 text-e-tx hover:bg-e-bg3">Abrir PDF</a>
              <button className="rounded-md border border-e-line px-3 py-1.5 text-e-tx hover:bg-e-bg3" onClick={() => void downloadFile(path)}>Descargar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
