import { useEffect, useState } from "react";
import { Brain, Check, CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { displayModel, getModelConfig, REASONING_EFFORTS, saveModelConfig, type ReasoningEffort } from "@/lib/api/config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

/** Server-assigned model connection + reasoning_effort selector synced with the Composer. */
export function ModelSettings() {
  const [models, setModels] = useState<string[]>([getModelConfig().model]);
  const [reasoning, setReasoning] = useState<ReasoningEffort>(() => getModelConfig().reasoning);
  const [test, setTest] = useState<Test>({ kind: "idle" });

  useEffect(() => {
    const sync = () => setReasoning(getModelConfig().reasoning);
    window.addEventListener("erasmus:model-config", sync);
    window.addEventListener("erasmus:session-changed", sync);
    return () => {
      window.removeEventListener("erasmus:model-config", sync);
      window.removeEventListener("erasmus:session-changed", sync);
    };
  }, []);

  const handleReasoningChange = (effort: ReasoningEffort) => {
    setReasoning(effort);
    saveModelConfig({ ...getModelConfig(), reasoning: effort });
  };

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
      try {
        const a = await api.account();
        const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("es-ES") : "—");
        const balance = a.tokens_balance ?? a.balance_tokens;
        account = [
          `plan ${String(a.plan ?? "—")}`,
          `tokens disponibles ${n(balance)}`,
          `usados ${n(a.tokens_used)}`,
          `imágenes ${n(a.images_used)}${typeof a.images_quota === "number" && a.images_quota > 0 ? ` de ${n(a.images_quota)}` : ""}`,
          `en curso ${n(a.inflight)}`,
        ].join(" · ");
      } catch { /* optional */ }
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

      <Field
        label="Profundidad de razonamiento"
        hint="Modula cuánto reflexiona Erasmus antes de responder (reasoning_effort). También puedes cambiarlo en cualquier momento desde la barra del chat."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Profundidad de razonamiento">
          {REASONING_EFFORTS.map(({ id, label, desc }) => {
            const active = reasoning === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleReasoningChange(id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-e-acc bg-e-bg3 text-e-tx" : "border-e-line bg-e-bg2 text-e-dim hover:bg-e-bg3 hover:text-e-tx",
                )}
              >
                <Brain className={cn("mt-0.5 size-4 shrink-0", active ? "text-e-ok" : "text-e-dim")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1 text-[13.5px] font-medium text-e-tx">
                    <span>{label}</span>
                    {active && <Check className="size-3.5 text-e-ok" />}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-e-dim">{desc}</span>
                </span>
              </button>
            );
          })}
        </div>
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
