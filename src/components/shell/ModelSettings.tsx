import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api/client";
import { API_BASE, MOCK, getModelConfig, getToken, isValidVpsKey, saveModelConfig, setToken, type ModelConfig, type ReasoningEffort } from "@/lib/api/config";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Test = { kind: "idle" } | { kind: "run" } | { kind: "ok"; ms: number; models: string[]; account: string } | { kind: "err"; msg: string };
const EFFORTS: [ReasoningEffort, string][] = [["none", "Ninguno"], ["low", "Bajo"], ["medium", "Medio"], ["high", "Alto"]];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-e-line py-3.5 last:border-0">
      <div className="mb-2 text-[14px] font-medium">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] text-e-dim">{hint}</p>}
    </div>
  );
}

/** Ajustes → Modelo y API: ms- key, bridge token, model/reasoning options and a live connection test (API_Erasmus.md). */
export function ModelSettings() {
  const [cfg, setCfg] = useState<ModelConfig>(() => getModelConfig());
  const [token, setTok] = useState("");
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<Test>({ kind: "idle" });
  const hasToken = getToken() !== "";
  const keyBad = cfg.apiKey !== "" && !isValidVpsKey(cfg.apiKey);
  const input = "w-full rounded-xl border border-e-line bg-e-bg2 px-3 py-2 text-[14px] text-e-tx outline-none focus:border-e-acc2";

  const save = () => {
    if (keyBad) { toast.error("La clave debe empezar por ms- (las claves dk- de drael.sh no pasan por el puente)."); return; }
    if (token.trim()) { setToken(token); setTok(""); }
    saveModelConfig(cfg);
    toast.success("Conexión del modelo guardada.");
  };

  const run = async () => {
    save();
    setTest({ kind: "run" });
    const t0 = performance.now();
    try {
      const m = await api.models();
      const ms = Math.round(performance.now() - t0);
      let account = "no disponible";
      try { const a = await api.account(); account = Object.entries(a).filter(([k]) => k !== "ok").map(([k, v]) => `${k}: ${String(v)}`).join(" · ") || "ok"; } catch { /* account proxy is optional */ }
      setTest({ kind: "ok", ms, models: (m.data ?? []).map((d) => d.id + (d.context_length ? ` (${Math.round(d.context_length / 1000)}k)` : "")), account });
    } catch (e) {
      setTest({ kind: "err", msg: e instanceof ApiError ? (e.status === 0 ? "No se pudo conectar con el puente." : e.message) : "Error desconocido." });
    }
  };

  return (
    <section>
      <Field label="Endpoint del puente" hint="Se define al desplegar (VITE_API_BASE). Solo lectura.">
        <code className="font-mono text-[13px]">{API_BASE}{MOCK ? " (demostración)" : ""}</code>
      </Field>

      <Field label="Clave de API del modelo" hint="Clave ms-… aceptada por la VPS de Erasmus. Solo se envía al chat, modelos y cuenta; nunca a archivos ni sandbox. Déjala vacía si el servidor ya tiene una clave configurada.">
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

      <Field label="Token del puente" hint={hasToken ? "Hay un token activo en esta sesión (el valor nunca se muestra). Pega otro solo si el puente se reinició." : "Normalmente llega en el enlace (?t=…). Si abriste la web sin él, pégalo aquí."}>
        <input type="password" autoComplete="off" placeholder={hasToken ? "•••••••• (activo)" : "Pega el token X-Erasmus-Token"} value={token} aria-label="Token del puente"
          onChange={(e) => setTok(e.target.value)} className={cn(input, "font-mono")} />
      </Field>

      <Field label="Modelo" hint="El puente presenta erasmus-v1 y lo enruta al motor de la VPS.">
        <input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value.trim() || "erasmus-v1" })} aria-label="Modelo" className={cn(input, "font-mono")} />
      </Field>

      <Field label="Nivel de razonamiento" hint="reasoning_effort enviado en cada mensaje. Medio es el valor por defecto del motor.">
        <div className="inline-flex rounded-full bg-e-bg3 p-1">
          {EFFORTS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={cfg.reasoning === v} onClick={() => setCfg({ ...cfg, reasoning: v })}
              className={cn("rounded-full px-3.5 py-1.5 text-[13px]", cfg.reasoning === v ? "bg-e-bg2 text-e-tx shadow-sm" : "text-e-dim")}>{l}</button>
          ))}
        </div>
      </Field>

      <Field label="Modo compacto">
        <label className="flex items-center justify-between gap-3 text-[13.5px]">
          <span className="text-e-dim">Envía X-Compact-Mode para respuestas más breves.</span>
          <Switch checked={cfg.compact} onCheckedChange={(v) => setCfg({ ...cfg, compact: v })} aria-label="Modo compacto" />
        </label>
      </Field>

      <div className="flex flex-wrap gap-2 pt-4">
        <button type="button" onClick={save} className="rounded-full bg-e-acc px-4 py-2 text-[14px] font-medium text-e-bg2">Guardar</button>
        <button type="button" onClick={() => void run()} disabled={test.kind === "run"} className="inline-flex items-center gap-1.5 rounded-full border border-e-line px-4 py-2 text-[14px] hover:bg-e-bg3 disabled:opacity-50">
          {test.kind === "run" ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Probar conexión
        </button>
      </div>

      {test.kind === "ok" && (
        <div className="mt-4 rounded-2xl border border-e-line p-4 text-[13.5px]" data-model-test="ok">
          <div className="flex items-center gap-2 font-medium text-e-ok"><CheckCircle2 className="size-4" /> Modelo conectado · {test.ms} ms</div>
          <div className="mt-2 text-e-dim">Modelos: <span className="font-mono text-e-tx">{test.models.join(", ") || "—"}</span></div>
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
