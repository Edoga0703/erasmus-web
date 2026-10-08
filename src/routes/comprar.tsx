import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Loader2, Ticket } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { claimCoupon } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/comprar")({
  head: () => ({
    meta: [
      { title: "Canjear acceso — Erasmus" },
      { name: "description", content: "Activa tu acceso a Erasmus con un cupón." },
      { property: "og:title", content: "Canjear acceso — Erasmus" },
      { property: "og:description", content: "Activa tu acceso a Erasmus con un cupón." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyPage,
});

function BuyPage() {
  const navigate = useNavigate();
  const t = useT();
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyAccess = async () => {
    try { await navigator.clipboard.writeText(accessCode); setCopied(true); setError(""); }
    catch { setError("No se pudo copiar. Selecciona y copia tu código manualmente."); }
  };

  const claim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!coupon.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await claimCoupon(coupon);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAccessCode(result.claim.accessCode);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-e-bg2 text-e-tx">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:py-20">
        {accessCode ? (
          <section className="w-full max-w-sm rounded-2xl border border-e-line p-6">
            <div className="grid size-10 place-items-center rounded-full bg-e-ok/10"><Check className="size-5 text-e-ok" /></div>
            <h1 className="mt-5 text-[25px] font-semibold">{t("buy_ready")}</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-e-dim">{t("buy_save_key")}</p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-e-line bg-e-bg3 px-3 py-3">
              <code className="min-w-0 flex-1 select-all break-all text-[13px]">{accessCode}</code>
              <button type="button" className="e-icon-btn shrink-0" aria-label={t("buy_copy")} onClick={() => void copyAccess()}><Copy className="size-4" /></button>
            </div>
            {error && <p role="alert" className="mt-2 text-[13px] text-e-err">{error}</p>}
            {copied && <p className="mt-2 text-[12.5px] text-e-ok">{t("buy_copied")}</p>}
            <button type="button" onClick={() => void navigate({ to: "/chat", replace: true })} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[14px] font-medium text-e-bg2">
              {t("buy_continue")} <ArrowRight className="size-4" />
            </button>
          </section>
        ) : (
          <section className="w-full max-w-sm">
            <div className="grid size-11 place-items-center rounded-full bg-e-bg3"><Ticket className="size-5" /></div>
            <h1 className="mt-5 text-[28px] font-semibold">{t("buy_title")}</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-e-dim">{t("buy_sub")}</p>
            <form onSubmit={claim} className="mt-7">
              <label htmlFor="purchase-coupon" className="block text-[13px] font-medium">{t("buy_coupon")}</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-e-line bg-e-bg2 px-3.5 focus-within:border-e-dim">
                <Ticket className="size-4 shrink-0 text-e-dim" />
                <input id="purchase-coupon" autoFocus autoComplete="off" spellCheck={false} value={coupon} onChange={(event) => { setCoupon(event.target.value.toUpperCase()); setError(""); }} placeholder={t("buy_placeholder")} className="h-12 w-full bg-transparent font-mono text-[15px] outline-none placeholder:text-e-dim/70" />
              </div>
              {error && <p role="alert" className="mt-2 text-[13px] text-e-err">{error}</p>}
              <button type="submit" disabled={!coupon.trim() || busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[15px] font-medium text-e-bg2 disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <>{t("buy_redeem")} <ArrowRight className="size-4" /></>}
              </button>
            </form>
            <p className="mt-5 text-center text-[12.5px] leading-relaxed text-e-dim">{t("buy_payments_later")}</p>
          </section>
        )}
      </div>
    </main>
  );
}