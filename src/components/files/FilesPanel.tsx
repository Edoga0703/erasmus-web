import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText, Folder, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import type { WorkspaceFile } from "@/lib/api/types";
import { sandboxDir } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { FilePreview } from "./FilePreview";

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
          {n.dir ? <Folder className="size-3.5 shrink-0 text-e-dim" /> : <FileText className="size-3.5 shrink-0 text-e-dim" />}
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

export function FilesPanel({ convId, refreshKey, onClose }: { convId: string; refreshKey: unknown; onClose: () => void }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [tab, setTab] = useState<"files" | "artifacts">("files");
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mine = sandboxDir(convId);
  const [open, setOpen] = useState<Set<string>>(() => new Set(["sandbox", mine]));

  const load = useCallback(async () => {
    try { setFiles((await api.files()).files); setErr(null); } catch (e) { setErr(e instanceof ApiError ? e.message : "No se pudo cargar el workspace."); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { setOpen(new Set(["sandbox", mine])); setSel(null); }, [mine]);

  const tree = useMemo(() => buildTree(files), [files]);
  const artifacts = useMemo(() => files.filter((f) => f.rel_path.startsWith("artifacts/")), [files]);
  const toggle = (p: string) => setOpen((o) => { const n = new Set(o); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  return (
    <aside className="fixed inset-0 z-40 flex flex-col border-l border-e-line bg-e-bg md:static md:inset-auto md:z-auto md:w-art md:shrink-0" aria-label="Archivos">
      <div className="flex h-top shrink-0 items-center gap-1 border-b border-e-line px-3">
        {(["files", "artifacts"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSel(null); }} className={cn("rounded-md px-2.5 py-1 text-[13px]", tab === t ? "bg-e-bg3 text-e-tx" : "text-e-dim hover:text-e-tx")}>
            {t === "files" ? "Archivos" : `Artifacts (${artifacts.length})`}
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
          {tab === "files" ? (
            tree.children.length ? tree.children.map((c) => <TreeRow key={c.path} n={c} depth={0} open={open} toggle={toggle} sel={sel} onSelect={setSel} highlight={mine} />) : <p className="p-3 text-[13px] text-e-dim">El workspace está vacío.</p>
          ) : artifacts.length ? (
            artifacts.map((f) => (
              <div key={f.rel_path} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-e-bg3">
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSel(f.rel_path)}>
                  <FileText className="size-3.5 shrink-0 text-e-dim" />
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
