import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, KeyRound, Loader2, Ticket } from "lucide-react";
import { CODE_RE, formatCode, getSession } from "@/lib/session";
import { claimCoupon, login } from "@/lib/auth";
import { PublicHeader } from "@/components/PublicHeader";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Erasmus" },
      { name: "description", content: "Entra en Erasmus con tu código de acceso. Sin correo." },
      { property: "og:title", content: "Entrar — Erasmus" },
      { property: "og:description", content: "Entra en Erasmus con tu código de acceso. Sin correo." },
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const [contactNotice, setContactNotice] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [copied, setCopied] = useState(false);
  const fails = useRef(0);

  useEffect(() => { if (getSession()) void navigate({ to: "/chat", replace: true }); }, [navigate]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

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

  const claim = async () => {
    if (!coupon.trim() || couponBusy) return;
    setCouponBusy(true); setErr("");
    const result = await claimCoupon(coupon);
    setCouponBusy(false);
    if (!result.ok) { setErr(result.message); return; }
    setNewAccessCode(result.claim.accessCode);
  };

  if (newAccessCode) return (
    <main className="flex min-h-dvh flex-col bg-e-bg2 text-e-tx">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-5 pb-20">
        <section className="w-full max-w-sm rounded-2xl border border-e-line p-6">
          <div className="grid size-10 place-items-center rounded-full bg-e-ok/10"><Check className="size-5 text-e-ok" /></div>
          <h1 className="mt-5 text-[25px] font-semibold tracking-tight">Tu acceso está listo</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-e-dim">Guarda esta llave ahora. Por seguridad, no volverá a mostrarse.</p>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-e-line bg-e-bg3 px-3 py-3">
            <code className="min-w-0 flex-1 select-all break-all text-[13px]">{newAccessCode}</code>
            <button type="button" className="e-icon-btn shrink-0" aria-label="Copiar llave" onClick={() => { void navigator.clipboard.writeText(newAccessCode); setCopied(true); }}><Copy className="size-4" /></button>
          </div>
          {copied && <p className="mt-2 text-[12.5px] text-e-ok">Llave copiada.</p>}
          <button type="button" onClick={() => void navigate({ to: "/chat", replace: true })} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[14px] font-medium text-e-bg2">Continuar <ArrowRight className="size-4" /></button>
        </section>
      </div>
    </main>
  );

  return (
    <main className="flex min-h-dvh flex-col bg-e-bg2 text-e-tx">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-5 pb-20">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="text-[28px] font-semibold tracking-tight">{t("login_title")}</h1>
          <p className="mt-1.5 text-[14.5px] text-e-dim">{t("login_sub")}</p>
          <label htmlFor="code" className="mt-7 block text-[13px] font-medium">{t("login_code")}</label>
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
          <button type="button" onClick={() => { setCouponOpen(!couponOpen); setErr(""); }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-e-line text-[14px] font-medium hover:bg-e-bg3"><Ticket className="size-4" /> Tengo un cupón</button>
          {couponOpen && <div className="mt-3 rounded-2xl border border-e-line bg-e-bg3/50 p-3">
            <label htmlFor="new-coupon" className="text-[12.5px] font-medium">Cupón de alta</label>
            <div className="mt-2 flex gap-2"><input id="new-coupon" value={coupon} onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setErr(""); }} placeholder="Introduce el cupón" className="h-10 min-w-0 flex-1 rounded-xl border border-e-line bg-e-bg2 px-3 font-mono text-[13px] outline-none" /><button type="button" disabled={!coupon.trim() || couponBusy} onClick={() => void claim()} className="rounded-full bg-e-acc px-4 text-[13px] font-medium text-e-bg2 disabled:opacity-40">{couponBusy ? <Loader2 className="size-4 animate-spin" /> : "Canjear"}</button></div>
          </div>}
          <div className="mt-6 border-t border-e-line pt-5 text-center text-[13.5px] text-e-dim">
            <span>{t("login_no_key")} </span>
            <button type="button" onClick={() => setContactNotice(true)} className="font-medium text-e-tx underline decoration-e-line underline-offset-4 hover:decoration-e-tx">{t("login_contact")}</button>
            {contactNotice && <p role="status" className="mt-3 rounded-xl bg-e-bg3 px-3 py-2 text-[12.5px] leading-relaxed">{t("login_contact_pending")}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}
