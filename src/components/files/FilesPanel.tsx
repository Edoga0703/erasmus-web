import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, ChevronDown, ChevronRight, Download, FileCode2, FileImage, FileSpreadsheet, FileText, Folder, Loader2, RefreshCw, X } from "lucide-react";

/** Colored type icon (ChatGPT sources style). */
export function TypeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const [Icon, color] = ext === "pdf" ? [FileText, "text-e-err"] : ["csv", "xlsx", "tsv"].includes(ext) ? [FileSpreadsheet, "text-e-ok"] : ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext) ? [FileImage, "text-e-info"] : ["py", "sh", "js", "ts", "html", "json", "css"].includes(ext) ? [FileCode2, "text-e-info"] : [FileText, "text-e-dim"];
  return <Icon className={"size-4 shrink-0 " + color} />;
}
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import type { WorkspaceFile } from "@/lib/api/types";
import { conversationDir } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { FilePreview } from "./FilePreview";
import type { UIMessage } from "@/hooks/use-chat";
import { allActivity } from "@/lib/activity";

interface Node { name: string; path: string; dir: boolean; size: number; children: Node[] }

function buildTree(files: WorkspaceFile[]): Node {
  const root: Node = { name: "", path: "", dir: true, size: 0, children: [] };
  for (const f of files) {
    const parts = f.rel_path.split("/").filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const leaf = i === parts.length - 1;
      let n = cur.children.find((c) => c.name === part);
      if (!n) { n = { name: part, path, dir: !leaf, size: leaf ? f.size : 0, children: [] }; cur.children.push(n); }
      cur = n;
    });
  }
  const sort = (n: Node) => { n.children.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)); n.children.forEach(sort); };
  sort(root);
  return root;
}

export async function downloadFile(path: string) {
  try {
    const blob = await api.download(path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "archivo";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "No se pudo descargar el archivo.");
  }
}

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

function TreeRow({ n, depth, open, toggle, sel, onSelect, highlight }: { n: Node; depth: number; open: Set<string>; toggle: (p: string) => void; sel: string | null; onSelect: (p: string) => void; highlight: string }) {
  const isOpen = open.has(n.path);
  const mine = n.path === highlight;
  return (
    <>
      <div
        className={cn("group flex items-center gap-1.5 rounded-md py-1 pr-1 text-[13px] hover:bg-e-bg3", sel === n.path && "bg-e-bg3")}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => (n.dir ? toggle(n.path) : onSelect(n.path))}>
          {n.dir ? (isOpen ? <ChevronDown className="size-3.5 shrink-0 text-e-dim" /> : <ChevronRight className="size-3.5 shrink-0 text-e-dim" />) : <span className="w-3.5 shrink-0" />}
          {n.dir ? <Folder className="size-3.5 shrink-0 text-e-dim" /> : <TypeIcon name={n.name} />}
          <span className="truncate">{n.name}</span>
          {mine && <span className="shrink-0 rounded bg-e-bg4 px-1.5 text-[10px] text-e-dim">esta conversación</span>}
          {!n.dir && <span className="ml-auto shrink-0 pl-2 text-[11px] text-e-dim">{fmtSize(n.size)}</span>}
        </button>
        {!n.dir && (
          <button className="e-icon-btn shrink-0" aria-label={`Descargar ${n.name}`} onClick={() => void downloadFile(n.path)}>
            <Download className="size-3.5" />
          </button>
        )}
      </div>
      {n.dir && isOpen && n.children.map((c) => <TreeRow key={c.path} n={c} depth={depth + 1} open={open} toggle={toggle} sel={sel} onSelect={onSelect} highlight={highlight} />)}
    </>
  );
}

export function FilesPanel({ convId, refreshKey, messages, initialTab = "files", onClose }: { convId: string; refreshKey: unknown; messages: UIMessage[]; initialTab?: "activity" | "files" | "artifacts"; onClose: () => void }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [tab, setTab] = useState<"activity" | "files" | "artifacts">(initialTab);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mine = conversationDir(convId);
  const [open, setOpen] = useState<Set<string>>(() => new Set(["conversations", mine]));

  const load = useCallback(async () => {
    try { setFiles((await api.files()).files); setErr(null); } catch (e) { setErr(e instanceof ApiError ? e.message : "No se pudo cargar el workspace."); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener("erasmus:files-changed", h);
    return () => window.removeEventListener("erasmus:files-changed", h);
  }, [load]);
  useEffect(() => { setOpen(new Set(["conversations", mine])); setSel(null); }, [mine]);
  useEffect(() => setTab(initialTab), [initialTab]);

  const tree = useMemo(() => {
    const t = buildTree(files);
    // A new chat gets a visible, empty workspace folder before its first file is created.
    let conversations = t.children.find((c) => c.name === "conversations");
    if (!conversations) { conversations = { name: "conversations", path: "conversations", dir: true, size: 0, children: [] }; t.children.push(conversations); t.children.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)); }
    if (!conversations.children.some((c) => c.path === mine)) conversations.children.unshift({ name: mine.split("/").pop() ?? "", path: mine, dir: true, size: 0, children: [] });
    return t;
  }, [files, mine]);
  const artifacts = useMemo(() => files.filter((f) => f.rel_path.startsWith("artifacts/")), [files]);
  const activity = useMemo(() => allActivity(messages), [messages]);
  const toggle = (p: string) => setOpen((o) => { const n = new Set(o); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  return (
    <aside className="fixed inset-0 z-40 flex flex-col border-l border-e-line bg-e-bg md:static md:inset-auto md:z-auto md:w-full md:min-w-0 md:flex-1" aria-label="Archivos">
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-e-line px-3">
        {(["activity", "files", "artifacts"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSel(null); }} className={cn("rounded-full px-3 py-1.5 text-[14px]", tab === t ? "bg-e-bg3 text-e-tx" : "text-e-dim hover:text-e-tx")}>
            {t === "activity" ? "Actividad" : t === "files" ? "Archivos" : `Resultados (${artifacts.length})`}
          </button>
        ))}
        <span className="flex-1" />
        <button className="e-icon-btn" aria-label="Actualizar" onClick={() => void load()}><RefreshCw className="size-3.5" /></button>
        <button className="e-icon-btn" aria-label="Cerrar panel" onClick={onClose}><X className="size-3.5" /></button>
      </div>
      {err && <div className="e-err-banner m-3 px-3 py-2 text-[12.5px]">{err}</div>}
      {sel ? (
        <FilePreview path={sel} artifact={tab === "artifacts"} onBack={() => setSel(null)} />
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {tab === "activity" ? (
            activity.length ? activity.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 border-b border-e-line px-2 py-3 last:border-0">
                {item.status === "running" ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-e-info" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-e-ok" />}
                <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{item.label}</p>{item.target && <p className="mt-0.5 truncate font-mono text-[11.5px] text-e-dim">{item.target}</p>}</div>
                {item.durationMs > 0 && <span className="shrink-0 text-[11px] tabular-nums text-e-dim">{(item.durationMs / 1000).toFixed(1)} s</span>}
              </div>
            )) : <div className="grid min-h-48 place-items-center px-6 text-center"><div><Activity className="mx-auto mb-3 size-5 text-e-dim" /><p className="text-[13px] text-e-dim">La actividad aparecerá aquí cuando Erasmus trabaje con archivos o tareas.</p></div></div>
          ) : tab === "files" ? (
            tree.children.length ? tree.children.map((c) => <TreeRow key={c.path} n={c} depth={0} open={open} toggle={toggle} sel={sel} onSelect={setSel} highlight={mine} />) : <p className="p-3 text-[13px] text-e-dim">El workspace está vacío.</p>
          ) : artifacts.length ? (
            artifacts.map((f) => (
              <div key={f.rel_path} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-e-bg3">
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSel(f.rel_path)}>
                  <TypeIcon name={f.name} />
                  <span className="truncate">{f.rel_path.slice("artifacts/".length)}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-e-dim">{fmtSize(f.size)}</span>
                </button>
                <button className="e-icon-btn shrink-0" aria-label={`Descargar ${f.name}`} onClick={() => void downloadFile(f.rel_path)}><Download className="size-3.5" /></button>
              </div>
            ))
          ) : (
            <p className="p-3 text-[13px] text-e-dim">Aún no hay artifacts.</p>
          )}
        </div>
      )}
    </aside>
  );
}
