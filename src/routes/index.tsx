import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUp, Check, FileText, Image, MessagesSquare, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { getSession } from "@/lib/session";
import { PublicHeader } from "@/components/PublicHeader";
import { HERO_DRAFT_KEY } from "@/components/shell/AppShell";
import { useReveal } from "@/lib/reveal";
import { useT } from "@/lib/i18n";

const TITLE = "Erasmus — El agente de IA para empresarios";
const DESC = "Chat, documentos, imágenes y análisis para tu negocio. Entra con un código, sin correo. Cada cuenta es un espacio totalmente privado.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const MARQUEE = ["Chat", "Documentos", "Gráficos", "Diagramas", "Imágenes", "Análisis", "Exportar", "Razonamiento"];

function Landing() {
  const navigate = useNavigate();
  const t = useT();
  const ref = useReveal<HTMLDivElement>();
  const [q, setQ] = useState("");
  const go = () => {
    const trimmed = q.trim();
    if (trimmed) {
      try { sessionStorage.setItem(HERO_DRAFT_KEY, trimmed); } catch { /* ignore */ }
    }
    void navigate({ to: getSession() ? "/chat" : "/entrar" });
  };

  const FEATURES = [
    { n: "01", tag: "Chat", icon: MessagesSquare, title: t("feat1_title"), text: t("feat1_text") },
    { n: "02", tag: "Documentos", icon: FileText, title: t("feat2_title"), text: t("feat2_text") },
    { n: "03", tag: "Imágenes", icon: Image, title: t("feat3_title"), text: t("feat3_text") },
  ];
  const HOW = [
    { icon: Sparkles, t: t("how1_t"), d: t("how1_d") },
    { icon: Zap, t: t("how2_t"), d: t("how2_d") },
    { icon: Check, t: t("how3_t"), d: t("how3_d") },
  ];

  return (
    <div ref={ref} className="min-h-dvh bg-e-bg2 text-e-tx">
      <PublicHeader />

      {/* Hero */}
      <section className="e-hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-5 pb-16 pt-20 text-center sm:pt-28">
          <p className="e-reveal text-[13px] uppercase tracking-[0.18em] text-e-dim">{t("hero_kicker")}</p>
          <h1 className="e-reveal mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[64px]" style={{ transitionDelay: "80ms" }}>{t("hero_title")}</h1>
          <p className="e-reveal mx-auto mt-5 max-w-xl text-[16px] text-e-dim sm:text-[18px]" style={{ transitionDelay: "160ms" }}>{t("hero_sub")}</p>
          <form onSubmit={(e) => { e.preventDefault(); go(); }} style={{ transitionDelay: "240ms" }}
            className="e-reveal mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-[28px] border border-e-line bg-e-bg2 p-2 pl-5 shadow-sm transition-shadow focus-within:shadow-[var(--shadow)]">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hero_placeholder")} aria-label={t("hero_placeholder")} className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-e-dim" />
            <button type="submit" aria-label={t("hero_placeholder")} className="grid size-10 place-items-center rounded-full bg-e-acc text-e-bg2 transition-transform hover:scale-105 active:scale-95"><ArrowUp className="size-5" /></button>
          </form>
          <p className="e-reveal mt-3 text-[12.5px] text-e-dim" style={{ transitionDelay: "300ms" }}>{t("hero_note")}</p>
        </div>

        {/* Marquee */}
        <div className="e-marquee-wrap border-y border-e-line py-3" aria-hidden>
          <div className="e-marquee flex w-max gap-8">
            {[...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={i} className="flex items-center gap-8 text-[13px] font-medium uppercase tracking-[0.2em] text-e-dim">
                {w} <span className="text-e-line">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-e-line">
        <div className="mx-auto grid max-w-6xl gap-px bg-e-line sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <article key={f.n} className="e-reveal e-card-lift bg-e-bg2 px-6 py-10" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[12px] text-e-dim">{f.n} · {f.tag}</p>
                <f.icon className="size-5 text-e-dim" />
              </div>
              <h2 className="mt-4 text-[22px] font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-e-dim">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="e-reveal text-center text-[30px] font-semibold tracking-tight sm:text-[38px]">{t("how_title")}</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {HOW.map((h, i) => (
            <div key={h.t} className="e-reveal e-card-lift rounded-2xl border border-e-line bg-e-bg2 p-6" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="grid size-11 place-items-center rounded-full bg-e-bg3"><h.icon className="size-5" /></div>
              <h3 className="mt-4 text-[18px] font-semibold">{h.t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-e-dim">{h.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-e-line bg-e-bg3/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:grid-cols-2">
          <div className="e-reveal">
            <div className="grid size-12 place-items-center rounded-2xl bg-e-acc text-e-bg2"><ShieldCheck className="size-6" /></div>
            <h2 className="mt-5 text-[28px] font-semibold tracking-tight sm:text-[34px]">{t("priv_title")}</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-e-dim">{t("priv_text")}</p>
          </div>
          <ul className="e-reveal space-y-3" style={{ transitionDelay: "120ms" }}>
            {[t("priv1"), t("priv2"), t("priv3")].map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-xl border border-e-line bg-e-bg2 px-4 py-3.5 text-[14.5px] font-medium">
                <Check className="size-4 shrink-0 text-e-ok" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-e-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-[13px] text-e-dim">
          <span className="mr-auto">{t("footer_rights")}</span>
          <Link to="/ayuda" className="hover:text-e-tx">{t("nav_help")}</Link>
          <Link to="/estado" className="hover:text-e-tx">{t("nav_status")}</Link>
          <Link to="/privacidad" className="hover:text-e-tx">{t("nav_privacy")}</Link>
          <Link to="/entrar" className="hover:text-e-tx">{t("nav_login")}</Link>
        </div>
      </footer>
    </div>
  );
}
