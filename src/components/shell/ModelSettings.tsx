import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { getModelConfig, displayModel } from "@/lib/api/config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Test = { kind: "idle" } | { kind: "run" } | { kind: "ok"; ms: number; models: string[]; account: string } | { kind: "err"; msg: string };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-e-line py-3.5 last:border-0">
      <div className="mb-2 text-[14px] font-medium">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] text-e-dim">{hint}</p>}
    </div>
  );
}

/** Server-assigned model connection. Users never manage infrastructure credentials. */
export function ModelSettings() {
  const [models, setModels] = useState<string[]>([getModelConfig().model]);
  const [test, setTest] = useState<Test>({ kind: "idle" });

  const loadModels = async () => {
    const m = await api.models();
    const ids = (m.data ?? []).map((d) => d.id);
    if (ids.length) setModels(ids);
    return m;
  };
  useEffect(() => { loadModels().catch(() => { /* list stays at the saved model */ }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setTest({ kind: "run" });
    const t0 = performance.now();
    try {
      const m = await loadModels();
      const ms = Math.round(performance.now() - t0);
      let account = "no disponible";
      try { const a = await api.account(); const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("es-ES") : "—");
        account = [`plan ${String(a["plan"] ?? "—")}`, `tokens disponibles ${n(a["tokens_balance"])}`, `usados ${n(a["tokens_used"])}`, `imágenes ${n(a["images_used"])}${typeof a["images_quota"] === "number" && a["images_quota"] > 0 ? ` de ${n(a["images_quota"])}` : ""}`, `en curso ${n(a["inflight"])}`].join(" · "); } catch { /* optional */ }
      setTest({ kind: "ok", ms, models: (m.data ?? []).map((d) => d.id + (d.context_length ? ` (${Math.round(d.context_length / 1000)}k)` : "")), account });
    } catch (e) {
      setTest({ kind: "err", msg: e instanceof ApiError ? (e.status === 0 ? "No se pudo conectar con el servidor." : e.message) : "Error desconocido." });
    }
  };

  return (
    <section>
      <Field label="Acceso al modelo" hint="La conexión se asigna automáticamente a tu cuenta; no necesitas configurar claves.">
        <div className="flex items-center gap-2 rounded-xl border border-e-line bg-e-bg3 px-3 py-2.5 text-[13.5px]">
          <CheckCircle2 className="size-4 text-e-ok" /> Gestionado por Erasmus
        </div>
      </Field>

      <Field label="Modelo" hint="Modelo asignado a tu cuenta.">
        <Select value="erasmus-v2" disabled>
          <SelectTrigger aria-label="Modelo" className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {models.map((m) => <SelectItem key={m} value={m}>{displayModel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-wrap gap-2 pt-4">
        <button type="button" onClick={() => void run()} disabled={test.kind === "run"} className="inline-flex items-center gap-1.5 rounded-full border border-e-line px-4 py-2 text-[14px] hover:bg-e-bg3 disabled:opacity-50">
          {test.kind === "run" ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Probar conexión
        </button>
      </div>

      {test.kind === "ok" && (
        <div className="mt-4 rounded-2xl border border-e-line p-4 text-[13.5px]" data-model-test="ok">
          <div className="flex items-center gap-2 font-medium text-e-ok"><CheckCircle2 className="size-4" /> Modelo conectado · {test.ms} ms</div>
          <div className="mt-2 text-e-dim">Modelos: <span className="font-mono text-e-tx">{test.models.map(displayModel).join(", ") || "—"}</span></div>
          <div className="mt-1 text-e-dim">Cuenta: <span className="text-e-tx">{test.account}</span></div>
        </div>
      )}
      {test.kind === "err" && (
        <div className="e-err-banner mt-4 flex items-center gap-2 px-3 py-2.5 text-[13.5px]" role="alert" data-model-test="error">
          <XCircle className="size-4 shrink-0" /> {test.msg}
        </div>
      )}
    </section>
  );
}
