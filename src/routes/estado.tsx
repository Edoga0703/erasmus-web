import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { api } from "@/lib/api/client";
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

type Probe = { state: "checking" } | { state: "ok"; ms: number; model: string; workspace: string; at: Date } | { state: "down"; at: Date };

function StatusPage() {
  const t = useT();
  const [probe, setProbe] = useState<Probe>({ state: "checking" });

  const check = useCallback(async () => {
    setProbe({ state: "checking" });
    const t0 = performance.now();
    try {
      const s = await api.status();
      setProbe({ state: "ok", ms: Math.round(performance.now() - t0), model: s.brand_model, workspace: s.workspace_name, at: new Date() });
    } catch {
      setProbe({ state: "down", at: new Date() });
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  return (
    <div className="min-h-dvh bg-e-bg2 text-e-tx">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-[32px] font-semibold tracking-tight">{t("status_title")}</h1>
        <p className="mt-2 text-[15px] text-e-dim">{t("status_sub")}</p>

        <div className="mt-8 rounded-2xl border border-e-line bg-e-bg2 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            {probe.state === "checking" && <Loader2 className="size-6 animate-spin text-e-dim" />}
            {probe.state === "ok" && <CheckCircle2 className="size-6 text-e-ok" />}
            {probe.state === "down" && <XCircle className="size-6 text-e-err" />}
            <span className="text-[20px] font-semibold">
              {probe.state === "checking" ? t("status_checking") : probe.state === "ok" ? t("status_ok") : t("status_down")}
            </span>
            <button onClick={() => void check()} disabled={probe.state === "checking"}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-e-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-e-bg3 disabled:opacity-40">
              <RefreshCw className={`size-3.5 ${probe.state === "checking" ? "animate-spin" : ""}`} /> {t("status_retry")}
            </button>
          </div>

          <dl className="mt-6 divide-y divide-e-line text-[14px]">
            {probe.state === "ok" && (
              <>
                <div className="flex justify-between py-3"><dt className="text-e-dim">{t("status_latency")}</dt><dd className="font-mono">{probe.ms} ms</dd></div>
                <div className="flex justify-between py-3"><dt className="text-e-dim">{t("status_model")}</dt><dd className="font-mono">Erasmus</dd></div>
                <div className="flex justify-between py-3"><dt className="text-e-dim">{t("status_workspace")}</dt><dd className="font-mono">{probe.workspace || "—"}</dd></div>
              </>
            )}
            {probe.state !== "checking" && (
              <div className="flex justify-between py-3">
                <dt className="text-e-dim">{t("status_updated")}</dt>
                <dd className="font-mono">{probe.at.toLocaleTimeString()}</dd>
              </div>
            )}
          </dl>
        </div>

        <p className="mt-6 flex items-center gap-2 text-[13px] text-e-dim">
          <Activity className="size-4" /> Erasmus
        </p>
      </main>
    </div>
  );
}
