import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Download, KeyRound, Loader2, Ticket } from "lucide-react";
import { CODE_RE, formatCode, getSession } from "@/lib/session";
import { claimCoupon, login, type CouponClaim } from "@/lib/auth";
import { PublicHeader } from "@/components/PublicHeader";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Erasmus" },
      { name: "description", content: "Entra en Erasmus con tu código de acceso o canjea un cupón de invitación. Sin correo." },
      { property: "og:title", content: "Entrar — Erasmus" },
      { property: "og:description", content: "Entra en Erasmus con tu código de acceso o canjea un cupón de invitación. Sin correo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const MSG = {
  format: "El código debe tener el formato erm-XXXX-XXXX-XXXXX-XXXX.",
  invalid: "Código no válido o inactivo.",
  rate: "Demasiados intentos. Espera un momento.",
  unavailable: "El acceso no está disponible todavía. Inténtalo más tarde.",
  network: "No se pudo conectar con el servidor.",
} as const;

function LoginPage() {
  const navigate = useNavigate();
  const t = useT();
  const [mode, setMode] = useState<"code" | "coupon">("code");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const [contactNotice, setContactNotice] = useState(false);
  const [claimed, setClaimed] = useState<CouponClaim | null>(null);
  const [copied, setCopied] = useState(false);
  const fails = useRef(0);

  useEffect(() => {
    if (getSession() && !claimed) void navigate({ to: "/chat", replace: true });
  }, [claimed, navigate]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const valid = CODE_RE.test(code);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || wait > 0) return;
    setBusy(true); setErr("");
    const r = await login(code);
    setBusy(false);
    if (r.ok) { setCode(""); void navigate({ to: "/chat", replace: true }); return; }
    setErr(MSG[r.reason]);
    if (r.reason === "invalid" || r.reason === "format") { fails.current += 1; if (fails.current >= 3) setWait(Math.min(60, 2 ** (fails.current - 2))); }
    if (r.reason === "rate") setWait(r.retryAfter ?? 30);
  };

  const submitCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupon.trim() || busy) return;
    setBusy(true); setErr("");
    const res = await claimCoupon(coupon);
    setBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    setClaimed(res.claim);
  };

  const copyClaimedCode = async () => {
    if (!claimed) return;
    try {
      await navigator.clipboard.writeText(claimed.accessCode);
      setCopied(true);
      setErr("");
    } catch {
      setErr("No se pudo copiar automáticamente. Selecciona y copia tu código manualmente.");
    }
  };

  const downloadClaimedCode = () => {
    if (!claimed) return;
    const content = [
      "=== CREDENCIAL DE ACCESO ERASMUS ===",
      `Código de acceso: ${claimed.accessCode}`,
      `Plan asignado: ${claimed.plan.toUpperCase()}`,
      `Fecha de emisión: ${new Date().toISOString()}`,
      "",
      "Guarda este archivo en un lugar seguro. Este código es tu única llave para entrar en Erasmus.",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clave-erasmus-${claimed.accessCode.slice(0, 8)}.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-e-bg2 text-e-tx">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-5 pb-20">
        {claimed ? (
          <section className="w-full max-w-sm rounded-2xl border border-e-line bg-e-bg2 p-6 shadow-e" data-coupon-claimed>
            <div className="flex items-center justify-between">
              <div className="grid size-10 place-items-center rounded-full bg-e-ok/10"><Check className="size-5 text-e-ok" /></div>
              <span className="rounded-full border border-e-line bg-e-bg3 px-2.5 py-0.5 text-[12px] font-medium uppercase text-e-tx">
                Plan {claimed.plan}
              </span>
            </div>
            <h1 className="mt-4 text-[24px] font-semibold">{t("buy_ready")}</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-e-dim">{t("buy_save_key")}</p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-e-line bg-e-bg3 px-3 py-3">
              <code className="min-w-0 flex-1 select-all break-all font-mono text-[13.5px] font-semibold text-e-tx">{claimed.accessCode}</code>
              <button type="button" className="e-icon-btn shrink-0" aria-label={t("buy_copy")} title={t("buy_copy")} onClick={() => void copyClaimedCode()}>
                <Copy className="size-4" />
              </button>
              <button type="button" className="e-icon-btn shrink-0" aria-label="Descargar código en archivo de texto" title="Descargar respaldo (.txt)" onClick={downloadClaimedCode}>
                <Download className="size-4" />
              </button>
            </div>
            {err && <p role="alert" className="mt-2 text-[13px] text-e-err">{err}</p>}
            {copied && <p role="status" className="mt-2 text-[12.5px] text-e-ok">{t("buy_copied")}</p>}
            <button
              type="button"
              onClick={() => void navigate({ to: "/chat", replace: true })}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[14.5px] font-medium text-e-bg2"
            >
              {t("buy_continue")} <ArrowRight className="size-4" />
            </button>
          </section>
        ) : (
          <div className="w-full max-w-sm">
            <h1 className="text-[28px] font-semibold tracking-tight">{mode === "code" ? t("login_title") : t("buy_title")}</h1>
            <p className="mt-1.5 text-[14.5px] text-e-dim">{mode === "code" ? t("login_sub") : t("buy_sub")}</p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-e-line bg-e-bg3 p-1 text-[13px]" role="tablist" aria-label="Método de acceso">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "code"}
                onClick={() => { setMode("code"); setErr(""); }}
                className={cn(" inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-colors", mode === "code" ? "bg-e-bg2 text-e-tx shadow-xs" : "text-e-dim hover:text-e-tx")}
              >
                <KeyRound className="size-3.5" /> Código de acceso
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "coupon"}
                onClick={() => { setMode("coupon"); setErr(""); }}
                className={cn("inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-colors", mode === "coupon" ? "bg-e-bg2 text-e-tx shadow-xs" : "text-e-dim hover:text-e-tx")}
              >
                <Ticket className="size-3.5" /> Canjear cupón
              </button>
            </div>

            {mode === "code" ? (
              <form onSubmit={submit} className="mt-6">
                <label htmlFor="code" className="block text-[13px] font-medium">{t("login_code")}</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-e-line bg-e-bg2 px-3.5 focus-within:border-e-dim">
                  <KeyRound className="size-4 shrink-0 text-e-dim" />
                  <input id="code" autoFocus autoComplete="off" spellCheck={false} inputMode="text" placeholder="erm-XXXX-XXXX-XXXXX-XXXX"
                    value={code} onChange={(e) => { setCode(formatCode(e.target.value)); setErr(""); }}
                    className="h-12 w-full bg-transparent font-mono text-[15px] outline-none placeholder:text-e-dim/70" aria-invalid={!!err} />
                </div>
                {err && <p role="alert" className="mt-2 text-[13px] text-e-err">{err}</p>}
                <button type="submit" disabled={!valid || busy || wait > 0}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[15px] font-medium text-e-bg2 transition-opacity disabled:opacity-40">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : wait > 0 ? `${t("login_wait")} ${wait} s` : <>{t("login_action")} <ArrowRight className="size-4" /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={submitCoupon} className="mt-6">
                <label htmlFor="login-coupon" className="block text-[13px] font-medium">{t("buy_coupon")}</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-e-line bg-e-bg2 px-3.5 focus-within:border-e-dim">
                  <Ticket className="size-4 shrink-0 text-e-dim" />
                  <input
                    id="login-coupon"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ERM-PROMO-XXXX"
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setErr(""); }}
                    className="h-12 w-full bg-transparent font-mono text-[15px] uppercase outline-none placeholder:text-e-dim/70"
                    aria-invalid={!!err}
                  />
                </div>
                {err && <p role="alert" className="mt-2 text-[13px] text-e-err">{err}</p>}
                <button
                  type="submit"
                  disabled={!coupon.trim() || busy}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[15px] font-medium text-e-bg2 transition-opacity disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <>{t("buy_redeem")} <ArrowRight className="size-4" /></>}
                </button>
              </form>
            )}

            <div className="mt-6 border-t border-e-line pt-5 text-center text-[13.5px] text-e-dim">
              <span>{t("login_no_key")} </span>
              {mode === "code" ? (
                <button type="button" onClick={() => { setMode("coupon"); setErr(""); }} className="font-medium text-e-tx underline decoration-e-line underline-offset-4 hover:decoration-e-tx">
                  Canjear cupón
                </button>
              ) : (
                <button type="button" onClick={() => { setMode("code"); setErr(""); }} className="font-medium text-e-tx underline decoration-e-line underline-offset-4 hover:decoration-e-tx">
                  Ya tengo código
                </button>
              )}
              <span> · </span>
              <button type="button" onClick={() => setContactNotice(true)} className="font-medium text-e-tx underline decoration-e-line underline-offset-4 hover:decoration-e-tx">{t("login_contact")}</button>
              {contactNotice && <p role="status" className="mt-3 rounded-xl bg-e-bg3 px-3 py-2 text-[12.5px] leading-relaxed">{t("login_contact_pending")}</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
