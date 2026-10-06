import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { API_BASE } from "@/lib/api/config";
import { cn } from "@/lib/utils";

type Check = { id: string; method: "GET" | "POST"; path: string; body?: unknown; required: string[]; pub?: boolean };
type Result = { state: "idle" | "run" | "ok" | "fail"; ms?: number; status?: number; msg?: string; response?: unknown; missing?: string[] };

/** Read-only, non-destructive checks with the user's own session. Admin endpoints are intentionally excluded. */
const CHECKS: Check[] = [
  { id: "health", method: "GET", path: "/health", required: ["ok", "status"], pub: true },
  { id: "me", method: "GET", path: "/api/auth/me", required: ["ok", "user_id", "plan", "status"] },
  { id: "account", method: "GET", path: "/api/account/me", required: [] },
  { id: "chats", method: "GET", path: "/api/workspace/chats", required: ["ok", "chats"] },
  { id: "list", method: "GET", path: "/api/workspace/list?path=", required: ["ok", "entries"] },
  { id: "models", method: "GET", path: "/v1/models", required: ["data"] },
  { id: "ping", method: "POST", path: "/v1/chat/completions", body: { model: "erasmus-v1", messages: [{ role: "user", content: "ping" }], stream: false }, required: ["choices", "usage"] },
];

const SECRET = /^(session|token|access_code|api_key|key|password|motor_key)$/i;
function redact(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET.test(k) ? "•••" : redact(x)]));
  return typeof v === "string" ? v.replace(/drael[-\w]*/gi, "erasmus-v1") : v;
}

export function Diagnostics() {
  const [res, setRes] = useState<Record<string, Result>>({});
  const [open, setOpen] = useState<string | null>(null);

  const run = async (c: Check) => {
    setRes((r) => ({ ...r, [c.id]: { state: "run" } }));
    const t0 = performance.now();
    try {
      const init: RequestInit = { method: c.method, ...(c.body ? { body: JSON.stringify(c.body) } : {}) };
      const r = c.pub
        ? await fetch(`${API_BASE}${c.path}`, { ...init, credentials: "omit", referrerPolicy: "no-referrer" })
        : await apiFetch(c.path, init);
      const ms = Math.round(performance.now() - t0);
      const j = await r.json().catch(() => null) as Record<string, unknown> | null;
      const missing = c.required.filter((k) => !j || !(k in j));
      const ok = r.ok && missing.length === 0;
      setRes((s) => ({ ...s, [c.id]: { state: ok ? "ok" : "fail", ms, status: r.status, response: redact(j), missing, msg: r.ok ? (missing.length ? "Faltan campos" : "") : String((j?.["error"] as { message?: string })?.message ?? j?.["error"] ?? r.statusText) } }));
    } catch {
      setRes((s) => ({ ...s, [c.id]: { state: "fail", ms: Math.round(performance.now() - t0), status: 0, msg: "Sin conexión" } }));
    }
  };
  const runAll = async () => { for (const c of CHECKS) await run(c); };

  const vals = Object.values(res);
  const done = vals.filter((v) => v.state === "ok" || v.state === "fail").length;
  const okN = vals.filter((v) => v.state === "ok").length;

  return (
    <section className="text-[13px]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => void runAll()} className="inline-flex items-center gap-1.5 rounded-full border border-e-line px-3.5 py-1.5 hover:bg-e-bg3"><RefreshCw className="size-3.5" /> Ejecutar todo</button>
        <span className="text-e-dim">Probados {done}/{CHECKS.length} · Éxitos {okN} · Fallos {done - okN}</span>
      </div>
      <p className="mb-3 text-[12px] text-e-dim">Pruebas de solo lectura con tu sesión. Las datos sensibles se ocultan.</p>
      <ul className="divide-y divide-e-line rounded-xl border border-e-line">
        {CHECKS.map((c) => {
          const r = res[c.id] ?? { state: "idle" };
          return (
            <li key={c.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold", c.method === "GET" ? "bg-e-ok/15 text-e-ok" : "bg-primary/15 text-primary")}>{c.method}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{c.path}</span>
                {r.state === "run" && <Loader2 className="size-4 animate-spin text-e-dim" />}
                {r.state === "ok" && <CheckCircle2 className="size-4 text-e-ok" />}
                {r.state === "fail" && <XCircle className="size-4 text-destructive" />}
                {r.ms !== undefined && <span className="w-14 text-right font-mono text-[11px] text-e-dim">{r.ms} ms</span>}
                <button className="e-icon-btn" aria-label="Probar" onClick={() => void run(c)}><Send className="size-3.5" /></button>
                <button className="e-icon-btn" aria-label="Detalles" onClick={() => setOpen(open === c.id ? null : c.id)}><ChevronDown className={cn("size-3.5", open === c.id && "rotate-180")} /></button>
              </div>
              {r.state === "fail" && <p className="mt-1 text-[12px] text-destructive">HTTP {r.status} {r.msg}{r.missing?.length ? `: ${r.missing.join(", ")}` : ""}</p>}
              {open === c.id && (
                <div className="mt-2 grid gap-2">
                  <pre className="max-h-40 overflow-auto rounded-lg bg-e-bg3 p-2 font-mono text-[11px]">Enviado: {JSON.stringify(c.body ?? null, null, 2)}</pre>
                  <pre className="max-h-60 overflow-auto rounded-lg bg-e-bg3 p-2 font-mono text-[11px]">Recibido: {JSON.stringify(r.response ?? null, null, 2)}</pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
