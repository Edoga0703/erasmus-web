import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Moon, RefreshCw, ShieldCheck, ShieldOff, Sun, WifiOff, X } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { API_BASE, MOCK, getToken } from "@/lib/api/config";
import type { StatusResponse } from "@/lib/api/types";
import { setTheme, useTheme } from "@/lib/theme";
import { downloadFile } from "@/components/files/FilesPanel";
import { cn } from "@/lib/utils";
import { ModelSettings } from "./ModelSettings";
import pkg from "../../../package.json";

export const APP_VERSION = "Erasmus Web v0.1.0";

type Probe = { kind: "idle" } | { kind: "checking" } | { kind: "ok"; ms: number; s: StatusResponse } | { kind: "error"; msg: string };
type Counts = { chats: number; files: number; workspace: string } | null;

const TABS = [["general", "General"], ["model", "Modelo y API"], ["bridge", "Estado"], ["data", "Datos"], ["security", "Seguridad"], ["about", "Acerca de"]] as const;
type Tab = (typeof TABS)[number][0];

/** Settings modal. Rendered on top of the shell; never unmounts the chat, so chat state survives open/close. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("general");
  const [mobileDetail, setMobileDetail] = useState(false);
  const theme = useTheme();
  const [probe, setProbe] = useState<Probe>({ kind: "idle" });
  const [counts, setCounts] = useState<Counts>(null);
  const [countErr, setCountErr] = useState("");
  const [zipping, setZipping] = useState(false);
  const hasToken = getToken() !== "";

  const verify = useCallback(async () => {
    setProbe({ kind: "checking" });
    const t0 = performance.now();
    try {
      const s = await api.status();
      setProbe({ kind: "ok", ms: Math.round(performance.now() - t0), s });
    } catch (e) {
      setProbe({ kind: "error", msg: e instanceof ApiError && e.status !== 0 ? e.message : "No se pudo conectar con el puente." });
    }
  }, []);

  const loadCounts = useCallback(async () => {
    setCountErr("");
    try {
      const [c, f] = await Promise.all([api.chats(), api.files()]);
      setCounts({ chats: c.chats.length, files: f.files.length, workspace: f.workspace_name || c.workspace_name });
    } catch (e) {
      setCounts(null);
      setCountErr(e instanceof ApiError && e.status !== 0 ? e.message : "No se pudo conectar con el puente.");
    }
  }, []);

  useEffect(() => { if (tab === "data") void loadCounts(); }, [tab, loadCounts]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const exportZip = async () => {
    setZipping(true);
    try {
      const r = await api.zip();
      window.dispatchEvent(new Event("erasmus:files-changed")); // zip now lives in the workspace root → refresh tree
      await downloadFile(r.zip_name);
    } catch (e) {
      setCountErr(e instanceof ApiError && e.status !== 0 ? e.message : "No se pudo exportar el workspace.");
    } finally {
      setZipping(false);
    }
  };

  const deps = Object.keys({ ...(pkg as { dependencies?: Record<string, string> }).dependencies }).sort();
  const btn = "inline-flex items-center gap-1.5 rounded-full border border-e-line px-3.5 py-1.5 text-[13.5px] hover:bg-e-bg3 disabled:opacity-50";
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-e-line py-3 text-[14px] last:border-0">
      <span className="text-e-dim">{k}</span><span className="min-w-0 truncate text-right font-mono text-[12px]">{v}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Ajustes">
      <div className="e-overlay absolute inset-0" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden border-e-line bg-e-bg2 text-e-tx sm:h-[min(600px,85vh)] sm:max-w-[680px] sm:rounded-2xl sm:border sm:shadow-e">
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-e-line px-4">
          {mobileDetail && <button className="e-icon-btn sm:hidden" aria-label="Volver" onClick={() => setMobileDetail(false)}><ChevronLeft className="size-5" /></button>}
          <h2 className="flex-1 text-[17px] font-semibold">{mobileDetail ? TABS.find((t) => t[0] === tab)?.[1] : "Ajustes"}<span className="hidden sm:inline">{mobileDetail ? "" : ""}</span></h2>
          <button className="e-icon-btn" aria-label="Cerrar ajustes" onClick={onClose}><X className="size-3.5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className={cn("flex-col gap-0.5 p-2 sm:flex sm:w-48 sm:shrink-0", mobileDetail ? "hidden" : "flex flex-1")} role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMobileDetail(true); }}
                className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] sm:py-2", tab === id ? "sm:bg-e-bg3" : "", "text-e-tx hover:bg-e-bg3")}>{label}<ChevronRight className="size-4 text-e-dim sm:hidden" /></button>
            ))}
          </nav>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:block", mobileDetail ? "block" : "hidden")} role="tabpanel">
            {tab === "general" && (
              <section>
                <h3 className="mb-2 text-[13px] font-medium">Tema</h3>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} className={cn(btn, theme === t && "bg-e-bg3 text-e-tx")}>
                      {t === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />} {t === "dark" ? "Oscuro" : "Claro"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-e-dim">Se guarda en este navegador. Los gráficos y diagramas se redibujan al cambiarlo.</p>
              </section>
            )}
            {tab === "model" && <ModelSettings />}
            {tab === "bridge" && (
              <section>
                <Row k="Endpoint" v={API_BASE + (MOCK ? " (demostración)" : "")} />
                <div className="mt-3"><button className={btn} onClick={() => void verify()} disabled={probe.kind === "checking"}>
                  <RefreshCw className={cn("size-3.5", probe.kind === "checking" && "animate-spin")} /> Verificar servidor
                </button></div>
                {probe.kind === "ok" && (
                  <div className="mt-3" data-probe="ok">
                    <Row k="Estado" v={<span className="text-e-ok">{probe.s.status}</span>} />
                    <Row k="Latencia" v={`${probe.ms} ms`} />
                    <Row k="Modelo activo" v={probe.s.brand_model} />
                    <Row k="Workspace" v={probe.s.workspace_name} />
                  </div>
                )}
                {probe.kind === "error" && (
                  <div className="e-err-banner mt-3 flex items-center gap-3 px-3 py-2 text-[13px]" role="alert" data-probe="error">
                    <WifiOff className="size-4 shrink-0" />
                    <span className="flex-1">Servidor no disponible: {probe.msg}</span>
                    <button onClick={() => void verify()} className="inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-[12px]"><RefreshCw className="size-3" /> Reintentar</button>
                  </div>
                )}
              </section>
            )}
            {tab === "data" && (
              <section>
                {counts && (<>
                  <Row k="Workspace" v={counts.workspace} />
                  <Row k="Conversaciones" v={counts.chats} />
                  <Row k="Archivos" v={counts.files} />
                </>)}
                {!counts && !countErr && <p className="text-[13px] text-e-dim">Cargando…</p>}
                {countErr && (
                  <div className="e-err-banner mt-3 flex items-center gap-3 px-3 py-2 text-[13px]" role="alert">
                    <span className="flex-1">{countErr}</span>
                    <button onClick={() => void loadCounts()} className="inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-[12px]"><RefreshCw className="size-3" /> Reintentar</button>
                  </div>
                )}
                <div className="mt-4"><button className={btn} onClick={() => void exportZip()} disabled={zipping}>
                  <Download className="size-3.5" /> {zipping ? "Exportando…" : "Exportar workspace (ZIP)"}
                </button></div>
              </section>
            )}
            {tab === "security" && (
              <section className="flex items-center gap-2 text-[13px]" data-token={hasToken ? "present" : "absent"}>
                {hasToken ? <ShieldCheck className="size-4 text-e-ok" /> : <ShieldOff className="size-4 text-e-err" />}
                <span>Token de acceso: {hasToken ? "presente" : "ausente"}</span>
                <span className="text-e-dim">· el valor nunca se muestra</span>
              </section>
            )}
            {tab === "about" && (
              <section className="text-[13px]">
                <p className="font-medium">{APP_VERSION}</p>
                <p className="mt-1 text-e-dim">Licencias de dependencias npm: MIT (provisional, pendiente de auditoría final).</p>
                <ul className="mt-3 columns-1 gap-4 font-mono text-[11.5px] text-e-dim sm:columns-2">
                  {deps.map((d) => <li key={d} className="truncate">{d} · MIT*</li>)}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
