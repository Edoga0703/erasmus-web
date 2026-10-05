import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import { MOCK, getModelConfig, isValidVpsKey, saveModelConfig, type ModelConfig, displayModel } from "@/lib/api/config";
import { Switch } from "@/components/ui/switch";
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

/** Ajustes → Modelo y API: user-level API key, model choice from GET /v1/models, compact mode and a live test. Server endpoint/token are deployment config, not user settings. */
export function ModelSettings() {
  const [cfg, setCfg] = useState<ModelConfig>(() => getModelConfig());
  const [models, setModels] = useState<string[]>([cfg.model || "erasmus-v1"]);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<Test>({ kind: "idle" });
  const keyBad = cfg.apiKey !== "" && !isValidVpsKey(cfg.apiKey);
  const input = "w-full rounded-xl border border-e-line bg-e-bg2 px-3 py-2 text-[14px] text-e-tx outline-none focus:border-e-acc2";

  const loadModels = async () => {
    const m = await api.models();
    const ids = (m.data ?? []).map((d) => d.id);
    if (ids.length) setModels(ids);
    return m;
  };
  useEffect(() => { loadModels().catch(() => { /* list stays at the saved model */ }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (quiet = false) => {
    if (keyBad) { toast.error("La clave debe empezar por ms- y tener más de 10 caracteres."); return false; }
    saveModelConfig(cfg);
    if (!quiet) toast.success("Conexión del modelo guardada.");
    return true;
  };

  const run = async () => {
    if (!save(true)) return;
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
      {MOCK && (
        <p className="mb-2 rounded-xl bg-e-bg3 px-3 py-2 text-[12.5px] text-e-dim">
          Esta vista previa está en modo demostración: la prueba responde con datos simulados. En la versión publicada conectada al servidor, la prueba consulta el servidor real.
        </p>
      )}
      <Field label="Clave de API" hint="Tu clave ms-…. Solo se usa para hablar con el modelo; nunca se envía a archivos ni al sandbox.">
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-e-dim" />
          <input type={show ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="ms-…" value={cfg.apiKey} aria-label="Clave de API"
            onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value.trim() })} className={cn(input, "pl-9 pr-10 font-mono", keyBad && "border-e-err")} />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-e-dim hover:text-e-tx" aria-label={show ? "Ocultar clave" : "Mostrar clave"} onClick={() => setShow(!show)}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {keyBad && <p className="mt-1.5 text-[12.5px] text-e-err">Formato no válido: debe empezar por ms- y tener más de 10 caracteres.</p>}
        <label className="mt-3 flex items-center justify-between gap-3 text-[13.5px]">
          <span>Recordar en este navegador<span className="block text-[12px] text-e-dim">Si está apagado, se borra al cerrar la pestaña.</span></span>
          <Switch checked={cfg.remember} onCheckedChange={(v) => setCfg({ ...cfg, remember: v })} aria-label="Recordar clave" />
        </label>
      </Field>

      <Field label="Modelo" hint="Modelos disponibles para tu clave.">
        <Select value={cfg.model} onValueChange={(v) => setCfg({ ...cfg, model: v })}>
          <SelectTrigger aria-label="Modelo" className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {models.map((m) => <SelectItem key={m} value={m}>{displayModel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Modo compacto">
        <label className="flex items-center justify-between gap-3 text-[13.5px]">
          <span className="text-e-dim">Respuestas más breves.</span>
          <Switch checked={cfg.compact} onCheckedChange={(v) => setCfg({ ...cfg, compact: v })} aria-label="Modo compacto" />
        </label>
      </Field>

      <div className="flex flex-wrap gap-2 pt-4">
        <button type="button" onClick={() => save()} className="rounded-full bg-e-acc px-4 py-2 text-[14px] font-medium text-e-bg2">Guardar</button>
        <button type="button" onClick={() => void run()} disabled={test.kind === "run"} className="inline-flex items-center gap-1.5 rounded-full border border-e-line px-4 py-2 text-[14px] hover:bg-e-bg3 disabled:opacity-50">
          {test.kind === "run" ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Probar conexión
        </button>
      </div>

      {test.kind === "ok" && (
        <div className="mt-4 rounded-2xl border border-e-line p-4 text-[13.5px]" data-model-test="ok">
          <div className="flex items-center gap-2 font-medium text-e-ok"><CheckCircle2 className="size-4" /> Modelo conectado · {test.ms} ms{MOCK ? " (demostración)" : ""}</div>
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
