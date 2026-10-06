import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { useT, type TKey } from "@/lib/i18n";

export const Route = createFileRoute("/ayuda")({
  head: () => ({
    meta: [
      { title: "Ayuda — Erasmus" },
      { name: "description", content: "Respuestas a las dudas más habituales sobre Erasmus." },
      { property: "og:title", content: "Ayuda — Erasmus" },
      { property: "og:description", content: "Respuestas a las dudas más habituales sobre Erasmus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const QA: { q: TKey; a: TKey }[] = [
  { q: "help_q1", a: "help_a1" },
  { q: "help_q2", a: "help_a2" },
  { q: "help_q3", a: "help_a3" },
  { q: "help_q4", a: "help_a4" },
  { q: "help_q5", a: "help_a5" },
  { q: "help_q6", a: "help_a6" },
];

function HelpPage() {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-dvh bg-e-bg2 text-e-tx">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-[32px] font-semibold tracking-tight">{t("help_title")}</h1>
        <p className="mt-2 text-[15px] text-e-dim">{t("help_sub")}</p>

        <div className="mt-8 divide-y divide-e-line rounded-2xl border border-e-line bg-e-bg2 shadow-sm">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] font-medium hover:bg-e-bg3/60"
                >
                  <span className="flex-1">{t(item.q)}</span>
                  <ChevronDown className={`size-4 shrink-0 text-e-dim transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-[14px] leading-relaxed text-e-dim">{t(item.a)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Link to="/entrar" className="mt-8 flex items-center gap-3 rounded-2xl border border-e-line bg-e-bg3/50 px-5 py-4 text-[14.5px] hover:bg-e-bg3">
          <MessageCircle className="size-5 shrink-0 text-e-dim" />
          <span>{t("help_cta")}</span>
        </Link>
      </main>
    </div>
  );
}
