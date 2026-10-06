import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { CODE_RE, formatCode, getSession } from "@/lib/session";
import { DEV_LOCAL_LOGIN, login } from "@/lib/auth";
import { PublicHeader } from "@/components/PublicHeader";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Erasmus" },
      { name: "description", content: "Entra en Erasmus con tu código de acceso. Sin correo." },
      { property: "og:title", content: "Entrar — Erasmus" },
      { property: "og:description", content: "Entra en Erasmus con tu código de acceso. Sin correo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const MSG = {
  format: "El código debe tener el formato erm-XXXX-XXXX-XXXXX-XXXX.",
  invalid: "Código no válido o inactivo.",
  rate: "Demasiados intentos. Espera un momento.",
  unavailable: "El acceso no está disponible todavía. Inténtalo más tarde.",
  network: "No se pudo conectar con el servidor.",
} as const;

function LoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const fails = useRef(0);

  useEffect(() => { if (getSession()) void navigate({ to: "/chat", replace: true }); }, [navigate]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const valid = CODE_RE.test(code);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || wait > 0) return;
    setBusy(true); setErr("");
    const r = await login(code);
    setBusy(false);
    if (r.ok) { setCode(""); void navigate({ to: "/chat", replace: true }); return; }
    setErr(MSG[r.reason]);
    if (r.reason === "invalid" || r.reason === "format") { fails.current += 1; if (fails.current >= 3) setWait(Math.min(60, 2 ** (fails.current - 2))); }
    if (r.reason === "rate") setWait(r.retryAfter ?? 30);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-e-bg2 text-e-tx">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-5 pb-20">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="text-[28px] font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1.5 text-[14.5px] text-e-dim">Usa tu código de acceso. Sin correo, sin contraseña.</p>
          <label htmlFor="code" className="mt-7 block text-[13px] font-medium">Código de acceso</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-e-line bg-e-bg2 px-3.5 focus-within:border-e-dim">
            <KeyRound className="size-4 shrink-0 text-e-dim" />
            <input id="code" autoFocus autoComplete="off" spellCheck={false} inputMode="text" placeholder="erm-XXXX-XXXX-XXXXX-XXXX"
              value={code} onChange={(e) => { setCode(formatCode(e.target.value)); setErr(""); }}
              className="h-12 w-full bg-transparent font-mono text-[15px] outline-none placeholder:text-e-dim/70" aria-invalid={!!err} />
          </div>
          {err && <p role="alert" className="mt-2 text-[13px] text-e-err">{err}</p>}
          <button type="submit" disabled={!valid || busy || wait > 0}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-e-acc text-[15px] font-medium text-e-bg2 transition-opacity disabled:opacity-40">
            {busy ? <Loader2 className="size-4 animate-spin" /> : wait > 0 ? `Espera ${wait} s` : <>Entrar <ArrowRight className="size-4" /></>}
          </button>
          {DEV_LOCAL_LOGIN && <p className="mt-6 rounded-xl bg-e-bg3 px-3 py-2 text-[12px] text-e-dim">Vista de desarrollo: si el servidor aún no valida códigos, cualquier código con formato válido abre un espacio local separado. En la versión publicada esto no existe.</p>}
        </form>
      </div>
    </main>
  );
}
