import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUp, Check, Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { getSession } from "@/lib/session";

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

const FEATURES = [
  { n: "01", tag: "Chat", title: "Pregunta. Responde.", text: "Respuestas claras y estructuradas para decisiones de negocio, con razonamiento ajustable y conversaciones que no se pierden." },
  { n: "02", tag: "Documentos", title: "Lee lo que le das", text: "Adjunta textos, hojas y documentos: Erasmus los analiza, resume y te devuelve tablas, gráficos y diagramas." },
  { n: "03", tag: "Imágenes", title: "Ve y crea", text: "Interpreta las imágenes que subes y genera nuevas cuando tu plan lo incluye." },
];

const PLANS = [
  { name: "Pase de un día", price: "Un día", items: ["Chat completo", "Adjuntar documentos", "Contexto por conversación"] },
  { name: "Pro", price: "Mensual", items: ["Todo lo del pase", "Generación de imágenes", "Exportar conversaciones"], featured: true },
  { name: "Max", price: "Mensual", items: ["Todo lo de Pro", "Mayor capacidad de uso", "Clave para tu propio editor"] },
];

function Landing() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const go = () => void navigate({ to: getSession() ? "/chat" : "/entrar" });

  return (
    <div className="min-h-dvh bg-e-bg2 text-e-tx">
      <header className="sticky top-0 z-10 border-b border-e-line/60 bg-e-bg2/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-5">
          <Link to="/" className="mr-auto text-[17px] font-semibold tracking-tight">Erasmus</Link>
          <a href="#planes" className="hidden rounded-full px-3 py-1.5 text-[14px] text-e-dim hover:text-e-tx sm:block">Precios</a>
          <button className="e-icon-btn" aria-label="Cambiar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
          <Link to="/entrar" className="rounded-full px-3 py-1.5 text-[14px] hover:bg-e-bg3">Entrar</Link>
          <a href="#planes" className="rounded-full bg-e-acc px-4 py-1.5 text-[14px] font-medium text-e-bg2">Empezar</a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-20 pt-20 text-center sm:pt-28">
        <p className="text-[13px] uppercase tracking-[0.18em] text-e-dim">Sin correo · Un código y entras</p>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[64px]">El agente de IA que trabaja para tu empresa</h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] text-e-dim sm:text-[18px]">Chat, documentos, gráficos e imágenes en un solo lugar. Cada cuenta es un espacio privado: nada se mezcla con nadie.</p>
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-[28px] border border-e-line bg-e-bg2 p-2 pl-5 shadow-sm">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregunta lo que necesites" aria-label="Preguntar" className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-e-dim" />
          <button type="submit" aria-label="Preguntar" className="grid size-10 place-items-center rounded-full bg-e-acc text-e-bg2"><ArrowUp className="size-5" /></button>
        </form>
        <p className="mt-3 text-[12.5px] text-e-dim">Necesitas un código de acceso para empezar.</p>
      </section>

      <section className="border-t border-e-line">
        <div className="mx-auto grid max-w-6xl gap-px bg-e-line sm:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.n} className="bg-e-bg2 px-6 py-10">
              <p className="font-mono text-[12px] text-e-dim">{f.n} · {f.tag}</p>
              <h2 className="mt-4 text-[22px] font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-e-dim">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planes" className="scroll-mt-16 border-t border-e-line bg-e-bg">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="font-mono text-[12px] text-e-dim">04 · Precios</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[40px]">Paga un periodo. Sin renovaciones.</h2>
          <p className="mt-3 max-w-xl text-[15px] text-e-dim">Nada se renueva solo: compras un periodo, corre, y comprar otra vez lo extiende. Por ahora la activación es manual: contáctanos y te enviamos tu código.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-3xl border bg-e-bg2 p-6 ${p.featured ? "border-e-tx" : "border-e-line"}`}>
                <h3 className="text-[18px] font-semibold">{p.name}</h3>
                <p className="mt-1 text-[13px] text-e-dim">{p.price}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-[14.5px]">
                  {p.items.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {i}</li>)}
                </ul>
                <a href="mailto:ventas@erasmus.example?subject=Activar%20plan%20Erasmus" className={`mt-8 rounded-full px-4 py-2.5 text-center text-[14px] font-medium ${p.featured ? "bg-e-acc text-e-bg2" : "border border-e-line hover:bg-e-bg3"}`}>Contactar para activar</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-e-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-[13px] text-e-dim">
          <span className="mr-auto">© Erasmus</span>
          <Link to="/entrar" className="hover:text-e-tx">Entrar</Link>
          <a href="#planes" className="hover:text-e-tx">Precios</a>
        </div>
      </footer>
    </div>
  );
}
