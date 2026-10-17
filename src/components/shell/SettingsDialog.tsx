import { CustomInstructions } from "./CustomInstructions";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Moon, RefreshCw, ShieldCheck, Sun, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { displayModel, getModelConfig } from "@/lib/api/config";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ModelSettings } from "./ModelSettings";
import { clearSession } from "@/lib/session";

export const APP_VERSION = "Erasmus Web 1.0 · Beta test";
const UPDATED_AT = "8 de octubre de 2026";

type Counts = { chats: number; files: number; workspace: string } | null;

const TABS = [["general", "General"], ["custom", "Personalización"], ["model", "Modelo"], ["data", "Datos"], ["security", "Seguridad"], ["about", "Acerca de"]] as const;
type Tab = (typeof TABS)[number][0];

/** Settings modal. Rendered on top of the shell; never unmounts the chat, so chat state survives open/close. */
export function SettingsDialog({ onClose, initialTab = "general" }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mobileDetail, setMobileDetail] = useState(initialTab !== "general");
  const theme = useTheme();
  const [deletionInfo, setDeletionInfo] = useState(false);
  const deletionCard = useRef<HTMLDivElement>(null);
  /** The card sits at the bottom of a scrollable panel: bring it into view so both buttons are reachable. */
  useEffect(() => {
    const el = deletionCard.current;
    if (deletionInfo && typeof el?.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [deletionInfo]);
  const [counts, setCounts] = useState<Counts>(null);
  const [countErr, setCountErr] = useState("");
  const [zipping, setZipping] = useState(false);
  const [zipDone, setZipDone] = useState<{ name: string; size: number } | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleRedeemCoupon = async () => {
    const code = couponCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    setCouponMsg(null);
    try {
      const res = await api.redeemCoupon(code);
      setCouponMsg({ ok: true, text: res.message || "Cupón canjeado con éxito." });
      setCouponCode("");
      window.dispatchEvent(new Event("erasmus:turn-done"));
      window.dispatchEvent(new Event("erasmus:session"));
      window.dispatchEvent(new Event("erasmus:session-changed"));
    } catch (e) {
      setCouponMsg({ ok: false, text: e instanceof ApiError ? e.message : "No se pudo canjear el cupón." });
    } finally {
      setRedeeming(false);
    }
  };

  const loadCounts = useCallback(async () => {
    setCountErr("");
    try {
      const [c, f] = await Promise.all([api.chats(), api.files()]);
      setCounts({ chats: c.chats.length, files: f.files.length, workspace: f.workspace_name || c.workspace_name });
    } catch (e) {
      setCounts(null);
      setCountErr(e instanceof ApiError && e.status !== 0 ? e.message : "No se pudo conectar con Erasmus.");
    }
  }, []);

  useEffect(() => { if (tab === "data") void loadCounts(); }, [tab, loadCounts]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (deletionInfo) setDeletionInfo(false); else onClose(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [deletionInfo, onClose]);

  const exportZip = async () => {
    setZipping(true); setZipDone(null); setCountErr("");
    try {
      const r = await api.zip();
      const url = URL.createObjectURL(r.blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = r.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setZipDone({ name: r.name, size: r.blob.size });
    } catch (e) {
      setCountErr(e instanceof ApiError && e.status !== 0 ? e.message : "No se pudo exportar el workspace.");
    } finally {
      setZipping(false);
    }
  };

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
          {mobileDetail && <Button variant="ghost" className="e-icon-btn sm:hidden" aria-label="Volver" onClick={() => setMobileDetail(false)}><ChevronLeft className="size-5" /></Button>}
          <h2 className="flex-1 text-[17px] font-semibold">{mobileDetail ? TABS.find((t) => t[0] === tab)?.[1] : "Ajustes"}<span className="hidden sm:inline">{mobileDetail ? "" : ""}</span></h2>
          <Button variant="ghost" className="e-icon-btn" aria-label="Cerrar ajustes" onClick={onClose}><X className="size-3.5" /></Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className={cn("flex-col gap-0.5 p-2 sm:flex sm:w-48 sm:shrink-0", mobileDetail ? "hidden" : "flex flex-1")} role="tablist">
            {TABS.map(([id, label]) => (
              <Button variant="ghost" key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMobileDetail(true); }}
                className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] sm:py-2", tab === id ? "sm:bg-e-bg3" : "", "text-e-tx hover:bg-e-bg3")}>{label}<ChevronRight className="size-4 text-e-dim sm:hidden" /></Button>
            ))}
          </nav>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:block", mobileDetail ? "block" : "hidden")} role="tabpanel">
            {tab === "general" && (
              <section>
                <h3 className="mb-2 text-[13px] font-medium">Tema</h3>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <Button variant="ghost" key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} className={cn(btn, theme === t && "bg-e-bg3 text-e-tx")}>
                      {t === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />} {t === "dark" ? "Oscuro" : "Claro"}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-e-dim">Se guarda en este navegador. Los gráficos y diagramas se redibujan al cambiarlo.</p>
              </section>
            )}
            {tab === "custom" && <CustomInstructions />}
            {tab === "model" && <ModelSettings />}
            {tab === "data" && (
              <section className="space-y-5">
                <div>
                  {counts && (<>
                    <Row k="Workspace" v={counts.workspace} />
                    <Row k="Conversaciones" v={counts.chats} />
                    <Row k="Archivos" v={counts.files} />
                  </>)}
                  {!counts && !countErr && <p className="text-[13px] text-e-dim">Cargando…</p>}
                  {countErr && (
                    <div className="e-err-banner mt-3 flex items-center gap-3 px-3 py-2 text-[13px]" role="alert">
                      <span className="flex-1">{countErr}</span>
                      <Button variant="ghost" onClick={() => void loadCounts()} className="inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-[12px]"><RefreshCw className="size-3" /> Reintentar</Button>
                    </div>
                  )}
                  <div className="mt-4">
                    <Button variant="ghost" className={btn} onClick={() => void exportZip()} disabled={zipping} data-zip-export>
                      <Download className="size-3.5" /> {zipping ? "Exportando…" : "Exportar workspace (ZIP)"}
                    </Button>
                    {zipDone && <p className="mt-2 text-[12.5px] text-e-ok" data-zip-done>Descargado {zipDone.name} ({(zipDone.size / 1024).toFixed(1)} KB).</p>}
                  </div>
                </div>
                <div className="border-t border-e-line pt-4">
                  <h3 className="mb-2 text-[13px] font-medium">Canjear cupón o código Pro</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ERM-PRO-..."
                      aria-label="Código de cupón"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRedeemCoupon(); }}
                      className="flex-1 rounded-lg border border-e-line bg-e-bg3 px-3 py-1.5 font-mono text-[13px] uppercase text-e-tx outline-none focus:border-e-acc"
                    />
                    <Button
                      variant="outline"
                      disabled={redeeming || !couponCode.trim()}
                      onClick={() => void handleRedeemCoupon()}
                      className="rounded-lg text-[13px]"
                    >
                      {redeeming ? "Canjeando…" : "Canjear"}
                    </Button>
                  </div>
                  {couponMsg && (
                    <p role="status" className={cn("mt-2 text-[12px]", couponMsg.ok ? "text-e-ok" : "text-e-err")}>
                      {couponMsg.text}
                    </p>
                  )}
                  <p className="mt-2 text-[12px] text-e-dim">Los cupones añaden tiempo de vigencia o cuota de tokens a tu cuenta inmediatamente.</p>
                </div>
              </section>
            )}
            {tab === "security" && (
              <section className="space-y-5 text-[13px] leading-relaxed">
                <h3 className="flex items-center gap-2 text-[15px] font-medium"><ShieldCheck className="size-4 text-e-ok" /> Tus datos y tu cuenta</h3>
                <div><h4 className="font-medium">Conversaciones y archivos</h4><p className="mt-1 text-e-dim">Los mensajes, respuestas y archivos guardados se asocian a tu cuenta. El contenido necesario de la conversación se envía al servicio de IA para generar respuestas; no hay cifrado de extremo a extremo.</p></div>
                <div><h4 className="font-medium">En este navegador</h4><p className="mt-1 text-e-dim">La sesión se guarda en esta pestaña. Las preferencias y la recuperación de tu conversación se guardan por cuenta en el navegador. Cerrar sesión elimina esos datos locales, pero no borra el historial ni los archivos del servidor.</p></div>
                <div><h4 className="font-medium">Conservación y control</h4><p className="mt-1 text-e-dim">La política establece un máximo de 30 días de conservación. La activación del borrado automático en el servidor está pendiente de confirmación. Puedes exportar tus conversaciones y archivos desde Datos antes de solicitar su eliminación.</p><Link to="/privacidad" className="mt-2 inline-block text-e-tx underline underline-offset-4">Política de privacidad</Link></div>
                <div className="border-t border-e-line pt-4">
                  <h4 className="font-medium text-e-tx">Eliminar cuenta</h4>
                  <p className="mb-3 mt-1 text-e-dim">Elimina definitivamente tu cuenta, tu historial y todos los datos asociados de este dispositivo.</p>
                  {!deletionInfo ? (
                    <Button variant="outline" className="border-e-line bg-transparent text-e-err hover:bg-e-bg3 hover:text-e-err" onClick={() => setDeletionInfo(true)}>
                      <Trash2 className="size-4" /> Eliminar cuenta
                    </Button>
                  ) : (
                    <div ref={deletionCard} role="region" aria-label="Confirmación de cuenta" className="rounded-xl border border-e-err/40 bg-e-bg3 p-4">
                      <p className="font-medium text-e-err">¿Estás seguro de que deseas eliminar tu cuenta?</p>
                      <p className="mt-2 text-[13px] text-e-dim leading-relaxed">Esta acción es definitiva e irreversible. Perderás el acceso inmediato a tu cuenta, todas tus conversaciones, archivos guardados y cualquier plan o cupo activo asociado a este código de acceso.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDeletionInfo(false)}>Cancelar</Button>
                        <Button variant="destructive" size="sm" onClick={() => {
                          clearSession();
                          window.location.assign("/entrar");
                        }}>
                          <Trash2 className="size-4 shrink-0" /> Sí, eliminar mi cuenta definitivamente
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
            {tab === "about" && (
              <section className="text-[13px]">
                <h3 className="text-[16px] font-medium">{APP_VERSION}</h3>
                <div className="mt-4"><Row k="Modelo" v={displayModel(getModelConfig().model)} /><Row k="Última actualización" v={UPDATED_AT} /></div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
