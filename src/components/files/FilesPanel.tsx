import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileCode2, FileImage, FileSpreadsheet, FileText, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import type { WorkspaceFile } from "@/lib/api/types";
import { conversationDir, type UIMessage } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilePreview } from "./FilePreview";
import { collectImages, downloadImage, ImageViewer, type ChatImage } from "@/components/chat/Images";
import { openArtifact } from "@/lib/artifacts";

type Category = "documents" | "tables" | "images" | "code";
const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export function fileCategory(name: string): Category {
  const ext = extension(name);
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? "images" : ["csv", "xlsx", "xls", "tsv"].includes(ext) ? "tables" : ["html", "htm", "js", "jsx", "ts", "tsx", "py", "json", "css", "sh", "sql", "yaml", "yml"].includes(ext) ? "code" : "documents";
}
export function TypeIcon({ name, large = false }: { name: string; large?: boolean }) {
  const category = fileCategory(name);
  const Icon = category === "images" ? FileImage : category === "tables" ? FileSpreadsheet : category === "code" ? FileCode2 : FileText;
  return <Icon className={cn("shrink-0", large ? "size-9" : "size-4", extension(name) === "pdf" ? "text-e-err" : category === "tables" ? "text-e-ok" : category === "code" || category === "images" ? "text-e-info" : "text-e-dim")} />;
}
export async function downloadFile(path: string) {
  try {
    const blob = await api.download(path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = path.split("/").pop() || "archivo";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo descargar el archivo."); }
}
const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const mime: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
type GalleryFile = WorkspaceFile & { localSrc?: string; uploaded: boolean; current: boolean };

function FileCard({ file, onPreview }: { file: GalleryFile; onPreview: (file: GalleryFile, src?: string) => void }) {
  const image = fileCategory(file.name) === "images";
  const [src, setSrc] = useState(file.localSrc);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true; let url: string | undefined;
    setSrc(file.localSrc); setFailed(false);
    if (image && !file.localSrc) void api.download(file.rel_path).then((raw) => {
      if (!alive) return;
      url = URL.createObjectURL(new Blob([raw], { type: mime[extension(file.name)] ?? raw.type }));
      setSrc(url);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [file.rel_path, file.localSrc, file.name, image]);
  return <article className="min-w-0 overflow-hidden rounded-[8px] border border-e-line bg-e-bg2">
    <Button variant="ghost" className="relative flex aspect-[4/3] h-auto w-full rounded-none bg-e-bg3 p-0 [&_svg]:size-9" aria-label={`Previsualizar ${file.name}`} onClick={() => onPreview(file, src)}>
      {image && src && !failed ? <img src={src} alt={file.name} loading="lazy" className="size-full object-contain p-2" onError={() => setFailed(true)} /> : <TypeIcon name={file.name} large />}
      <span className="absolute bottom-2 right-2 rounded bg-e-bg2/90 px-1.5 py-0.5 text-[10px] uppercase text-e-dim">{extension(file.name) || "Archivo"}</span>
    </Button>
    <div className="p-2.5">
      <p className="truncate text-[13px] font-medium" title={file.name}>{file.name}</p>
      <p className="mt-1 text-[11px] tabular-nums text-e-dim">{fmtSize(file.size)}</p>
      <p className="mt-1 truncate text-[10.5px] text-e-dim" title={file.uploaded ? "Subido por ti" : "Generado por Erasmus"}>{file.uploaded ? "Subido por ti" : "Generado por Erasmus"}</p>
      <div className="mt-2 flex justify-end gap-1 border-t border-e-line pt-1.5">
        <Button variant="ghost" size="icon-sm" aria-label={`Abrir ${file.name}`} title="Previsualizar" onClick={() => onPreview(file, src)}><Eye /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Descargar ${file.name}`} title="Descargar" onClick={() => {
          if (file.localSrc && !file.uploaded) { void downloadImage(file.localSrc, file.name); return; }
          if (!file.localSrc || file.rel_path) { void downloadFile(file.rel_path); return; }
          const a = document.createElement("a"); a.href = file.localSrc; a.download = file.name; a.click();
        }}><Download /></Button>
      </div>
    </div>
  </article>;
}

export function FilesPanel({ convId, refreshKey, messages, initialTab = "files", onClose }: { convId: string; refreshKey: unknown; messages: UIMessage[]; initialTab?: "files" | "artifacts"; onClose: () => void }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [tab, setTab] = useState(initialTab);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [scope, setScope] = useState<"current" | "all">("current");
  const [view, setView] = useState<ChatImage | null>(null);
  const [opening, setOpening] = useState(false);
  const mine = conversationDir(convId);
  const load = useCallback(async () => {
    setLoading(true);
    try { setFiles((await api.files()).files); setErr(null); } catch (e) { setErr(e instanceof ApiError ? e.message : "No se pudieron cargar los archivos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { const h = () => void load(); window.addEventListener("erasmus:files-changed", h); return () => window.removeEventListener("erasmus:files-changed", h); }, [load]);
  useEffect(() => { setSel(null); setView(null); }, [convId]);
  useEffect(() => { setTab(initialTab); setSel(null); }, [initialTab]);
  const gallery = useMemo(() => {
    const attachments = messages.filter((m) => m.role === "user" && !m.hidden).flatMap((m) => m.attachments ?? []);
    const content = messages.filter((m) => !m.hidden).map((m) => m.content).join("\n");
    const rows: GalleryFile[] = files.filter((f) => !/^(?:chats|history)\//.test(f.rel_path)).map((f) => ({ ...f,
      uploaded: f.rel_path.startsWith("conversations/"),
      current: f.rel_path.startsWith(`${mine}/`) || attachments.some((a) => a.path === f.rel_path) || content.includes(f.rel_path),
    }));
    for (const a of attachments) {
      const localSrc = a.image || a.url;
      const existing = rows.find((f) => f.rel_path === a.path || f.rel_path === `${mine}/${a.name}`);
      if (existing) { existing.uploaded = true; if (localSrc) existing.localSrc = localSrc; }
      else if (localSrc) rows.push({ name: a.name, rel_path: a.path ?? "", size: a.size, modified: 0, localSrc, uploaded: true, current: true });
    }
    for (const img of collectImages(messages).filter((im) => !im.fromUser)) {
      const name = img.src.split("/").pop()?.split("?")[0] || "imagen.png";
      const existing = rows.find((f) => img.src.endsWith(f.rel_path) && Boolean(f.rel_path));
      if (existing) { existing.current = true; existing.localSrc = img.src; }
      else rows.push({ name: /\.(png|jpe?g|gif|webp|svg)$/i.test(name) ? name : `${name}.png`, rel_path: img.src, size: 0, modified: 0, localSrc: img.src, uploaded: false, current: true });
    }
    return rows;
  }, [files, messages, mine]);
  const artifacts = gallery.filter((f) => f.rel_path.startsWith("artifacts/"));
  const rows = (tab === "artifacts" ? artifacts : gallery).filter((f) => (scope === "all" || f.current) && (filter === "all" || fileCategory(f.name) === filter));
  const preview = async (file: GalleryFile, src?: string) => {
    if (opening) return;
    const ext = extension(file.name);
    if (["html", "htm", "svg"].includes(ext)) {
      setOpening(true);
      try {
        // Unsaved image attachments exist only as browser-owned blob/data URLs.
        const content = !file.rel_path && file.localSrc && /^(blob:|data:image\/)/.test(file.localSrc)
          ? await (await fetch(file.localSrc)).text()
          : (await api.fsRead(file.rel_path)).content;
        openArtifact(content, ext === "svg" ? "svg" : "html");
      }
      catch (e) { toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el archivo."); }
      finally { setOpening(false); }
    } else if (fileCategory(file.name) === "images" && src) setView({ src, alt: file.name, fromUser: file.uploaded });
    else setSel(file.rel_path);
  };
  return <aside className="fixed inset-0 z-40 flex flex-col border-l border-e-line bg-e-bg md:static md:inset-auto md:z-auto md:w-full md:min-w-0 md:flex-1" aria-label="Archivos">
    <div className="flex h-14 shrink-0 items-center gap-1 border-b border-e-line px-3">
      <div role="tablist" aria-label="Archivos del espacio" className="flex min-w-0 gap-1">
        {(["files", "artifacts"] as const).map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant="ghost" size="sm" onClick={() => { setTab(t); setSel(null); }} className={cn("rounded-full", tab === t && "bg-e-bg3 text-e-tx")}>{t === "files" ? "Archivos" : `Resultados (${artifacts.length})`}</Button>)}
      </div>
      <span className="flex-1" />
      <Button variant="ghost" size="icon-sm" aria-label="Actualizar archivos" title="Actualizar" onClick={() => void load()}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Cerrar panel" title="Cerrar panel" onClick={onClose}><X /></Button>
    </div>
    {err && <div role="alert" className="e-err-banner m-3 px-3 py-2 text-[12.5px]">{err}</div>}
    {sel ? <FilePreview path={sel} artifact={tab === "artifacts"} onBack={() => setSel(null)} /> : <>
      <div className="space-y-3 border-b border-e-line p-3">
        <div className="flex rounded-lg bg-e-bg3 p-0.5" role="group" aria-label="Ámbito de archivos">
          {(["current", "all"] as const).map((s) => <Button key={s} variant="ghost" size="sm" aria-pressed={scope === s} className={cn("min-w-0 flex-1 px-2 text-[12px]", scope === s && "bg-e-bg2 shadow-row")} onClick={() => setScope(s)}>{s === "current" ? "Esta conversación" : "Todo el espacio"}</Button>)}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Tipo de archivo">
          {([["all", "Todos"], ["documents", "Documentos"], ["tables", "Tablas"], ["images", "Imágenes"], ["code", "Código"]] as const).map(([f, label]) => <Button key={f} variant="ghost" size="sm" aria-pressed={filter === f} className={cn("h-7 rounded-full px-2 text-[11px]", filter === f ? "bg-e-acc text-e-bg2 hover:bg-e-acc hover:text-e-bg2" : "text-e-dim")} onClick={() => setFilter(f)}>{label}</Button>)}
        </div>
      </div>
      {opening && <p role="status" className="flex items-center gap-2 px-3 py-2 text-[12px] text-e-dim"><Loader2 className="size-3 animate-spin" /> Abriendo vista previa…</p>}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && !gallery.length ? <p role="status" className="py-8 text-center text-[13px] text-e-dim">Cargando archivos…</p> : rows.length ? <div className="grid grid-cols-2 gap-2.5">{rows.map((file) => <FileCard key={file.rel_path || file.name} file={file} onPreview={(f, src) => void preview(f, src)} />)}</div> : <p className="py-10 text-center text-[13px] text-e-dim">No hay archivos en esta selección.</p>}
      </div>
    </>}
    {view && <ImageViewer img={view} onClose={() => setView(null)} />}
  </aside>;
}
