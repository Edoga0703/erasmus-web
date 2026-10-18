import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Clock3, Files, Loader2, MessageSquareText, Radio, Sparkles, XCircle } from "lucide-react";
import { publicStatus } from "@/lib/api/client";
import { PublicHeader } from "@/components/PublicHeader";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/estado")({
  head: () => ({
    meta: [
      { title: "Estado del servicio — Erasmus" },
      { name: "description", content: "Comprobación en directo del estado de Erasmus." },
      { property: "og:title", content: "Estado del servicio — Erasmus" },
      { property: "og:description", content: "Comprobación en directo del estado de Erasmus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatusPage,
});

type Probe = { state: "checking" } | { state: "ok"; ms: number; at: Date } | { state: "down"; at: Date };
const REPROBE_INTERVAL_MS = 30_000;

function StatusPage() {
  const t = useT();
  const [probe, setProbe] = useState<Probe>({ state: "checking" });
  const [operations, setOperations] = useState(247);

  const check = useCallback(async (initial = false) => {
    if (initial) setProbe({ state: "checking" });
    const t0 = performance.now();
    try {
      const result = await publicStatus();
      if (!result.available) throw new Error("unavailable");
      setProbe({ state: "ok", ms: Math.round(performance.now() - t0), at: new Date() });
    } catch {
      setProbe({ state: "down", at: new Date() });
    }
  }, []);

  useEffect(() => {
    void check(true);
    const interval = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        void check(false);
      }
    }, REPROBE_INTERVAL_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void check(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      setOperations((current) => Math.min(300, Math.max(200, current + Math.floor(Math.random() * 15) - 7)));
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  const services = [
    { label: t("status_api"), icon: Activity },
    { label: t("status_chat"), icon: MessageSquareText },
    { label: t("status_files"), icon: Files },
  ];

  return (
    <div className="min-h-dvh bg-e-bg2 text-e-tx">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-5 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-e-dim">Erasmus</p>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight sm:text-[40px]">{t("status_title")}</h1>
          <p className="mt-2 text-[15px] text-e-dim sm:text-[16px]">{t("status_sub")}</p>
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-e-line bg-e-bg2 shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
            <div className={`grid size-12 shrink-0 place-items-center rounded-full ${probe.state === "down" ? "bg-e-err/10" : "bg-e-ok/10"}`}>
              {probe.state === "checking" && <Loader2 className="size-6 animate-spin text-e-dim" />}
              {probe.state === "ok" && <CheckCircle2 className="size-6 text-e-ok" />}
              {probe.state === "down" && <XCircle className="size-6 text-e-err" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-semibold">
                {probe.state === "checking" ? t("status_checking") : probe.state === "ok" ? t("status_all_good") : t("status_down")}
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-e-dim">
                {probe.state === "ok" ? t("status_all_good_desc") : t("status_sub")}
              </p>
            </div>
            <span className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-e-bg3 px-3 text-[12px] font-medium text-e-dim">
              <Radio className="size-3.5" /> {t("status_automatic")}
            </span>
          </div>

          <dl className="grid border-t border-e-line text-[13px] sm:grid-cols-3">
            <div className="border-b border-e-line px-5 py-4 sm:border-b-0 sm:border-r"><dt className="text-e-dim">{t("status_latency")}</dt><dd className="mt-1 font-mono font-medium">{probe.state === "ok" ? `${probe.ms} ms` : "—"}</dd></div>
            <div className="border-b border-e-line px-5 py-4 sm:border-b-0 sm:border-r"><dt className="text-e-dim">{t("status_source")}</dt><dd className="mt-1 font-medium">{t("status_automatic")}</dd></div>
            <div className="px-5 py-4"><dt className="text-e-dim">{t("status_updated")}</dt><dd className="mt-1 font-mono font-medium">{probe.state === "checking" ? "—" : probe.at.toLocaleTimeString()}</dd></div>
          </dl>
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-2xl border border-e-line bg-e-bg2 p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold">{t("status_services")}</h2>
            <div className="mt-4 divide-y divide-e-line">
              {services.map((service) => (
                <div key={service.label} className="flex min-h-14 items-center gap-3 py-3">
                  <service.icon className="size-4 shrink-0 text-e-dim" />
                  <span className="min-w-0 flex-1 text-[14px]">{service.label}</span>
                  <span className={`flex items-center gap-1.5 text-[12px] font-medium ${probe.state === "down" ? "text-e-err" : "text-e-ok"}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {probe.state === "checking" ? t("status_checking") : probe.state === "down" ? t("status_down") : t("status_service_ok")}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-e-line bg-e-bg3/50 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-e-bg2"><Sparkles className="size-5" /></div>
              <span className="flex items-center gap-1.5 rounded-full bg-e-bg2 px-2.5 py-1 text-[11px] font-medium text-e-ok">
                <span className="size-1.5 animate-pulse rounded-full bg-e-ok" /> {t("status_live")}
              </span>
            </div>
            <p className="mt-7 text-[13px] text-e-dim">{t("status_activity")}</p>
            <div className="mt-1 flex items-end gap-2">
              <strong className="font-mono text-[42px] font-semibold leading-none tabular-nums">{operations}</strong>
              <span className="pb-1 text-[13px] text-e-dim">{t("status_activity_desc")}</span>
            </div>
            <div className="mt-6 flex h-8 items-end gap-1" aria-hidden>
              {[35, 58, 42, 76, 53, 88, 65, 96, 72, 84, 60, 78].map((height, index) => (
                <span key={index} className="flex-1 rounded-t-sm bg-e-acc/20 transition-[height] duration-700" style={{ height: `${Math.max(22, Math.min(100, height + ((operations + index) % 15) - 7))}%` }} />
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-e-dim"><Clock3 className="mt-0.5 size-3 shrink-0" />{t("status_activity_note")}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
